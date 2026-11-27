<?php
declare(strict_types=1);

/** Reset page opened from the emailed link: validates the token and saves a new password. */

mysqli_report(MYSQLI_REPORT_ERROR | MYSQLI_REPORT_STRICT);

// Shared session setup (secure cookie settings). Public page: an expired login just counts as logged out.
define("SESSION_NO_REDIRECT", true);
require_once __DIR__ . "/session-init.php";

require_once __DIR__ . "/config/database.php";
require_once __DIR__ . "/includes/password-policy.php";

if (empty($_SESSION["reset_csrf_token"])) {
    $_SESSION["reset_csrf_token"] = bin2hex(random_bytes(32));
}

$token = (string) ($_POST["token"] ?? $_GET["token"] ?? "");
$errorMessage = "";
$validToken = false;
$resetRow = null;

// A valid token is 64 hex characters, still unexpired, and belongs to an active user.
if (preg_match('/^[a-f0-9]{64}$/', $token) === 1) {
    try {
        $tokenHash = hash("sha256", $token);
        $statement = $conn->prepare(
            "SELECT r.reset_token_id, r.user_id
             FROM password_reset_tokens AS r
             INNER JOIN users AS u ON u.user_id = r.user_id
             WHERE r.token_hash = ? AND r.expires_at > NOW() AND r.used_at IS NULL AND u.account_status = 'Active'
             LIMIT 1"
        );
        $statement->bind_param("s", $tokenHash);
        $statement->execute();
        $resetRow = $statement->get_result()->fetch_assoc();
        $statement->close();
        $validToken = (bool) $resetRow;
    } catch (mysqli_sql_exception $e) {
        error_log("Reset lookup failed (database code " . $e->getCode() . ").");
        $errorMessage = "Password reset is temporarily unavailable. Please try again later.";
    }
}

