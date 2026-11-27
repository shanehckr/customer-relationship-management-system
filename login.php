<?php
declare(strict_types=1);

/** Authenticates users, verifies credentials, and initializes their sessions.*/

// Let MySQLi report database failures as exceptions.
mysqli_report(MYSQLI_REPORT_ERROR | MYSQLI_REPORT_STRICT);

// Configure the session before starting it or sending HTML.
ini_set("session.use_strict_mode", "1");
ini_set("session.use_only_cookies", "1");

session_set_cookie_params([
    "httponly" => true,
    "secure" => false,     // Local XAMPP uses HTTP; enable secure cookies under HTTPS.
    "samesite" => "Lax"
]);

session_start();

// Reuse the shared MySQLi connection.
require_once __DIR__ . "/config/database.php";

$errorMessage = "";

// Shown after a successful sign-up (signup-api.php redirects here with ?registered=1).
$successMessage = (($_GET["registered"] ?? "") === "1")
    ? "Account created. Log in with your new username and password."
    : ((($_GET["reset"] ?? "") === "1")
        ? "Password updated. Log in with your new password."
        : "");

// Redirect authenticated users to the protected app.
if (isset($_SESSION["user_id"])) {
    header("Location: index.php");
    exit;
}

// Create a CSRF token for the login form.
if (empty($_SESSION["login_csrf_token"])) {
    $_SESSION["login_csrf_token"] = bin2hex(random_bytes(32));
}

