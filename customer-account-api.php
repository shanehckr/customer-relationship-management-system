<?php
declare(strict_types=1);

/**
 * customer-account-api.php - the logged-in CUSTOMER manages their own account (Settings page).
 * Put it in the project root, next to login.php and settings-api.php.
 *
 *   GET  ?action=get             -> profile + csrf_token
 *   POST ?action=update_profile  -> full_name, phone
 *   POST ?action=email_request   -> email   (sends a 6-digit code to the NEW email through the Gmail API)
 *   POST ?action=email_verify    -> code    (changes the login email)
 *   POST ?action=photo_upload    -> photo   (jpg / png / webp, max 2 MB)
 *   POST ?action=photo_remove
 *   POST ?action=change_password -> current_password, new_password, confirm_password
 *
 * Every POST must send the csrf_token from "get" in the X-CSRF-Token header.
 * A customer can only ever read or change their OWN row: the id always comes from the session.
 */

mysqli_report(MYSQLI_REPORT_ERROR | MYSQLI_REPORT_STRICT);

// Shared session setup: secure cookie settings + 30-minute inactivity timeout (replies 401 "session_expired" as JSON).
define('SESSION_API', true);
require_once __DIR__ . '/session-init.php';

header("Content-Type: application/json; charset=utf-8");
header("Cache-Control: no-store");

function respond(int $status, array $data): void
{
    http_response_code($status);
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_INVALID_UTF8_SUBSTITUTE);
    exit;
}

// Any unexpected error comes back as JSON (never a blank page), and the details go to the PHP error log.
set_exception_handler(function (Throwable $e) {
    error_log("customer-account-api: " . $e->getMessage());
    respond(500, ["success" => false, "message" => "Something went wrong. Please try again."]);
});

if (empty($_SESSION["user_id"])) {
    respond(401, ["success" => false, "message" => "Please log in again."]);
}
if (strtolower(trim((string) ($_SESSION["role_name"] ?? ""))) !== "customer") {
    respond(403, ["success" => false, "message" => "This page is for customer accounts."]);
}

$userId = (int) $_SESSION["user_id"];
$action = (string) ($_GET["action"] ?? "");

if (empty($_SESSION["account_csrf_token"])) {
    $_SESSION["account_csrf_token"] = bin2hex(random_bytes(32));
}

function requirePost(): void
{
    if ($_SERVER["REQUEST_METHOD"] !== "POST") {
        respond(405, ["success" => false, "message" => "POST required."]);
    }
    $sent = (string) ($_SERVER["HTTP_X_CSRF_TOKEN"] ?? "");
    $mine = (string) ($_SESSION["account_csrf_token"] ?? "");
    if ($sent === "" || $mine === "" || !hash_equals($mine, $sent)) {
        respond(403, ["success" => false, "message" => "Your session expired. Refresh the page and try again."]);
    }
}

try {
    require_once __DIR__ . "/config/database.php";   // gives $conn (mysqli)

    // phone already exists in your users table; the profile photo needs one more column.
    $col = $conn->query("SHOW COLUMNS FROM users LIKE 'photo_path'");
    if ($col->num_rows === 0) {
        $conn->query("ALTER TABLE users ADD COLUMN photo_path VARCHAR(255) NULL DEFAULT NULL");
    }
    $col = $conn->query("SHOW COLUMNS FROM users LIKE 'phone'");
    if ($col->num_rows === 0) {
        $conn->query("ALTER TABLE users ADD COLUMN phone VARCHAR(20) NULL DEFAULT NULL");
    }
} catch (Throwable $e) {
    error_log("customer-account-api setup: " . $e->getMessage());
    respond(500, ["success" => false, "message" => "The account service is unavailable. Please try again later."]);
}

/* ------------------------------ helpers ------------------------------ */

function loadUser(mysqli $conn, int $id): array
{
    $st = $conn->prepare("SELECT user_id, full_name, username, email, phone, photo_path, password_hash FROM users WHERE user_id = ? LIMIT 1");
    $st->bind_param("i", $id);
    $st->execute();
    $row = $st->get_result()->fetch_assoc();
    $st->close();
    if (!$row) respond(404, ["success" => false, "message" => "Account not found."]);
    return $row;
}

function publicProfile(array $u): array
{
    $photo = null;
    if (!empty($u["photo_path"])) {
        $file = __DIR__ . "/" . $u["photo_path"];
        $photo = $u["photo_path"] . "?v=" . (is_file($file) ? (string) filemtime($file) : "1");
    }
    return [
        "full_name" => (string) $u["full_name"],
        "username" => (string) $u["username"],
        "email" => (string) $u["email"],
        "phone" => (string) ($u["phone"] ?? ""),
        "photo_url" => $photo,
    ];
}