if ($validToken && $_SERVER["REQUEST_METHOD"] === "POST") {
    $submittedCsrf = (string) ($_POST["csrf_token"] ?? "");
    $password = (string) ($_POST["password"] ?? "");
    $confirm = (string) ($_POST["confirm_password"] ?? "");

    if (!hash_equals($_SESSION["reset_csrf_token"], $submittedCsrf)) {
        $errorMessage = "Your session expired. Refresh the page and try again.";
    } elseif ($password === "") {
        $errorMessage = "Password is required.";
    } elseif (($passwordError = passwordPolicyError($password)) !== null) {
        $errorMessage = $passwordError;
    } elseif ($password !== $confirm) {
        $errorMessage = "Passwords do not match.";
    } else {
        $transactionOpen = false;
        try {
            $newHash = password_hash($password, PASSWORD_DEFAULT);
            $userId = (int) $resetRow["user_id"];
            $resetTokenId = (int) $resetRow["reset_token_id"];

            $conn->begin_transaction();
            $transactionOpen = true;

            $statement = $conn->prepare(
                "UPDATE password_reset_tokens
                 SET used_at = NOW()
                 WHERE reset_token_id = ? AND used_at IS NULL AND expires_at > NOW()"
            );
            $statement->bind_param("i", $resetTokenId);
            $statement->execute();
            $consumed = $statement->affected_rows === 1;
            $statement->close();

            if (!$consumed) {
                $conn->rollback();
                $transactionOpen = false;
                $validToken = false;
                $errorMessage = "This reset link is invalid or has expired.";
            } else {
                $statement = $conn->prepare(
                    "UPDATE users SET password_hash = ?, password_changed_at = NOW()
                     WHERE user_id = ? AND account_status = 'Active'"
                );
                $statement->bind_param("si", $newHash, $userId);
                $statement->execute();
                if ($statement->affected_rows !== 1) {
                    $statement->close();
                    throw new RuntimeException("Reset account is no longer active.");
                }
                $statement->close();

                // Invalidate any other outstanding reset links after this one is consumed.
                $statement = $conn->prepare(
                    "UPDATE password_reset_tokens SET used_at = NOW()
                     WHERE user_id = ? AND reset_token_id <> ? AND used_at IS NULL"
                );
                $statement->bind_param("ii", $userId, $resetTokenId);
                $statement->execute();
                $statement->close();

                $conn->commit();
                $transactionOpen = false;
                unset($_SESSION["reset_csrf_token"]);
                header("Location: login.php?reset=1");
                exit;
            }
        } catch (Throwable $e) {
            if ($transactionOpen) $conn->rollback();
            error_log("Reset save failed (" . get_class($e) . ", code " . $e->getCode() . ").");
            $errorMessage = "Could not update your password. Please try again.";
        }
    }
}
?>
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>CRM - Set New Password</title>

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
        <p class="description">Connecting our team and customers, all in one place.</p>
      </div>
    </section>

    <section class="login-panel d-flex flex-column justify-content-center">
      <div class="form-content w-100">
        <h1 class="fw-bold mb-3">
          <span class="reset-word">New</span>
          <span class="password-word">Password</span>
        </h1>

        <?php if ($errorMessage !== "") : ?>
          <div data-crm-toast="error" hidden><?= htmlspecialchars($errorMessage, ENT_QUOTES, "UTF-8") ?></div>
        <?php endif; ?>

        <?php if (!$validToken) : ?>
          <div class="alert alert-danger" role="alert">This reset link is invalid or has expired.</div>
          <a href="forgot-password.php" class="back-link align-self-start">Request a new link</a>
        <?php else : ?>
          <p class="reset-desc mb-4">Choose a new password for your account (at least 12 characters).</p>

          <form action="reset-password.php" method="POST" class="d-flex flex-column">
            <input type="hidden" name="csrf_token" value="<?= htmlspecialchars($_SESSION["reset_csrf_token"], ENT_QUOTES, "UTF-8") ?>">
            <input type="hidden" name="token" value="<?= htmlspecialchars($token, ENT_QUOTES, "UTF-8") ?>">

            <div class="mb-3">
              <label for="password" class="form-label">New Password</label>
              <div class="password-wrapper position-relative">
                <img src="icons/password-icon.svg" class="input-icon position-absolute" alt="Password Icon">
                <input type="password" id="password" name="password" class="form-control" autocomplete="new-password" minlength="12" required placeholder="Enter new password">

                <button type="button" class="toggle-password position-absolute border-0 bg-transparent" data-target="password" aria-label="Toggle password visibility">
                  <img src="icons/eye-closed.svg" class="eye-closed-icon" alt="Show Password">
                  <img src="icons/eye-open.svg" class="eye-open-icon" alt="Hide Password">
                </button>
              </div>
            </div>

            <div class="mb-3">
              <label for="confirm_password" class="form-label">Confirm Password</label>
              <div class="password-wrapper position-relative">
                <img src="icons/password-icon.svg" class="input-icon position-absolute" alt="Password Icon">
                <input type="password" id="confirm_password" name="confirm_password" class="form-control" autocomplete="new-password" minlength="12" required placeholder="Confirm new password">

                <button type="button" class="toggle-password position-absolute border-0 bg-transparent" data-target="confirm_password" aria-label="Toggle password visibility">
                  <img src="icons/eye-closed.svg" class="eye-closed-icon" alt="Show Password">
                  <img src="icons/eye-open.svg" class="eye-open-icon" alt="Hide Password">
                </button>
              </div>
            </div>

            <button type="submit" class="btn btn-submit rounded-pill w-100 fw-semibold mb-3">Save New Password</button>
            <a href="login.php" class="back-link align-self-start">← Back to Log in</a>
          </form>
        <?php endif; ?>
      </div>
    </section>

  </main>

  <script src="all-pages-js/loading.js"></script>
  <script>
    // Show/hide password toggles (eye-closed = hidden, eye-open = visible).
    document.querySelectorAll('.toggle-password').forEach(function (btn) {
      var input = document.getElementById(btn.dataset.target);
      var closed = btn.querySelector('.eye-closed-icon');
      var open = btn.querySelector('.eye-open-icon');
      function render() {
        var visible = input.type === 'text';
        closed.style.display = visible ? 'none' : 'block';
        open.style.display = visible ? 'block' : 'none';
      }
      btn.addEventListener('click', function () {
        input.type = input.type === 'password' ? 'text' : 'password';
        render();
      });
      render();
    });
  </script>
  <script src="all-pages-js/cookie-consent.js" defer></script>
<script src="all-pages-js/toast.js?v=2"></script>
</body>
</html>
