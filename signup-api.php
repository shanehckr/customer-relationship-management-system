<?php
declare(strict_types=1);

mysqli_report(MYSQLI_REPORT_ERROR | MYSQLI_REPORT_STRICT);

// Shared session setup (secure cookie settings). Public endpoint: an expired login just counts as logged out.
define("SESSION_NO_REDIRECT", true);
require_once __DIR__ . "/session-init.php";

require_once __DIR__ . "/config/database.php";



const OTP_LENGTH           = 6;
const OTP_TTL_SECONDS      = 300;   // code is valid for 5 minutes
const OTP_RESEND_SECONDS   = 30;     // wait before asking for another code
const OTP_MAX_SENDS        = 5;      // per session, per 30-minute window
const OTP_SEND_WINDOW      = 1800;  // ... per 30 minutes
const OTP_MAX_ATTEMPTS     = 5;     // wrong guesses before the code is thrown away
const OTP_MAX_IP_SENDS     = 10;    // per IP, per 30-minute window
const OTP_MAX_IP_VERIFIES  = 30;    // per IP, per 30-minute window

class SmsVerificationUnavailableException extends RuntimeException {}

/* ---------------- helpers ---------------- */

function respond(int $status, array $payload): void
{
    http_response_code($status);
    header("Content-Type: application/json; charset=UTF-8");
    header("Cache-Control: no-store");
    echo json_encode($payload, JSON_UNESCAPED_UNICODE);
    exit;
}

function fail(string $message, int $status = 422, array $extra = []): void
{
    respond($status, array_merge(["success" => false, "message" => $message], $extra));
}

/**
 * Sends a verification code through the configured provider.
 * No provider is currently integrated, so live SMS verification remains unavailable.
 */
function sendOtpSms(string $e164Phone): void
{
    throw new SmsVerificationUnavailableException("SMS verification provider is not configured.");
}

/**
 * Confirms a code only through a provider; the CRM does not accept hardcoded or fallback codes.
 */
function verifyOtpSms(string $e164Phone, string $code): bool
{
    throw new SmsVerificationUnavailableException("SMS verification provider is not configured.");
}