/** +63 9XX XXX XXXX in any common typing style -> "+639XXXXXXXXX", or null when it is not a PH mobile number. */
function normalizePhone(string $raw): ?string
{
    $d = preg_replace('/\D+/', '', $raw);
    if (strpos($d, "63") === 0) $d = substr($d, 2);
    elseif (strpos($d, "0") === 0) $d = substr($d, 1);
    return preg_match('/^9\d{9}$/', $d) ? "+63" . $d : null;
}

function emailInUse(mysqli $conn, string $email, int $exceptId): bool
{
    $st = $conn->prepare("SELECT user_id FROM users WHERE email = ? AND user_id <> ? LIMIT 1");
    $st->bind_param("si", $email, $exceptId);
    $st->execute();
    $found = $st->get_result()->fetch_assoc() !== null;
    $st->close();
    return $found;
}

/** Sends the verification code with the same Gmail API settings as the payment email (gmail-rest-api.php). */
function sendCodeEmail(string $to, string $name, string $code): void
{
    $lib = __DIR__ . "/gmail-rest-api.php";
    if (!is_file($lib)) throw new RuntimeException("gmail-rest-api.php was not found.");
    require_once $lib;   // defines gmailHttp(), gmailAccessToken(), mimeHeader() and the MAIL_* / GMAIL_* settings

    $h = fn($v) => htmlspecialchars((string) $v, ENT_QUOTES, "UTF-8");
    $subject = "Your verification code: " . $code;
    $plain = "Hi " . $name . ",\n\nYour code to confirm your new email address is " . $code
           . ". It expires in 10 minutes.\n\nIf you did not ask for this, you can ignore this email.\n\n" . MAIL_FROM_NAME;
    $html = '<div style="font-family:Arial,sans-serif;max-width:480px;margin:auto;color:#222;">'
          . '<h2 style="color:#2e7d32;">Confirm your new email</h2>'
          . '<p>Hi ' . $h($name) . ',</p>'
          . '<p>Use this code to confirm your new email address:</p>'
          . '<p style="font-size:30px;letter-spacing:6px;font-weight:700;margin:16px 0;">' . $h($code) . '</p>'
          . '<p>It expires in 10 minutes. If you did not ask for this, you can ignore this email.</p>'
          . '<p style="color:#888;font-size:12px;">' . $h(MAIL_FROM_NAME) . '</p></div>';

    $clean = static fn(string $s) => str_replace(["\r", "\n", "<", ">", '"'], "", $s);
    $boundary = "b_" . bin2hex(random_bytes(12));
    $raw  = "From: " . mimeHeader(MAIL_FROM_NAME) . " <" . MAIL_FROM . ">\r\n";
    $raw .= "To: <" . $clean($to) . ">\r\n";
    $raw .= "Reply-To: " . MAIL_REPLY_TO . "\r\n";
    $raw .= "Subject: " . mimeHeader($subject) . "\r\n";
    $raw .= "MIME-Version: 1.0\r\n";
    $raw .= 'Content-Type: multipart/alternative; boundary="' . $boundary . "\"\r\n\r\n";
    $raw .= "--" . $boundary . "\r\nContent-Type: text/plain; charset=UTF-8\r\nContent-Transfer-Encoding: base64\r\n\r\n" . chunk_split(base64_encode($plain)) . "\r\n";
    $raw .= "--" . $boundary . "\r\nContent-Type: text/html; charset=UTF-8\r\nContent-Transfer-Encoding: base64\r\n\r\n" . chunk_split(base64_encode($html)) . "\r\n";
    $raw .= "--" . $boundary . "--\r\n";

    [$status, $json] = gmailHttp("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", [
        CURLOPT_POST => true,
        CURLOPT_POSTFIELDS => json_encode(["raw" => rtrim(strtr(base64_encode($raw), "+/", "-_"), "=")]),
        CURLOPT_HTTPHEADER => ["Authorization: Bearer " . gmailAccessToken(), "Content-Type: application/json"],
    ]);
    if ($status >= 300) throw new RuntimeException("Gmail API error (HTTP " . $status . "): " . ($json["error"]["message"] ?? "send failed"));
}

const PHOTO_DIR_REL = "uploads/profile";

