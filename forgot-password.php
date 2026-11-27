<?php
declare(strict_types=1);

/** Forgot-password page: validates the request, stores a hashed token, and emails the reset link. */

mysqli_report(MYSQLI_REPORT_ERROR | MYSQLI_REPORT_STRICT);

// Shared session setup (secure cookie settings). Public page: an expired login just counts as logged out.
define("SESSION_NO_REDIRECT", true);
require_once __DIR__ . "/session-init.php";

require_once __DIR__ . "/config/database.php";
require_once __DIR__ . "/includes/Mail/EmailTemplateRenderer.php";
require_once __DIR__ . "/includes/Mail/EmailService.php";
require_once __DIR__ . "/includes/Mail/EmailQueueWorker.php";
$emailService = EmailService::fromApplicationConfig($db);
$mailConfig = $emailService->configuration();
$resetSender = $mailConfig["identities"]["crm_notifications"] ?? null;
$resetMailReady = ($mailConfig["enabled"] ?? false) === true
    && is_array($resetSender)
    && filter_var(trim((string) ($resetSender["email"] ?? "")), FILTER_VALIDATE_EMAIL) !== false
    && trim((string) ($resetSender["username"] ?? "")) !== ""
    && strcasecmp(trim((string) $resetSender["username"]), trim((string) $resetSender["email"])) === 0
    && trim((string) ($resetSender["password"] ?? "")) !== ""
    && is_string($mailConfig["queue_encryption_key"] ?? null)
    && strlen($mailConfig["queue_encryption_key"]) === 32
    && filter_var((string) ($mailConfig["base_url"] ?? ""), FILTER_VALIDATE_URL) !== false;

if (isset($_SESSION["user_id"])) {
    header("Location: index.php");
    exit;
}

if (empty($_SESSION["forgot_csrf_token"])) {
    $_SESSION["forgot_csrf_token"] = bin2hex(random_bytes(32));
}

$emailError = "";
$formError = "";
$successMessage = "";
$neutralResetMessage = "If an account exists with this email address, we'll send you a password reset link.";

