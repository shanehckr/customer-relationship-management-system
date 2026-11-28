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
        $errorMessage = "Please enter a new password.";
    } elseif (($passwordError = passwordPolicyError($password)) !== null) {
        $errorMessage = $passwordError;
    } elseif ($confirm === "") {
        $errorMessage = "Please confirm your password.";
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
          <form action="reset-password.php" method="POST" class="d-flex flex-column" novalidate>
            <input type="hidden" name="csrf_token" value="<?= htmlspecialchars($_SESSION["reset_csrf_token"], ENT_QUOTES, "UTF-8") ?>">
            <input type="hidden" name="token" value="<?= htmlspecialchars($token, ENT_QUOTES, "UTF-8") ?>">

            <div class="mb-3">
              <label for="password" class="form-label">New Password</label>
              <div class="password-wrapper position-relative">
                <img src="icons/password-icon.svg" class="input-icon position-absolute" alt="Password Icon">
                <input type="password" id="password" name="password" class="form-control" autocomplete="new-password" minlength="12" maxlength="72" aria-describedby="resetPasswordHelp" required placeholder="Enter new password">

                <button type="button" class="toggle-password position-absolute border-0 bg-transparent" data-target="password" aria-label="Toggle password visibility">
                  <img src="icons/eye-closed.svg" class="eye-closed-icon" alt="Show Password">
                  <img src="icons/eye-open.svg" class="eye-open-icon" alt="Hide Password">
                </button>
              </div>
              <div class="su-help" id="resetPasswordHelp">Use at least 12 characters with uppercase and lowercase letters, a number, and a special character.</div>
              <div class="su-strength d-none" id="resetStrength" aria-live="polite">
                <div class="su-strength-track">
                  <div class="su-strength-bar" id="resetStrengthBar" role="progressbar" aria-labelledby="resetStrengthLabel" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0"></div>
                </div>
                <span class="su-strength-label" id="resetStrengthLabel"></span>
              </div>
              <div class="su-field-error" id="resetPasswordError" aria-live="polite"></div>
            </div>

            <div class="mb-3">
              <label for="confirm_password" class="form-label">Confirm Password</label>
              <div class="password-wrapper position-relative">
                <img src="icons/password-icon.svg" class="input-icon position-absolute" alt="Password Icon">
                <input type="password" id="confirm_password" name="confirm_password" class="form-control" autocomplete="new-password" minlength="12" maxlength="72" required placeholder="Confirm new password">

                <button type="button" class="toggle-password position-absolute border-0 bg-transparent" data-target="confirm_password" aria-label="Toggle password visibility">
                  <img src="icons/eye-closed.svg" class="eye-closed-icon" alt="Show Password">
                  <img src="icons/eye-open.svg" class="eye-open-icon" alt="Hide Password">
                </button>
              </div>
              <div class="su-field-error" id="resetConfirmError" aria-live="polite"></div>
            </div>

            <button type="submit" class="btn btn-submit rounded-pill w-100 fw-semibold mb-3">Save New Password</button>
            <a href="login.php" class="back-link back-nav align-self-start"><svg class="back-icon" viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m15 18-6-6 6-6"></path></svg><span>Back to Log in</span></a>
          </form>
        <?php endif; ?>
      </div>
    </section>

  </main>

  <script src="all-pages-js/loading.js"></script>
  <script>
    var resetForm = document.querySelector('form[action="reset-password.php"]');
    if (resetForm) {
      var resetPassword = document.getElementById("password");
      var resetConfirm = document.getElementById("confirm_password");
      var passwordErrorBox = document.getElementById("resetPasswordError");
      var confirmErrorBox = document.getElementById("resetConfirmError");
      var COMMON_PASSWORDS = [
        "password", "password1", "password12", "password123", "passw0rd",
        "passw0rd1", "passw0rd123", "qwerty", "qwerty123", "123456",
        "123456789", "1234567890", "111111", "000000", "abc123",
        "letmein", "welcome", "welcome1", "admin", "admin123", "iloveyou",
        "sunshine", "monkey", "dragon", "football", "master", "changeme",
        "trustno1", "secret", "login", "princess", "baseball", "asdfghjkl",
        "zxcvbnm", "access", "freedom", "hello", "whatever", "starwars"
      ];

      function passwordError(password) {
        var characters = Array.from(password);
        var normalized = password.toLowerCase()
          .replace(/@/g, "a").replace(/\$/g, "s").replace(/[^a-z0-9]/g, "");
        var leetNormalized = normalized.replace(/0/g, "o").replace(/1/g, "i")
          .replace(/3/g, "e").replace(/5/g, "s").replace(/7/g, "t");
        if (!password) return "Please enter a new password.";
        if (password.indexOf("\0") !== -1) return "Password cannot contain a null character.";
        if (characters.length < 12) return "Password must be at least 12 characters.";
        try {
          if (encodeURIComponent(password).replace(/%[A-F\d]{2}/gi, "x").length > 72) return "Password must be no more than 72 bytes.";
        } catch (e) {
          return "Password must contain valid text.";
        }
        if (!/[A-Z]/.test(password)) return "Password must include at least one uppercase letter (A-Z).";
        if (!/[a-z]/.test(password)) return "Password must include at least one lowercase letter (a-z).";
        if (!/[0-9]/.test(password)) return "Password must include at least one number (0-9).";
        if (!/[^A-Za-z0-9\s]/.test(password)) return "Password must include at least one special character.";
        if (COMMON_PASSWORDS.indexOf(normalized) !== -1 || COMMON_PASSWORDS.indexOf(leetNormalized) !== -1) {
          return "Choose a password that is not commonly used.";
        }
        return "";
      }

      function updateStrength(password) {
        var meter = document.getElementById("resetStrength");
        var bar = document.getElementById("resetStrengthBar");
        var label = document.getElementById("resetStrengthLabel");
        if (!password) {
          meter.classList.add("d-none");
          return;
        }

        var chars = Array.from(password);
        var pool = 0;
        if (/[a-z]/.test(password)) pool += 26;
        if (/[A-Z]/.test(password)) pool += 26;
        if (/[0-9]/.test(password)) pool += 10;
        if (/[^A-Za-z0-9\s]/.test(password)) pool += 32;
        var score = chars.length * Math.log2(Math.max(pool, 1));
        var normalized = password.toLowerCase()
          .replace(/@/g, "a").replace(/\$/g, "s").replace(/[^a-z0-9]/g, "");
        var leetNormalized = normalized.replace(/0/g, "o").replace(/1/g, "i")
          .replace(/3/g, "e").replace(/5/g, "s").replace(/7/g, "t");
        var commonFragments = ["password", "welcome", "qwerty", "admin", "letmein", "sunshine", "iloveyou"];
        if (commonFragments.some(function (fragment) { return normalized.indexOf(fragment) !== -1; })) score -= 30;

        var run = 1;
        var longestRun = 1;
        for (var i = 1; i < chars.length; i++) {
          var difference = chars[i].charCodeAt(0) - chars[i - 1].charCodeAt(0);
          run = Math.abs(difference) === 1 ? run + 1 : 1;
          longestRun = Math.max(longestRun, run);
        }
        if (longestRun >= 4) score -= (longestRun - 2) * 5;
        var unique = new Set(chars).size;
        if (unique < chars.length * 0.6) score -= (chars.length - unique) * 2;
        if (COMMON_PASSWORDS.indexOf(normalized) !== -1 || COMMON_PASSWORDS.indexOf(leetNormalized) !== -1) score = 0;

        var strength = score < 45 ? "Weak" : (score < 70 ? "Fair" : "Strong");
        var className = "is-" + strength.toLowerCase();
        var value = strength === "Weak" ? 33 : (strength === "Fair" ? 66 : 100);
        meter.classList.remove("is-weak", "is-fair", "is-strong", "d-none");
        meter.classList.add(className);
        bar.style.width = value + "%";
        bar.setAttribute("aria-valuenow", String(value));
        label.textContent = "Password strength: " + strength + ".";
      }

      function showPasswordError(input, box, message) {
        box.textContent = message;
        input.classList.toggle("is-invalid", Boolean(message));
        if (message) input.setAttribute("aria-invalid", "true");
        else input.removeAttribute("aria-invalid");
      }

      function validateNewPassword() {
        var message = passwordError(resetPassword.value);
        showPasswordError(resetPassword, passwordErrorBox, message);
        return message === "";
      }

      function validateConfirmation() {
        var message = !resetConfirm.value
          ? "Please confirm your password."
          : resetConfirm.value !== resetPassword.value ? "Passwords do not match." : "";
        showPasswordError(resetConfirm, confirmErrorBox, message);
        return message === "";
      }

      resetPassword.addEventListener("input", function () {
        updateStrength(resetPassword.value);
        if (resetPassword.dataset.touched === "1" || resetPassword.classList.contains("is-invalid")) validateNewPassword();
        if (resetConfirm.value || resetConfirm.dataset.touched === "1" || resetConfirm.classList.contains("is-invalid")) validateConfirmation();
      });
      resetConfirm.addEventListener("input", function () {
        if (resetConfirm.dataset.touched === "1" || resetConfirm.classList.contains("is-invalid")) validateConfirmation();
      });
      resetPassword.addEventListener("change", function () { updateStrength(resetPassword.value); });
      resetPassword.addEventListener("blur", function () {
        resetPassword.dataset.touched = "1";
        updateStrength(resetPassword.value);
        validateNewPassword();
        if (resetConfirm.value) validateConfirmation();
      });
      resetConfirm.addEventListener("blur", function () {
        resetConfirm.dataset.touched = "1";
        validateConfirmation();
      });
      resetForm.addEventListener("submit", function (event) {
        resetPassword.dataset.touched = "1";
        resetConfirm.dataset.touched = "1";
        updateStrength(resetPassword.value);
        var passwordValid = validateNewPassword();
        var confirmValid = validateConfirmation();
        if (!passwordValid || !confirmValid) {
          event.preventDefault();
          (passwordValid ? resetConfirm : resetPassword).focus();
        } else {
          resetForm.querySelector('[type="submit"]').disabled = true;
        }
      });
      updateStrength(resetPassword.value);
    }

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