function deleteOldPhoto(?string $rel): void
{
    if (!$rel || strpos($rel, PHOTO_DIR_REL . "/") !== 0) return;     // only ever touch our own folder
    $file = __DIR__ . "/" . PHOTO_DIR_REL . "/" . basename($rel);
    if (is_file($file)) @unlink($file);
}

/* ------------------------------ actions ------------------------------ */

if ($action === "get") {
    $u = loadUser($conn, $userId);
    respond(200, ["success" => true, "profile" => publicProfile($u), "csrf_token" => $_SESSION["account_csrf_token"]]);
}

if ($action === "update_profile") {
    requirePost();
    $name = trim(preg_replace('/\s+/u', " ", (string) ($_POST["full_name"] ?? "")));
    if (mb_strlen($name) < 2 || mb_strlen($name) > 100 || !preg_match('/^[\p{L}\p{M}][\p{L}\p{M} .\'’-]*$/u', $name)) {
        respond(422, ["success" => false, "field" => "full_name", "message" => "Enter your full name (letters only, 2 to 100 characters)."]);
    }
    $phone = normalizePhone((string) ($_POST["phone"] ?? ""));
    if ($phone === null) {
        respond(422, ["success" => false, "field" => "phone", "message" => "Enter a Philippine mobile number, for example 917 123 4567."]);
    }
    $st = $conn->prepare("SELECT user_id FROM users WHERE phone = ? AND user_id <> ? LIMIT 1");
    $st->bind_param("si", $phone, $userId);
    $st->execute();
    $taken = $st->get_result()->fetch_assoc() !== null;
    $st->close();
    if ($taken) respond(409, ["success" => false, "field" => "phone", "message" => "That mobile number is already used by another account."]);

    $st = $conn->prepare("UPDATE users SET full_name = ?, phone = ? WHERE user_id = ?");
    $st->bind_param("ssi", $name, $phone, $userId);
    $st->execute();
    $st->close();
    $_SESSION["full_name"] = $name;
    respond(200, ["success" => true, "message" => "Your details were saved.", "profile" => publicProfile(loadUser($conn, $userId))]);
}

if ($action === "email_request") {
    requirePost();
    $u = loadUser($conn, $userId);
    $new = strtolower(trim((string) ($_POST["email"] ?? "")));
    if ($new === "" || mb_strlen($new) > 150 || !filter_var($new, FILTER_VALIDATE_EMAIL)) {
        respond(422, ["success" => false, "field" => "email", "message" => "Enter a valid email address."]);
    }
    if (strtolower((string) $u["email"]) === $new) {
        respond(422, ["success" => false, "field" => "email", "message" => "That is already your email address."]);
    }
    if (emailInUse($conn, $new, $userId)) {
        respond(409, ["success" => false, "field" => "email", "message" => "That email is already used by another account."]);
    }
    $last = (int) ($_SESSION["email_change"]["sent_at"] ?? 0);
    if (time() - $last < 45) {
        respond(429, ["success" => false, "message" => "Please wait a moment before asking for another code."]);
    }

    $code = (string) random_int(100000, 999999);
    try {
        sendCodeEmail($new, (string) $u["full_name"], $code);
    } catch (Throwable $e) {
        error_log("Email change code failed for user " . $userId . ": " . $e->getMessage());
        respond(502, ["success" => false, "message" => "We could not send the code. Please try again in a moment."]);
    }
    $_SESSION["email_change"] = [
        "email" => $new,
        "hash" => password_hash($code, PASSWORD_DEFAULT),
        "expires" => time() + 600,
        "attempts" => 0,
        "sent_at" => time(),
    ];
    respond(200, ["success" => true, "message" => "We sent a 6-digit code to " . $new . ".", "email" => $new]);
}

if ($action === "email_verify") {
    requirePost();
    $pending = $_SESSION["email_change"] ?? null;
    if (!is_array($pending)) respond(422, ["success" => false, "message" => "Ask for a new code first."]);
    if (time() > (int) $pending["expires"]) {
        unset($_SESSION["email_change"]);
        respond(422, ["success" => false, "message" => "That code expired. Ask for a new one."]);
    }
    if ((int) $pending["attempts"] >= 5) {
        unset($_SESSION["email_change"]);
        respond(429, ["success" => false, "message" => "Too many wrong codes. Ask for a new one."]);
    }
    $code = preg_replace('/\D+/', "", (string) ($_POST["code"] ?? ""));
    if (!password_verify($code, (string) $pending["hash"])) {
        $_SESSION["email_change"]["attempts"] = (int) $pending["attempts"] + 1;
        respond(422, ["success" => false, "message" => "That code is not correct."]);
    }
    $new = (string) $pending["email"];
    if (emailInUse($conn, $new, $userId)) {
        unset($_SESSION["email_change"]);
        respond(409, ["success" => false, "message" => "That email was just taken by another account."]);
    }
    $st = $conn->prepare("UPDATE users SET email = ? WHERE user_id = ?");
    $st->bind_param("si", $new, $userId);
    $st->execute();
    $st->close();
    unset($_SESSION["email_change"]);
    respond(200, ["success" => true, "message" => "Your email address was updated. Use it the next time you log in.", "profile" => publicProfile(loadUser($conn, $userId))]);
}