if ($_SERVER["REQUEST_METHOD"] === "POST") {
    $submittedToken = $_POST["csrf_token"] ?? "";
    $sessionToken = $_SESSION["forgot_csrf_token"] ?? "";
    $submittedEmail = $_POST["email"] ?? "";
    $email = is_string($submittedEmail) ? trim($submittedEmail) : "";
    $requestStartedAt = hrtime(true);

    if (
        !is_string($submittedToken) ||
        !is_string($sessionToken) ||
        $sessionToken === "" ||
        !hash_equals($sessionToken, $submittedToken)
    ) {
        $formError = "Your session expired. Refresh the page and try again.";
        $_SESSION["forgot_csrf_token"] = bin2hex(random_bytes(32));
    } else {
        // Basic throttle per browser session: 10 lookups every 10 minutes.
        $now = time();
        $attempts = array_values(array_filter(
            (array) ($_SESSION["forgot_attempts"] ?? []),
            static fn($t) => is_int($t) && $t > $now - 600
        ));

        if ($email === "") {
            $emailError = "Email address is required.";
        } elseif (
            strlen($email) > 150 ||
            !filter_var($email, FILTER_VALIDATE_EMAIL)
        ) {
            $emailError = "Enter a valid email address.";
        } elseif (count($attempts) >= 10) {
            $formError = "Too many reset requests. Please try again later.";
        } elseif (!$resetMailReady) {
            // This is checked before account lookup so the service state is account-independent.
            $formError = "Password reset is temporarily unavailable. Please try again later.";
            error_log("Password reset mail service is disabled or not configured.");
        } else {
            $attempts[] = $now;
            $_SESSION["forgot_attempts"] = $attempts;

            try {
                $lookupEmail = mb_strtolower($email, "UTF-8");
                $statement = $conn->prepare(
                    "SELECT user_id, full_name, email, account_status AS status
                     FROM users
                     WHERE email = ?
                     LIMIT 1"
                );
                $statement->bind_param("s", $lookupEmail);
                $statement->execute();
                $user = $statement->get_result()->fetch_assoc();
                $statement->close();

                if ($user && $user["status"] === "Active") {
                    $userId = (int) $user["user_id"];

                    // Keep the per-account cooldown so repeated requests do not invalidate a recently sent link.
                    $statement = $conn->prepare(
                        "SELECT 1 FROM password_reset_tokens
                         WHERE user_id = ? AND used_at IS NULL AND created_at > (NOW() - INTERVAL 60 SECOND)
                         LIMIT 1"
                    );
                    $statement->bind_param("i", $userId);
                    $statement->execute();
                    $recent = $statement->get_result()->fetch_row();
                    $statement->close();

                    if (!$recent) {
                        $token = bin2hex(random_bytes(32));
                        $tokenHash = hash("sha256", $token);
                        $minutes = (int) $mailConfig["token_minutes"];
                        $conn->begin_transaction();
                        try {
                            $statement = $conn->prepare(
                                "UPDATE password_reset_tokens SET used_at = NOW()
                                 WHERE user_id = ? AND used_at IS NULL"
                            );
                            $statement->bind_param("i", $userId);
                            $statement->execute();
                            $statement->close();

                            $statement = $conn->prepare(
                                "INSERT INTO password_reset_tokens (user_id, token_hash, expires_at)
                                 VALUES (?, ?, DATE_ADD(NOW(), INTERVAL ? MINUTE))"
                            );
                            $statement->bind_param("isi", $userId, $tokenHash, $minutes);
                            $statement->execute();
                            $statement->close();

                            $link = rtrim($mailConfig["base_url"], "/") . "/reset-password.php?token=" . rawurlencode($token);
                            $notificationId = $emailService->enqueue([
                                "notification_type" => "password_reset",
                                "recipient_email" => (string) $user["email"],
                                "recipient_name" => (string) $user["full_name"],
                                "user_id" => $userId,
                                "sender" => "crm_notifications",
                                "subject" => "Reset your password",
                                "template_key" => "password_reset",
                                "template_data" => [
                                    "name" => (string) $user["full_name"],
                                    "reset_url" => $link,
                                    "expires_minutes" => $minutes,
                                ],
                                "dedupe_key" => "password-reset:" . $userId . ":" . $tokenHash,
                                "related_record_type" => "user",
                                "related_record_id" => $userId,
                            ]);
                            if ($notificationId < 1) {
                                throw new RuntimeException("Password reset notification was not queued.");
                            }
                            $conn->commit();
                        } catch (Throwable $e) {
                            $conn->rollback();
                            throw $e;
                        }

                        // Process only this request's notification; never drain earlier customer messages here.
                        try {
                            $worker = new EmailQueueWorker($db, $emailService, $mailConfig);
                            $worker->processOne($notificationId);
                            $statusStatement = $db->prepare(
                                "SELECT delivery_status FROM notification_logs
                                 WHERE notification_id = ? AND notification_type = 'password_reset'
                                 LIMIT 1"
                            );
                            $statusStatement->execute([$notificationId]);
                            $statusRow = $statusStatement->fetch();
                            $statusStatement->closeCursor();
                            $deliveryStatus = strtoupper((string) ($statusRow["delivery_status"] ?? "UNKNOWN"));
                            error_log("Password reset notification " . $notificationId . " status: " . $deliveryStatus . ".");
                        } catch (Throwable $deliveryError) {
                            error_log("Password reset notification delivery attempt failed (" . get_class($deliveryError) . ", code " . $deliveryError->getCode() . ").");
                        }
                    }
                }

                // No account, inactive account, cooldown, or accepted queue request share the same response.
                $successMessage = $neutralResetMessage;
            } catch (Throwable $e) {
                error_log("Password reset request processing failed (" . get_class($e) . ", code " . $e->getCode() . ").");
                $formError = "Password reset is temporarily unavailable. Please try again later.";
            }
        }
    }

    // Reduce timing differences between valid registered and unregistered email requests.
    if ($email !== "" && strlen($email) <= 150 && filter_var($email, FILTER_VALIDATE_EMAIL)) {
        $minimumDurationNs = 250_000_000;
        $remainingNs = $minimumDurationNs - (hrtime(true) - $requestStartedAt);
        if ($remainingNs > 0) {
            usleep((int) ($remainingNs / 1000));
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
  <link rel="stylesheet" href="all-pages-css/toast.css?v=2">
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
        <a href="login.php" class="su-link d-inline-block mb-2">&larr; Back to login</a>

        <h1 class="fw-bold mb-3">
          <span class="reset-word">Reset Your</span>
          <span class="password-word">Password</span>
        </h1>
        <p class="reset-desc mb-4">Enter your email address, and we'll send you a link to reset your password.</p>

        <form id="forgotPasswordForm" action="forgot-password.php" method="POST" class="d-flex flex-column" novalidate>
          <input type="hidden" name="csrf_token" value="<?= htmlspecialchars($_SESSION["forgot_csrf_token"] ?? "", ENT_QUOTES, "UTF-8") ?>">

          <?php if ($formError !== "") : ?>
            <div class="su-field-error mb-2" role="alert"><?= htmlspecialchars($formError, ENT_QUOTES, "UTF-8") ?></div>
          <?php endif; ?>

          <div class="mb-3">
            <label for="email" class="form-label">Email address</label>
            <div class="input-wrapper position-relative">
              <img src="icons/email-icon.svg" class="input-icon position-absolute" alt="Email Icon">
              <input type="email" id="email" name="email" class="form-control<?= $emailError !== "" ? " is-invalid" : "" ?>" autocomplete="email" maxlength="150" required placeholder="name@example.com" value="<?= htmlspecialchars($email ?? "", ENT_QUOTES, "UTF-8") ?>" aria-describedby="forgotEmailError" <?= $emailError !== "" ? 'aria-invalid="true"' : "" ?>>
            </div>
            <div class="su-field-error" id="forgotEmailError" aria-live="polite"><?= htmlspecialchars($emailError, ENT_QUOTES, "UTF-8") ?></div>
          </div>

          <?php if ($successMessage !== "") : ?>
            <div class="su-help mb-3" role="status"><?= htmlspecialchars($successMessage, ENT_QUOTES, "UTF-8") ?></div>
          <?php endif; ?>

          <button type="submit" class="btn btn-submit rounded-pill w-100 fw-semibold mb-3">Send Reset Link</button>

        </form>
      </div>
    </section>

  </main>

  <script src="all-pages-js/function-for-login.js"></script>
  <script src="all-pages-js/forgot-password.js"></script>
  <script src="all-pages-js/loading.js"></script>
  <script src="all-pages-js/cookie-consent.js" defer></script>
<script src="all-pages-js/toast.js?v=2"></script>
</body>
</html>