/** IP-based caps supplement the per-session limits using the existing audit table. */
function recordSignupOtpIpAttempt(mysqli $conn, string $action, int $maximum): void
{
    if (!in_array($action, ["signup_otp_send", "signup_otp_verify"], true)) {
        throw new RuntimeException("Invalid signup rate-limit action.");
    }
    $ip = (string) ($_SERVER["REMOTE_ADDR"] ?? "");
    if (!filter_var($ip, FILTER_VALIDATE_IP)) $ip = "unknown";

    $stmt = $conn->prepare("SELECT COUNT(*) AS total FROM audit_logs
        WHERE action = ? AND module = 'signup' AND ip_address = ?
          AND created_at >= (NOW() - INTERVAL 30 MINUTE)");
    $stmt->bind_param("ss", $action, $ip);
    $stmt->execute();
    $count = (int) ($stmt->get_result()->fetch_assoc()["total"] ?? 0);
    $stmt->close();
    if ($count >= $maximum) {
        fail($action === "signup_otp_send"
            ? "Too many code requests from this connection. Try again later."
            : "Too many verification attempts from this connection. Try again later.", 429);
    }

    $stmt = $conn->prepare("INSERT INTO audit_logs (action, module, record_type, ip_address)
        VALUES (?, 'signup', 'phone_verification', ?)");
    $stmt->bind_param("ss", $action, $ip);
    $stmt->execute();
    $stmt->close();
}

function normalizePhone(string $raw): ?string
{
    $value = trim($raw);
    if (!preg_match("/^\+?[0-9\s().-]+$/", $value)) return null;
    $digits = preg_replace("/[\s().-]/", "", $value) ?? "";
    $digits = ltrim($digits, "+");
    if (preg_match("/^09\d{9}$/", $digits)) return substr($digits, 1);
    if (preg_match("/^9\d{9}$/", $digits)) return $digits;
    if (preg_match("/^\+?639\d{9}$/", $digits)) return substr($digits, 2);
    return null;
}

/* ---------------- request checks ---------------- */

if ($_SERVER["REQUEST_METHOD"] !== "POST") {
    header("Allow: POST");
    fail("Method not allowed.", 405);
}

if (isset($_SESSION["user_id"])) {
    fail("You are already logged in.", 403);
}

$sessionToken   = $_SESSION["signup_csrf_token"] ?? "";
$submittedToken = $_SERVER["HTTP_X_CSRF_TOKEN"] ?? "";
if (
    !is_string($sessionToken) || $sessionToken === "" ||
    !is_string($submittedToken) ||
    !hash_equals($sessionToken, $submittedToken)
) {
    fail("Your session expired. Refresh the page and try again.", 403);
}

$action = (string) ($_POST["action"] ?? "");

try {
    switch ($action) {

        /* ============ 1) send the code ============ */
        case "send_otp":
            $phone = normalizePhone((string) ($_POST["phone"] ?? ""));
            if ($phone === null) {
                fail("Enter a valid Philippine mobile number, like 9XX XXX XXXX.");
            }
            $e164 = "+63" . $phone;

            // Rate limit before charging the provider; count failed provider attempts too.
            $now   = time();
            $sends = array_values(array_filter(
                (array) ($_SESSION["signup_sends"] ?? []),
                static fn($t) => is_int($t) && $t > $now - OTP_SEND_WINDOW
            ));
            $last = $sends ? max($sends) : 0;
            if ($last && $now - $last < OTP_RESEND_SECONDS) {
                $wait = OTP_RESEND_SECONDS - ($now - $last);
                fail("Please wait {$wait} seconds before asking for a new code.", 429, ["resend_in" => $wait]);
            }
            if (count($sends) >= OTP_MAX_SENDS) {
                fail("Too many code requests. Try again in a few minutes.", 429);
            }

            // already registered?
            $stmt = $conn->prepare("SELECT 1 FROM users WHERE phone = ? LIMIT 1");
            $stmt->bind_param("s", $e164);
            $stmt->execute();
            $taken = (bool) $stmt->get_result()->fetch_row();
            $stmt->close();
            if ($taken) {
                fail("This number already has an account. Log in instead.", 409);
            }

            $sends[] = $now;
            $_SESSION["signup_sends"] = $sends;
            recordSignupOtpIpAttempt($conn, "signup_otp_send", OTP_MAX_IP_SENDS);
            // A resend may invalidate the previous provider code; discard its app-side state first.
            unset($_SESSION["signup"]);
            sendOtpSms($e164);
            $_SESSION["signup"] = [
                "phone"    => $e164,
                "expires"  => $now + OTP_TTL_SECONDS,
                "attempts" => 0,
                "verified" => false,
            ];

            $payload = [
                "success"    => true,
                "message"    => "Verification code sent.",
                "resend_in"  => OTP_RESEND_SECONDS,
                "expires_in" => OTP_TTL_SECONDS,
            ];
            respond(200, $payload);

        /* ============ 2) check the code ============ */
        case "verify_otp":
            $flow = $_SESSION["signup"] ?? null;
            if (!is_array($flow) || empty($flow["phone"]) || !empty($flow["verified"])) {
                fail("Request a verification code first.");
            }
            if (time() > (int) $flow["expires"]) {
                fail("This code has expired. Request a new one.", 410, ["expired" => true]);
            }
            if ((int) $flow["attempts"] >= OTP_MAX_ATTEMPTS) {
                unset($_SESSION["signup"]);
                fail("Too many wrong codes. Request a new one.", 429, ["expired" => true]);
            }

            $code = trim((string) ($_POST["code"] ?? ""));
            if (!preg_match("/^\d{" . OTP_LENGTH . "}$/", $code)) {
                fail("Enter all " . OTP_LENGTH . " digits.");
            }

            recordSignupOtpIpAttempt($conn, "signup_otp_verify", OTP_MAX_IP_VERIFIES);
            if (!verifyOtpSms((string) $flow["phone"], $code)) {
                $attempts = (int) $flow["attempts"] + 1;
                $_SESSION["signup"]["attempts"] = $attempts;
                $left = OTP_MAX_ATTEMPTS - $attempts;
                if ($left <= 0) {
                    unset($_SESSION["signup"]);
                    fail("Too many wrong codes. Request a new one.", 429, ["expired" => true]);
                }
                fail("That code is not correct. {$left} " . ($left === 1 ? "try" : "tries") . " left.");
            }

            $_SESSION["signup"]["verified"] = true;
            unset($_SESSION["signup"]["expires"], $_SESSION["signup"]["attempts"]);
            respond(200, ["success" => true, "message" => "Phone number verified."]);

        /* ============ 3) create the account ============ */
        case "create_account":
            $flow = $_SESSION["signup"] ?? null;
            if (!is_array($flow) || empty($flow["verified"]) || empty($flow["phone"])) {
                fail("Verify your phone number first.", 403, ["restart" => true]);
            }

            $fullName = trim(preg_replace("/\s+/", " ", (string) ($_POST["full_name"] ?? "")) ?? "");
            $email    = trim((string) ($_POST["email"] ?? ""));
            $username = trim((string) ($_POST["username"] ?? ""));
            $password = (string) ($_POST["password"] ?? "");
            $confirm  = (string) ($_POST["confirm_password"] ?? "");
            $terms    = ($_POST["terms"] ?? "") === "1";

            $len = mb_strlen($fullName);
            if ($len < 2 || $len > 100) {
                fail("Enter your full name (2 to 100 characters).", 422, ["step" => 3]);
            }
            if (
                $email === "" || strlen($email) > 150 ||
                !filter_var($email, FILTER_VALIDATE_EMAIL) ||
                !preg_match('/@gmail\.com$/i', $email)   // Gmail only (example.com, yahoo.com, etc. are rejected)
            ) {
                fail("Enter a valid Gmail address, like yourname@gmail.com.", 422, ["field" => "email"]);
            }
            if (!preg_match("/^[A-Za-z0-9_.]{4,30}$/", $username)) {
                fail("Username must be 4 to 30 characters: letters, numbers, dot or underscore.", 422, ["field" => "username"]);
            }
            if (strlen($password) < 8 || strlen($password) > 72 ||
                !preg_match("/[A-Za-z]/", $password) || !preg_match("/\d/", $password)) {
                fail("Password needs 8 to 72 characters with at least one letter and one number.", 422, ["field" => "password"]);
            }
            if (!hash_equals($password, $confirm)) {
                fail("The two passwords do not match.", 422, ["field" => "confirm_password"]);
            }
            if (!$terms) {
                fail("Accept the Terms to create your account.", 422, ["field" => "terms"]);
            }

            $phone = (string) $flow["phone"];

            // duplicates
            $stmt = $conn->prepare(
                "SELECT username, email, phone FROM users
                 WHERE username = ? OR email = ? OR phone = ? LIMIT 1"
            );
            $stmt->bind_param("sss", $username, $email, $phone);
            $stmt->execute();
            $dup = $stmt->get_result()->fetch_assoc();
            $stmt->close();
            if ($dup) {
                if (strcasecmp((string) $dup["username"], $username) === 0) {
                    fail("That username is taken. Choose another.", 409, ["field" => "username"]);
                }
                if (strcasecmp((string) $dup["email"], $email) === 0) {
                    fail("That email already has an account. Log in instead.", 409, ["field" => "email"]);
                }
                fail("This phone number already has an account. Log in instead.", 409, ["restart" => true]);
            }

            // role comes from the roles table, no hard-coded id
            $stmt = $conn->prepare("SELECT role_id FROM roles WHERE role_name = 'Customer' LIMIT 1");
            $stmt->execute();
            $role = $stmt->get_result()->fetch_assoc();
            $stmt->close();
            if (!$role) {
                error_log("Signup: roles table has no 'Customer' role.");
                fail("Sign-up is not available right now. Please contact support.", 500);
            }
            $roleId = (int) $role["role_id"];

            $hash = password_hash($password, PASSWORD_DEFAULT);

            try {
                $stmt = $conn->prepare(
                    "INSERT INTO users (full_name, username, email, phone, password_hash, role_id, account_status)
                     VALUES (?, ?, ?, ?, ?, ?, 'Active')"
                );
                $stmt->bind_param("sssssi", $fullName, $username, $email, $phone, $hash, $roleId);
                $stmt->execute();
                $stmt->close();
            } catch (mysqli_sql_exception $e) {
                if ((int) $e->getCode() === 1062) {   // two people raced for the same value
                    fail("That username, email or phone number is already used.", 409);
                }
                throw $e;
            }

            unset($_SESSION["signup"], $_SESSION["signup_sends"]);
            $_SESSION["signup_csrf_token"] = bin2hex(random_bytes(32));

            respond(201, [
                "success"  => true,
                "message"  => "Account created. You can log in now.",
                "redirect" => "login.php?registered=1",
            ]);

        default:
            fail("Unknown action.", 400);
    }
} catch (SmsVerificationUnavailableException $e) {
    // Provider configuration and code details are deliberately omitted from logs and responses.
    error_log("Signup SMS verification unavailable.");
    fail("Phone verification is unavailable because no SMS provider is configured.", 503);
} catch (mysqli_sql_exception $e) {
    error_log("Signup database error: " . $e->getMessage());
    fail("Sign-up is temporarily unavailable. Please try again later.", 500);
} catch (Throwable $e) {
    error_log("Signup request failed.");
    fail("Sign-up is temporarily unavailable. Please try again later.", 500);
}
