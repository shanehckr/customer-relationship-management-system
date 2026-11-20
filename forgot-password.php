<?php
declare(strict_types=1);

/** Forgot-password page: validates the request, stores a hashed token, and emails the reset link. */

use PHPMailer\PHPMailer\Exception as MailException;
use PHPMailer\PHPMailer\PHPMailer;

mysqli_report(MYSQLI_REPORT_ERROR | MYSQLI_REPORT_STRICT);

// Shared session setup (secure cookie settings). Public page: an expired login just counts as logged out.
define("SESSION_NO_REDIRECT", true);
require_once __DIR__ . "/session-init.php";

require_once __DIR__ . "/config/database.php";

// Load PHPMailer from Composer (vendor/) or from a manual download (phpmailer/src/).
if (is_file(__DIR__ . "/vendor/autoload.php")) {
    require_once __DIR__ . "/vendor/autoload.php";
} else {
    require_once __DIR__ . "/phpmailer/src/Exception.php";
    require_once __DIR__ . "/phpmailer/src/PHPMailer.php";
    require_once __DIR__ . "/phpmailer/src/SMTP.php";
}
$mailConfig = require __DIR__ . "/config/mail.php";

if (isset($_SESSION["user_id"])) {
    header("Location: index.php");
    exit;
}

if (empty($_SESSION["forgot_csrf_token"])) {
    $_SESSION["forgot_csrf_token"] = bin2hex(random_bytes(32));
}

$errorMessage = "";
$successMessage = "";

if ($_SERVER["REQUEST_METHOD"] === "POST") {
    $submittedToken = $_POST["csrf_token"] ?? "";
    $sessionToken = $_SESSION["forgot_csrf_token"] ?? "";

    if (
        !is_string($submittedToken) ||
        !is_string($sessionToken) ||
        $sessionToken === "" ||
        !hash_equals($sessionToken, $submittedToken)
    ) {
        $errorMessage = "Your session expired. Refresh the page and try again.";
        $_SESSION["forgot_csrf_token"] = bin2hex(random_bytes(32));
    } else {
        $email = trim((string) ($_POST["email"] ?? ""));

        // Basic throttle per browser session: 10 lookups every 10 minutes.
        $now = time();
        $attempts = array_values(array_filter(
            (array) ($_SESSION["forgot_attempts"] ?? []),
            static fn($t) => is_int($t) && $t > $now - 600
        ));

        if ($email === "") {
            $errorMessage = "Enter your email address.";
        } elseif (
            strlen($email) > 150 ||
            !filter_var($email, FILTER_VALIDATE_EMAIL) ||
            !preg_match('/@gmail\.com$/i', $email)
        ) {
            // Only real Gmail addresses are accepted (example.com, yahoo.com, etc. are rejected).
            $errorMessage = "Enter a valid Gmail address, like yourname@gmail.com.";
        } elseif (count($attempts) >= 10) {
            $errorMessage = "Too many attempts. Please try again in a few minutes.";
        } else {
            $attempts[] = $now;
            $_SESSION["forgot_attempts"] = $attempts;

            try {
                $statement = $conn->prepare(
                    "SELECT user_id, full_name, email, status
                     FROM users
                     WHERE email = ?
                     LIMIT 1"
                );
                $statement->bind_param("s", $email);
                $statement->execute();
                $user = $statement->get_result()->fetch_assoc();
                $statement->close();

                if (!$user) {
                    $errorMessage = "No account is registered with that email address.";
                } elseif ($user["status"] !== "Active") {
                    $errorMessage = "This account is inactive. Please contact support.";
                } else {
                    $userId = (int) $user["user_id"];

                    // Skip if a link was already requested in the last 60 seconds (prevents email spam).
                    $statement = $conn->prepare(
                        "SELECT 1 FROM password_resets
                         WHERE user_id = ? AND created_at > (NOW() - INTERVAL 60 SECOND)
                         LIMIT 1"
                    );
                    $statement->bind_param("i", $userId);
                    $statement->execute();
                    $recent = $statement->get_result()->fetch_row();
                    $statement->close();

                    if ($recent) {
                        $errorMessage = "A reset link was just sent. Please wait a minute before asking for another one.";
                    } else {
                        // Only the hash is stored; the raw token exists only in the email.
                        $token = bin2hex(random_bytes(32));
                        $tokenHash = hash("sha256", $token);
                        $minutes = (int) $mailConfig["token_minutes"];

                        $statement = $conn->prepare("DELETE FROM password_resets WHERE user_id = ?");
                        $statement->bind_param("i", $userId);
                        $statement->execute();
                        $statement->close();

                        $statement = $conn->prepare(
                            "INSERT INTO password_resets (user_id, token_hash, expires_at)
                             VALUES (?, ?, DATE_ADD(NOW(), INTERVAL ? MINUTE))"
                        );
                        $statement->bind_param("isi", $userId, $tokenHash, $minutes);
                        $statement->execute();
                        $statement->close();

                        $link = rtrim($mailConfig["base_url"], "/") . "/reset-password.php?token=" . $token;
                        $name = htmlspecialchars($user["full_name"], ENT_QUOTES, "UTF-8");

                        $mail = new PHPMailer(true);
                        try {
                            $mail->isSMTP();
                            $mail->Host = $mailConfig["host"];
                            $mail->SMTPAuth = true;
                            $mail->Username = $mailConfig["username"];
                            $mail->Password = $mailConfig["password"];
                            $mail->SMTPSecure = PHPMailer::ENCRYPTION_STARTTLS;
                            $mail->Port = (int) $mailConfig["port"];
                            $mail->CharSet = "UTF-8";

                            $mail->setFrom($mailConfig["from_email"], $mailConfig["from_name"]);
                            $mail->addAddress($user["email"], $user["full_name"]);

                            $mail->isHTML(true);
                            $mail->Subject = "Reset your Catering CRM password";
                            $mail->Body = "<p>Hi {$name},</p>"
                                . "<p>We received a request to reset your password. Click the button below to choose a new one. "
                                . "This link expires in {$minutes} minutes.</p>"
                                . "<p><a href=\"{$link}\" style=\"background:#d97706;color:#fff;padding:10px 20px;border-radius:20px;text-decoration:none;\">Reset Password</a></p>"
                                . "<p>Or copy this link into your browser:<br>{$link}</p>"
                                . "<p>If you didn't request this, you can safely ignore this email.</p>";
                            $mail->AltBody = "Hi {$user["full_name"]},\n\nReset your password using this link (expires in {$minutes} minutes):\n{$link}\n\nIf you didn't request this, ignore this email.";

                            $mail->send();

                            // Show only part of the address, like j***@gmail.com.
                            [$mailName, $mailDomain] = explode("@", (string) $user["email"], 2) + ["", ""];
                            $maskedEmail = mb_substr($mailName, 0, 1) . str_repeat("*", max(2, mb_strlen($mailName) - 1)) . "@" . $mailDomain;
                            $successMessage = "A password reset link has been sent to " . $maskedEmail
                                . ". The link expires in " . $minutes . " minutes.";
                        } catch (MailException $e) {
                            error_log("Password reset mail error: " . $mail->ErrorInfo);
                            $errorMessage = "We could not send the email right now. Please try again in a moment.";
                        }
                    }
                }
            } catch (mysqli_sql_exception $e) {
                error_log("Forgot password database error: " . $e->getMessage());
                http_response_code(500);
                $successMessage = "";
                $errorMessage = "Password reset is temporarily unavailable. Please try again later.";
            }
        }
    }
}
?>
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>CRM - Reset Password</title>

  <link rel="preload" as="image" href="background-picture/background-lightmode.png">
  <link rel="preload" as="image" href="background-picture/background-darkmode.png">

  <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css" rel="stylesheet">
  <link rel="stylesheet" href="all-pages-css/stylesheet-login.css">
  <link rel="stylesheet" href="all-pages-css/cookie-consent.css">
  <script src="all-pages-js/theme.js"></script>
  <script>
    if (sessionStorage.getItem('pageTransition') === 'true') {
      document.documentElement.classList.add('preload-transition');
    }
  </script>
