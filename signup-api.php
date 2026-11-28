<?php
declare(strict_types=1);

mysqli_report(MYSQLI_REPORT_ERROR | MYSQLI_REPORT_STRICT);

define("SESSION_NO_REDIRECT", true);
require_once __DIR__ . "/session-init.php";
require_once __DIR__ . "/config/database.php";
require_once __DIR__ . "/includes/password-policy.php";
require_once __DIR__ . "/includes/Mail/EmailTemplateRenderer.php";
require_once __DIR__ . "/includes/Mail/EmailService.php";
require_once __DIR__ . "/includes/Mail/EmailQueueWorker.php";

const OTP_LENGTH = 6;
const OTP_TTL_SECONDS = 300;
const OTP_RESEND_SECONDS = 60;
const OTP_MAX_ATTEMPTS = 5;
const OTP_MAX_SENDS = 5;
const OTP_SEND_WINDOW_SECONDS = 1800;

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

function normalizePhone(string $raw): ?string
{
    $number = str_replace(" ", "", trim($raw, " "));

    // The signup form sends the 10-digit national part; its +63 prefix is a fixed UI label.
    if (preg_match("/^9\d{9}$/", $number)) {
        $number = "+63" . $number;
    }

    if (!preg_match("/^\+639\d{9}$/", $number)) return null;
    return substr($number, 3);
}

function signupSessionHash(): string
{
    return hash("sha256", session_id());
}

function recordSignupAttempt(mysqli $conn, string $action, string $ip, ?string $email = null): void
{
    $stmt = $conn->prepare(
        "INSERT INTO audit_logs (action, module, record_type, ip_address, new_values)
         VALUES (?, 'signup', 'email_verification', ?, ?)"
    );
    $values = $email === null ? null : json_encode(["email" => $email], JSON_UNESCAPED_UNICODE);
    $stmt->bind_param("sss", $action, $ip, $values);
    $stmt->execute();
    $stmt->close();
}

function checkSignupIpLimit(mysqli $conn, string $action, string $ip, int $maximum): void
{
    $stmt = $conn->prepare(
        "SELECT COUNT(*) AS total FROM audit_logs
         WHERE action = ? AND module = 'signup' AND ip_address = ?
           AND created_at >= (NOW() - INTERVAL 30 MINUTE)"
    );
    $stmt->bind_param("ss", $action, $ip);
    $stmt->execute();
    $count = (int) ($stmt->get_result()->fetch_assoc()["total"] ?? 0);
    $stmt->close();
    if ($count >= $maximum) {
        fail($action === "signup_email_otp_send"
            ? "Too many code requests from this connection. Try again later."
            : "Too many verification attempts from this connection. Try again later.", 429);
    }
}

function sendSignupVerificationEmail(AppDatabase $db, string $email, string $name, string $otp): void
{
    $service = EmailService::fromApplicationConfig($db);
    $config = $service->configuration();
    if (($config["enabled"] ?? false) !== true
        || !is_string($config["queue_encryption_key"] ?? null)
        || strlen((string) $config["queue_encryption_key"]) !== 32) {
        throw new RuntimeException("Email verification delivery is unavailable.");
    }

    $notificationId = $service->enqueue([
        "notification_type" => "signup_email_verification",
        "recipient_email" => $email,
        "recipient_name" => $name,
        "sender" => "crm_notifications",
        "subject" => "Your Espinosilla's Kainan Verification Code",
        "template_key" => "email_verification",
        "template_data" => [
            "name" => $name,
            "code" => $otp,
        ],
        "dedupe_key" => "signup-email-otp:" . bin2hex(random_bytes(16)),
    ]);
    if ($notificationId === null || $notificationId <= 0) {
        throw new RuntimeException("Email verification could not be queued.");
    }

    $worker = new EmailQueueWorker($db, $service, $config);
    $worker->processOne($notificationId);

    $stmt = $db->prepare("SELECT delivery_status FROM notification_logs WHERE notification_id = ?");
    $stmt->execute([$notificationId]);
    $row = $stmt->fetch();
    $stmt->closeCursor();
    if (!$row || (string) $row["delivery_status"] !== "SENT") {
        throw new RuntimeException("Email verification delivery failed.");
    }
}