// Handle submitted login forms.
if ($_SERVER["REQUEST_METHOD"] === "POST") {
    $submittedToken = $_POST["csrf_token"] ?? "";
    $sessionToken = $_SESSION["login_csrf_token"] ?? "";

    // Reject requests with a missing or invalid CSRF token.
    if (
        !is_string($submittedToken) ||
        !is_string($sessionToken) ||
        $sessionToken === "" ||
        !hash_equals($sessionToken, $submittedToken)
    ) {
        $errorMessage = "Your session expired. Refresh the page and try again.";
        unset($_SESSION["login_csrf_token"]);
        $_SESSION["login_csrf_token"] = bin2hex(random_bytes(32));
    } else {
        $identifier = trim($_POST["identifier"] ?? "");
        $password = $_POST["password"] ?? "";

        if (
            !is_string($identifier) ||
            !is_string($password) ||
            $identifier === "" ||
            $password === ""
        ) {
            $errorMessage = "Enter your username or email and password.";
        } else {
            try {
                // Use a prepared statement for the login lookup.
                // Match the submitted username or email.
                $statement = $conn->prepare(
                    "SELECT
                        u.user_id,
                        u.full_name,
                        u.username,
                        u.email,
                        u.password_hash,
                        u.role_id,
                        u.account_status AS status,
                        u.failed_login_attempts,
                        u.locked_until,
                        r.role_name
                     FROM users AS u
                     INNER JOIN roles AS r ON r.role_id = u.role_id
                     WHERE u.username = ? OR u.email = ?
                     LIMIT 1"
                );

                $statement->bind_param(
                    "ss",
                    $identifier,
                    $identifier
                );

                $statement->execute();
                $user = $statement->get_result()->fetch_assoc();
                $statement->close();

                $isLocked = $user && !empty($user["locked_until"]) && strtotime($user["locked_until"]) > time();
                $validPassword = $user && password_verify($password, $user["password_hash"]);
                $loginOk = $user && !$isLocked && $validPassword && $user["status"] === "Active";
                $attemptedEmail = mb_substr($identifier, 0, 255);
                $ipAddress = mb_substr((string)($_SERVER["REMOTE_ADDR"] ?? ""), 0, 45);
                $attempt = $conn->prepare("INSERT INTO login_attempts (user_id, email_attempted, ip_address, success) VALUES (?, ?, ?, ?)");
                $attemptUserId = $user ? (int)$user["user_id"] : null;
                $attemptSuccess = $loginOk ? 1 : 0;
                $attempt->bind_param("issi", $attemptUserId, $attemptedEmail, $ipAddress, $attemptSuccess);
                $attempt->execute();
                $attempt->close();

                if (!$loginOk) {
                    if ($user && !$isLocked) {
                        $failure = $conn->prepare("UPDATE users SET
                            failed_login_attempts = LEAST(3, failed_login_attempts + 1),
                            locked_until = IF(failed_login_attempts >= 3, DATE_ADD(NOW(), INTERVAL 15 MINUTE), NULL),
                            last_failed_login_at = NOW()
                            WHERE user_id = ?");
                        $failure->bind_param("i", $user["user_id"]);
                        $failure->execute();
                        $failure->close();
                    }
                    $errorMessage = "Invalid username/email or password.";
                    $successMessage = "";
                } else {
                    $success = $conn->prepare("UPDATE users SET failed_login_attempts = 0, locked_until = NULL, last_login_at = NOW() WHERE user_id = ?");
                    $success->bind_param("i", $user["user_id"]);
                    $success->execute();
                    $success->close();
                    // Regenerate the session ID after authentication.
                    session_regenerate_id(true);

                    // Store identity and authorization data, never the submitted password.
                    $_SESSION["user_id"] = (int) $user["user_id"];
                    $_SESSION["full_name"] = $user["full_name"];
                    $_SESSION["username"] = $user["username"];
                    $_SESSION["role_id"] = (int) $user["role_id"];
                    $_SESSION["role_name"] = $user["role_name"];

                    // Remove the form token after successful authentication.
                    unset($_SESSION["login_csrf_token"]);

                    // Redirect to the protected app entry point.
                    header("Location: index.php");
                    exit;
                }
            } catch (mysqli_sql_exception $e) {
                // Log technical details privately; do not expose database errors to users.
                error_log("Login database error: " . $e->getMessage());
                http_response_code(500);
                $errorMessage = "Login is temporarily unavailable. Please try again later.";
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
  <title>CRM - Log In</title>


<link rel="preload" as="image" href="background-picture/background-lightmode.png">
<link rel="preload" as="image" href="background-picture/background-darkmode.png">


  <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css" rel="stylesheet">

  <link rel="stylesheet" href="all-pages-css/stylesheet-login.css">
  <link rel="stylesheet" href="all-pages-css/toast.css?v=2">
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
        <h1 class="fw-bold mb-4">
          <span class="log-word">Log</span>
          <span class="in-word">in</span>
        </h1>

        <form action="login.php" method="POST" class="d-flex flex-column">
          <input type="hidden" name="csrf_token" value="<?= htmlspecialchars($_SESSION["login_csrf_token"] ?? "", ENT_QUOTES, "UTF-8") ?>">

          <?php if ($successMessage !== "") : ?>
            <div data-crm-toast="success" hidden>
              <?= htmlspecialchars($successMessage, ENT_QUOTES, "UTF-8") ?>
            </div>
          <?php endif; ?>

          <?php if ($errorMessage !== "") : ?>
            <div data-crm-toast="error" hidden>
              <?= htmlspecialchars($errorMessage, ENT_QUOTES, "UTF-8") ?>
            </div>
          <?php endif; ?>


          <div class="mb-3">
            <label for="email" class="form-label">Username</label>
            <div class="input-wrapper position-relative">
              <img src="icons/email-icon.svg" class="input-icon position-absolute" alt="Email Icon">
              <input type="text" id="email" name="identifier" class="form-control" autocomplete="username" required placeholder="Enter your username or email">
            </div>
          </div>


          <div class="mb-2">
            <label for="password" class="form-label">Password</label>
            <div class="password-wrapper position-relative">
              <img src="icons/password-icon.svg" class="input-icon position-absolute" alt="Password Icon">
              <input type="password" id="password" name="password" class="form-control" autocomplete="current-password" required placeholder="Enter your password">


              <button type="button" class="toggle-password position-absolute border-0 bg-transparent" id="togglePassword" aria-label="Toggle password visibility">
                <img src="icons/eye-closed.svg" class="eye-closed-icon" alt="Show Password">
                <img src="icons/eye-open.svg" class="eye-open-icon" alt="Hide Password">
              </button>
            </div>
          </div>


          <a href="forgot-password.php" class="forgot text-end d-block mb-3">Forgot Password?</a>


          <button type="submit" class="btn btn-submit rounded-pill w-100 fw-semibold">Log in</button>

          <p class="auth-switch text-center mt-4 mb-0">
            Don't have an account? <a href="signup.php">Sign up</a>
          </p>
        </form>
      </div>
    </section>

  </main>


  <script src="all-pages-js/loading.js"></script>
  <script src="all-pages-js/function-for-login.js"></script>

<script src="all-pages-js/toast.js?v=2"></script>
</body>
</html>