</head>
<body class="d-flex align-items-center justify-content-center min-vh-100 p-3 p-md-4">

  <main class="login-container position-relative d-flex overflow-hidden rounded-4 shadow-lg w-100">

    <button type="button" class="theme-toggle position-absolute border-0 bg-transparent p-0" id="themeToggle" aria-label="Switch theme">
      <img src="icons/sun-icon.svg" class="sun-icon" alt="Sun Icon">
      <img src="icons/moon-icon.svg" class="moon-icon" alt="Moon Icon">
    </button>

    <section class="welcome-panel flex-grow-1 d-flex flex-column justify-content-start">
      <div class="welcome-content w-100">
        <p class="welcome-label fw-semibold text-uppercase">Welcome to</p>
        <h2 class="fw-bold">Customer Management System</h2>
        <div class="accent rounded-pill"></div>
        <p class="description">Manage customers, streamline processes, grow together.</p>
      </div>
    </section>

    <section class="login-panel d-flex flex-column justify-content-center">
      <div class="form-content w-100">
        <h1 class="fw-bold mb-3">
          <span class="reset-word">Reset Your</span>
          <span class="password-word">Password</span>
        </h1>
        <p class="reset-desc mb-4">Enter your Gmail address, and we'll send you a link to reset your password.</p>

        <form action="forgot-password.php" method="POST" class="d-flex flex-column">
          <input type="hidden" name="csrf_token" value="<?= htmlspecialchars($_SESSION["forgot_csrf_token"] ?? "", ENT_QUOTES, "UTF-8") ?>">

          <?php if ($successMessage !== "") : ?>
            <div class="alert alert-success" role="status"><?= htmlspecialchars($successMessage, ENT_QUOTES, "UTF-8") ?></div>
          <?php endif; ?>

          <?php if ($errorMessage !== "") : ?>
            <div class="alert alert-danger" role="alert"><?= htmlspecialchars($errorMessage, ENT_QUOTES, "UTF-8") ?></div>
          <?php endif; ?>

          <div class="mb-3">
            <label for="email" class="form-label">Gmail</label>
            <div class="input-wrapper position-relative">
              <img src="icons/email-icon.svg" class="input-icon position-absolute" alt="Email Icon">
              <input type="email" id="email" name="email" class="form-control" autocomplete="email" maxlength="150" required placeholder="yourname@gmail.com">
            </div>
          </div>

          <button type="submit" class="btn btn-submit rounded-pill w-100 fw-semibold mb-3">Send Reset Link</button>

          <a href="login.php" class="back-link align-self-start">← Back to Log in</a>
        </form>
      </div>
    </section>

  </main>

  <script src="all-pages-js/function-for-login.js"></script>
  <script src="all-pages-js/loading.js"></script>
  <script src="all-pages-js/cookie-consent.js" defer></script>
</body>
</html>