if ($action === "photo_upload") {
    requirePost();
    $f = $_FILES["photo"] ?? null;
    if (!$f || $f["error"] === UPLOAD_ERR_NO_FILE) respond(422, ["success" => false, "message" => "Choose a photo first."]);
    if ($f["error"] !== UPLOAD_ERR_OK) respond(422, ["success" => false, "message" => "The photo could not be uploaded."]);
    if ($f["size"] > 2 * 1024 * 1024) respond(422, ["success" => false, "message" => "The photo must be 2 MB or smaller."]);
    $info = @getimagesize($f["tmp_name"]);
    $types = [IMAGETYPE_JPEG => "jpg", IMAGETYPE_PNG => "png", IMAGETYPE_WEBP => "webp"];
    if (!$info || !isset($types[$info[2]])) respond(422, ["success" => false, "message" => "Use a JPG, PNG or WEBP photo."]);

    $dir = __DIR__ . "/" . PHOTO_DIR_REL;
    if (!is_dir($dir) && !mkdir($dir, 0775, true)) respond(500, ["success" => false, "message" => "Could not create the uploads folder."]);
    $fileName = "u" . $userId . "-" . bin2hex(random_bytes(6)) . "." . $types[$info[2]];
    if (!move_uploaded_file($f["tmp_name"], $dir . "/" . $fileName)) respond(500, ["success" => false, "message" => "Could not save the photo."]);

    $old = loadUser($conn, $userId)["photo_path"] ?? null;
    $rel = PHOTO_DIR_REL . "/" . $fileName;
    $st = $conn->prepare("UPDATE users SET photo_path = ? WHERE user_id = ?");
    $st->bind_param("si", $rel, $userId);
    $st->execute();
    $st->close();
    deleteOldPhoto($old);
    respond(200, ["success" => true, "message" => "Profile photo updated.", "profile" => publicProfile(loadUser($conn, $userId))]);
}

if ($action === "photo_remove") {
    requirePost();
    $old = loadUser($conn, $userId)["photo_path"] ?? null;
    $st = $conn->prepare("UPDATE users SET photo_path = NULL WHERE user_id = ?");
    $st->bind_param("i", $userId);
    $st->execute();
    $st->close();
    deleteOldPhoto($old);
    respond(200, ["success" => true, "message" => "Profile photo removed.", "profile" => publicProfile(loadUser($conn, $userId))]);
}

if ($action === "change_password") {
    requirePost();
    $u = loadUser($conn, $userId);
    $current = (string) ($_POST["current_password"] ?? "");
    $new = (string) ($_POST["new_password"] ?? "");
    $confirm = (string) ($_POST["confirm_password"] ?? "");

    if ($current === "" || !password_verify($current, (string) $u["password_hash"])) {
        respond(422, ["success" => false, "field" => "current_password", "message" => "Your current password is not correct."]);
    }
    if (strlen($new) < 8 || strlen($new) > 72 || !preg_match('/[A-Z]/', $new) || !preg_match('/[a-z]/', $new) || !preg_match('/\d/', $new)) {
        respond(422, ["success" => false, "field" => "new_password", "message" => "The new password does not meet the requirements."]);
    }
    if ($new === $current) {
        respond(422, ["success" => false, "field" => "new_password", "message" => "The new password must be different from your current password."]);
    }
    if ($new !== $confirm) {
        respond(422, ["success" => false, "field" => "confirm_password", "message" => "The new passwords do not match."]);
    }
    $hash = password_hash($new, PASSWORD_DEFAULT);
    $st = $conn->prepare("UPDATE users SET password_hash = ? WHERE user_id = ?");
    $st->bind_param("si", $hash, $userId);
    $st->execute();
    $st->close();
    session_regenerate_id(true);
    respond(200, ["success" => true, "message" => "Your password was updated."]);
}

respond(400, ["success" => false, "message" => "Unknown action."]);