if ($_SERVER["REQUEST_METHOD"] !== "POST") {
    header("Allow: POST");
    fail("Method not allowed.", 405);
}

if (isset($_SESSION["user_id"])) {
    fail("You are already logged in.", 403);
}

$sessionToken = $_SESSION["signup_csrf_token"] ?? "";
$submittedToken = $_SERVER["HTTP_X_CSRF_TOKEN"] ?? "";
if (!is_string($sessionToken) || $sessionToken === ""
    || !is_string($submittedToken) || !hash_equals($sessionToken, $submittedToken)) {
    fail("Your session expired. Refresh the page and try again.", 403);
}

$action = (string) ($_POST["action"] ?? "");
$sessionHash = signupSessionHash();
$ip = (string) ($_SERVER["REMOTE_ADDR"] ?? "");
if (!filter_var($ip, FILTER_VALIDATE_IP)) $ip = "unknown";

try {
    switch ($action) {
        case "send_otp":
            $email = mb_strtolower(trim((string) ($_POST["email"] ?? "")));
            if ($email === "") {
                fail("Email address is required.", 422, ["field" => "email"]);
            }
            if (strlen($email) > 150 || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
                fail("Enter a valid email address.", 422, ["field" => "email"]);
            }

            $stmt = $conn->prepare("SELECT 1 FROM users WHERE email = ? LIMIT 1");
            $stmt->bind_param("s", $email);
            $stmt->execute();
            $taken = (bool) $stmt->get_result()->fetch_row();
            $stmt->close();
            if ($taken) {
                fail("This email address is already registered.", 409, ["field" => "email"]);
            }

            $stmt = $conn->prepare(
                "SELECT resend_available_at, created_at,
                        GREATEST(TIMESTAMPDIFF(SECOND, NOW(), resend_available_at), 0) AS resend_seconds
                 FROM signup_email_otps
                 WHERE session_hash = ? AND invalidated_at IS NULL AND used_at IS NULL
                 ORDER BY created_at DESC LIMIT 1"
            );
            $stmt->bind_param("s", $sessionHash);
            $stmt->execute();
            $latest = $stmt->get_result()->fetch_assoc();
            $stmt->close();

            if ($latest && (int) $latest["resend_seconds"] > 0) {
                $wait = (int) $latest["resend_seconds"];
                fail("Please wait {$wait} seconds before asking for a new code.", 429, ["resend_in" => $wait]);
            }

            $stmt = $conn->prepare(
                "SELECT COUNT(*) AS total FROM signup_email_otps
                 WHERE session_hash = ? AND created_at >= (NOW() - INTERVAL 30 MINUTE)"
            );
            $stmt->bind_param("s", $sessionHash);
            $stmt->execute();
            $sendCount = (int) ($stmt->get_result()->fetch_assoc()["total"] ?? 0);
            $stmt->close();
            if ($sendCount >= OTP_MAX_SENDS) {
                fail("Too many code requests. Try again in a few minutes.", 429);
            }

            checkSignupIpLimit($conn, "signup_email_otp_send", $ip, 10);
            recordSignupAttempt($conn, "signup_email_otp_send", $ip, $email);

            $otp = str_pad((string) random_int(0, 999999), OTP_LENGTH, "0", STR_PAD_LEFT);
            $otpHash = password_hash($otp, PASSWORD_DEFAULT);
            if (!is_string($otpHash)) {
                throw new RuntimeException("Could not secure verification code.");
            }

            $conn->begin_transaction();
            try {
                $stmt = $conn->prepare(
                    "UPDATE signup_email_otps SET invalidated_at = NOW()
                     WHERE session_hash = ? AND invalidated_at IS NULL
                       AND used_at IS NULL"
                );
                $stmt->bind_param("s", $sessionHash);
                $stmt->execute();
                $stmt->close();

                $sendCount++;
                $stmt = $conn->prepare(
                    "INSERT INTO signup_email_otps
                     (session_hash, email, otp_hash, expires_at, resend_available_at, attempts, send_count)
                     VALUES (?, ?, ?, DATE_ADD(NOW(), INTERVAL 5 MINUTE),
                             DATE_ADD(NOW(), INTERVAL 60 SECOND), 0, ?)"
                );
                $stmt->bind_param("sssi", $sessionHash, $email, $otpHash, $sendCount);
                $stmt->execute();
                $otpId = (int) $conn->insert_id;
                $stmt->close();
                $conn->commit();
            } catch (Throwable $e) {
                $conn->rollback();
                throw $e;
            }

            try {
                sendSignupVerificationEmail($db, $email, "Customer", $otp);
            } catch (Throwable $e) {
                $stmt = $conn->prepare(
                    "UPDATE signup_email_otps SET invalidated_at = NOW() WHERE signup_otp_id = ?"
                );
                $stmt->bind_param("i", $otpId);
                $stmt->execute();
                $stmt->close();
                error_log("Signup email verification delivery failed.");
                fail("We could not send the verification email. Please try again later.", 503);
            }

            $_SESSION["signup"] = [
                "otp_id" => $otpId,
                "email" => $email,
                "expires" => time() + OTP_TTL_SECONDS,
                "verified" => false,
            ];

            respond(200, [
                "success" => true,
                "message" => "Verification code sent.",
                "resend_in" => OTP_RESEND_SECONDS,
                "expires_in" => OTP_TTL_SECONDS,
            ]);

        case "verify_otp":
            $flow = $_SESSION["signup"] ?? null;
            if (!is_array($flow) || empty($flow["otp_id"]) || empty($flow["email"])) {
                fail("Request a verification code first.");
            }
            $otpId = (int) $flow["otp_id"];

            $stmt = $conn->prepare(
                "SELECT signup_otp_id, email, otp_hash, expires_at, attempts, verified_at, used_at, invalidated_at,
                        (expires_at <= NOW()) AS is_expired
                 FROM signup_email_otps
                 WHERE signup_otp_id = ? AND session_hash = ? LIMIT 1"
            );
            $stmt->bind_param("is", $otpId, $sessionHash);
            $stmt->execute();
            $record = $stmt->get_result()->fetch_assoc();
            $stmt->close();

            if (!$record || (string) $record["email"] !== (string) $flow["email"]
                || $record["verified_at"] !== null || $record["used_at"] !== null
                || $record["invalidated_at"] !== null) {
                fail("Request a new verification code.", 410, ["expired" => true]);
            }
            if ((int) $record["is_expired"] === 1) {
                fail("This code has expired. Request a new one.", 410, ["expired" => true]);
            }
            if ((int) $record["attempts"] >= OTP_MAX_ATTEMPTS) {
                fail("Too many wrong codes. Request a new one.", 429, ["expired" => true]);
            }

            $code = trim((string) ($_POST["code"] ?? ""));
            if (!preg_match('/^\d{6}$/', $code)) {
                fail("Enter all 6 digits.", 422, ["field" => "otp"]);
            }

            checkSignupIpLimit($conn, "signup_email_otp_verify", $ip, 30);
            recordSignupAttempt($conn, "signup_email_otp_verify", $ip, (string) $record["email"]);
            if (!password_verify($code, (string) $record["otp_hash"])) {
                $attempts = (int) $record["attempts"] + 1;
                $left = OTP_MAX_ATTEMPTS - $attempts;
                if ($left <= 0) {
                    $stmt = $conn->prepare(
                        "UPDATE signup_email_otps SET attempts = ?, invalidated_at = NOW()
                         WHERE signup_otp_id = ? AND invalidated_at IS NULL"
                    );
                    $stmt->bind_param("ii", $attempts, $otpId);
                    $stmt->execute();
                    $stmt->close();
                    fail("Too many wrong codes. Request a new one.", 429, ["expired" => true]);
                }
                $stmt = $conn->prepare(
                    "UPDATE signup_email_otps SET attempts = ? WHERE signup_otp_id = ?"
                );
                $stmt->bind_param("ii", $attempts, $otpId);
                $stmt->execute();
                $stmt->close();
                fail("That code is not correct. {$left} " . ($left === 1 ? "try" : "tries") . " left.", 422, ["field" => "otp"]);
            }

            $stmt = $conn->prepare(
                "UPDATE signup_email_otps SET verified_at = NOW()
                 WHERE signup_otp_id = ? AND session_hash = ? AND invalidated_at IS NULL
                   AND used_at IS NULL AND expires_at > NOW()"
            );
            $stmt->bind_param("is", $otpId, $sessionHash);
            $stmt->execute();
            if ($stmt->affected_rows !== 1) {
                $stmt->close();
                fail("This code is no longer valid. Request a new one.", 410, ["expired" => true]);
            }
            $stmt->close();

            $_SESSION["signup"]["verified"] = true;
            respond(200, ["success" => true, "message" => "Email address verified."]);

        case "create_account":
            $flow = $_SESSION["signup"] ?? null;
            if (!is_array($flow) || empty($flow["verified"]) || empty($flow["otp_id"])) {
                fail("Verify your email address first.", 403, ["restart" => true]);
            }

            $otpId = (int) $flow["otp_id"];
            $submittedEmail = mb_strtolower(trim((string) ($_POST["email"] ?? "")));
            if ($submittedEmail !== (string) $flow["email"]) {
                fail("The submitted email does not match the verified email. Verify it again.", 403, ["restart" => true]);
            }

            $fullName = trim(preg_replace("/\s+/", " ", (string) ($_POST["full_name"] ?? "")) ?? "");
            $username = trim((string) ($_POST["username"] ?? ""));
            $password = (string) ($_POST["password"] ?? "");
            $confirm = (string) ($_POST["confirm_password"] ?? "");
            $terms = ($_POST["terms"] ?? "") === "1";
            $phone = normalizePhone((string) ($_POST["phone"] ?? ""));

            $len = mb_strlen($fullName);
            if ($len < 2 || $len > 100) {
                fail("Enter your full name (2 to 100 characters).", 422, ["field" => "full_name"]);
            }
            if ($phone === null) {
                fail(trim((string) ($_POST["phone"] ?? "")) === ""
                    ? "Mobile number is required."
                    : "Enter a valid Philippine mobile number.", 422, ["field" => "phone"]);
            }
            if (!preg_match("/^[A-Za-z0-9_.]{4,30}$/", $username)) {
                fail($username === ""
                    ? "Username is required."
                    : "Use 4–30 characters: letters, numbers, periods, or underscores.", 422, ["field" => "username"]);
            }
            if ($password === "") {
                fail("Password is required.", 422, ["field" => "password"]);
            }
            $passwordError = passwordPolicyError($password);
            if ($passwordError !== null) {
                fail($passwordError, 422, ["field" => "password"]);
            }
            if (!hash_equals($password, $confirm)) {
                fail("Passwords do not match.", 422, ["field" => "confirm_password"]);
            }
            if (!$terms) {
                fail("Please agree to the Terms and Privacy Policy to continue.", 422, ["field" => "terms"]);
            }

            $e164Phone = "+63" . $phone;
            $conn->begin_transaction();
            try {
                $stmt = $conn->prepare(
                    "SELECT signup_otp_id FROM signup_email_otps
                     WHERE signup_otp_id = ? AND session_hash = ? AND email = ?
                       AND verified_at IS NOT NULL AND used_at IS NULL
                       AND invalidated_at IS NULL AND expires_at > NOW()
                     LIMIT 1"
                );
                $stmt->bind_param("iss", $otpId, $sessionHash, $submittedEmail);
                $stmt->execute();
                $verified = (bool) $stmt->get_result()->fetch_row();
                $stmt->close();
                if (!$verified) {
                    $conn->rollback();
                    fail("Verify your email address again before creating an account.", 403, ["restart" => true]);
                }

                $stmt = $conn->prepare(
                    "SELECT username, email, phone FROM users
                     WHERE username = ? OR email = ? OR phone = ? LIMIT 1"
                );
                $stmt->bind_param("sss", $username, $submittedEmail, $e164Phone);
                $stmt->execute();
                $dup = $stmt->get_result()->fetch_assoc();
                $stmt->close();
                if ($dup) {
                    $conn->rollback();
                    if (strcasecmp((string) $dup["username"], $username) === 0) {
                        fail("This username is already taken.", 409, ["field" => "username"]);
                    }
                    if (strcasecmp((string) $dup["email"], $submittedEmail) === 0) {
                        fail("This email address is already registered.", 409, ["field" => "email"]);
                    }
                    fail("That mobile number is already used by another account.", 409, ["field" => "phone"]);
                }

                $stmt = $conn->prepare("SELECT role_id FROM roles WHERE role_name = 'Customer' LIMIT 1");
                $stmt->execute();
                $role = $stmt->get_result()->fetch_assoc();
                $stmt->close();
                if (!$role) {
                    $conn->rollback();
                    error_log("Signup: roles table has no 'Customer' role.");
                    fail("Sign-up is not available right now. Please contact support.", 500);
                }

                $hash = password_hash($password, PASSWORD_DEFAULT);
                $roleId = (int) $role["role_id"];
                $stmt = $conn->prepare(
                    "INSERT INTO users
                     (full_name, username, email, phone, password_hash, role_id, account_status, email_verified_at)
                     VALUES (?, ?, ?, ?, ?, ?, 'Active', NOW())"
                );
                $stmt->bind_param("sssssi", $fullName, $username, $submittedEmail, $e164Phone, $hash, $roleId);
                $stmt->execute();
                $stmt->close();

                $stmt = $conn->prepare(
                    "UPDATE signup_email_otps SET used_at = NOW()
                     WHERE signup_otp_id = ? AND used_at IS NULL"
                );
                $stmt->bind_param("i", $otpId);
                $stmt->execute();
                $stmt->close();
                $conn->commit();
            } catch (mysqli_sql_exception $e) {
                if ((int) $e->getCode() === 1062) {
                    $conn->rollback();
                    $stmt = $conn->prepare(
                        "SELECT username, email, phone FROM users
                         WHERE username = ? OR email = ? OR phone = ? LIMIT 1"
                    );
                    $stmt->bind_param("sss", $username, $submittedEmail, $e164Phone);
                    $stmt->execute();
                    $duplicate = $stmt->get_result()->fetch_assoc();
                    $stmt->close();
                    if ($duplicate && strcasecmp((string) $duplicate["username"], $username) === 0) {
                        fail("This username is already taken.", 409, ["field" => "username"]);
                    }
                    if ($duplicate && strcasecmp((string) $duplicate["email"], $submittedEmail) === 0) {
                        fail("This email address is already registered.", 409, ["field" => "email"]);
                    }
                    if ($duplicate && (string) $duplicate["phone"] === $e164Phone) {
                        fail("That mobile number is already used by another account.", 409, ["field" => "phone"]);
                    }
                    fail("That username, email or mobile number is already used.", 409);
                }
                $conn->rollback();
                throw $e;
            }

            unset($_SESSION["signup"], $_SESSION["signup_sends"]);
            $_SESSION["signup_csrf_token"] = bin2hex(random_bytes(32));
            respond(201, [
                "success" => true,
                "message" => "Account created. You can log in now.",
                "redirect" => "login.php?registered=1",
            ]);

        default:
            fail("Unknown action.", 400);
    }
} catch (mysqli_sql_exception $e) {
    error_log("Signup database error: " . $e->getMessage());
    fail("Sign-up is temporarily unavailable. Please try again later.", 500);
} catch (Throwable $e) {
    error_log("Signup request failed.");
    fail("Sign-up is temporarily unavailable. Please try again later.", 500);
}
