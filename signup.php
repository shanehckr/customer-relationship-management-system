<?php


/** Customer sign-up wizard. All steps are handled by js-InAllPages/signup.js + signup-api.php. */

// Shared session setup (secure cookie settings). Public page: an expired login just counts as logged out.
define("SESSION_NO_REDIRECT", true);
require_once __DIR__ . "/session-init.php";

// Logged-in users do not need to sign up.
if (isset($_SESSION["user_id"])) {
    header("Location: index.php");
    exit;
}

// CSRF token used by signup-api.php.
if (empty($_SESSION["signup_csrf_token"])) {
    $_SESSION["signup_csrf_token"] = bin2hex(random_bytes(32));
}
?>
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>CRM - Sign Up</title>

  <link rel="preload" as="image" href="background-picture/background-lightmode.png">
  <link rel="preload" as="image" href="background-picture/background-darkmode.png">

  <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css" rel="stylesheet">
     <link rel="stylesheet" href="all-pages-css/stylesheet-login.css">
     <link rel="stylesheet" href="all-pages-css/cookie-consent.css">
     <link rel="stylesheet" href="all-pages-css/toast.css?v=2">
  <script src="all-pages-js/theme.js"></script>
</head>
<body class="d-flex align-items-center justify-content-center min-vh-100 p-3 p-md-4">

  <main class="login-container signup-container position-relative d-flex overflow-hidden rounded-4 shadow-lg w-100">

    <button type="button" class="theme-toggle position-absolute border-0 bg-transparent p-0" id="themeToggle" aria-label="Switch theme">
      <img src="icons/sun-icon.svg" class="sun-icon" alt="Sun Icon">
      <img src="icons/moon-icon.svg" class="moon-icon" alt="Moon Icon">
    </button>

    <!-- Branding panel: hidden on phones by the CSS -->
    <section class="welcome-panel flex-grow-1 d-flex flex-column justify-content-start">
      <div class="welcome-content w-100">
        <p class="welcome-label fw-semibold text-uppercase">Welcome to</p>
        <h2 class="fw-bold">Create your customer account</h2>
        <div class="accent rounded-pill"></div>
        <p class="description">Send inquiries, review quotations, follow your bookings and reach support in one place.</p>
      </div>
    </section>

    <section class="login-panel d-flex flex-column justify-content-center">
      <div class="form-content w-100">

        <button type="button" class="su-link signup-back" id="suBack" aria-label="Back to login">&larr; Back to login</button>

        <h1 class="fw-bold mb-3">
          <span class="log-word">Sign</span>
          <span class="in-word">up</span>
        </h1>

        <!-- Progress: the 4 steps are a real sequence -->
        <ol class="su-progress" aria-label="Sign-up progress">
          <li class="su-dot is-current" data-dot="1"><span class="visually-hidden">Step 1: Email address</span></li>
          <li class="su-dot" data-dot="2"><span class="visually-hidden">Step 2: Verification code</span></li>
          <li class="su-dot" data-dot="3"><span class="visually-hidden">Step 3: Your name</span></li>
          <li class="su-dot" data-dot="4"><span class="visually-hidden">Step 4: Mobile number and account details</span></li>
        </ol>
        <p class="su-count" id="suCount" aria-live="polite">Step 1 of 4</p>

        <form id="signupForm" class="d-flex flex-column" novalidate autocomplete="off"
              data-csrf="<?= htmlspecialchars($_SESSION["signup_csrf_token"], ENT_QUOTES, "UTF-8") ?>">

          <div class="alert alert-danger d-none" id="suAlert" role="alert" tabindex="-1"></div>

          <!-- ============ STEP 1: email ============ -->
          <section class="su-step is-active" data-step="1" aria-labelledby="suTitle1">
            <h2 class="su-title" id="suTitle1">What's your email address?</h2>
            <p class="reset-desc su-desc">We'll email you a 6-digit code to confirm it's yours.</p>

            <div class="mb-3">
              <label for="suEmail" class="form-label">Email address</label>
              <div class="input-wrapper position-relative">
                <img src="icons/email-icon.svg" class="input-icon position-absolute" alt="">
                <input type="email" id="suEmail" name="email" class="form-control" autocomplete="email" maxlength="150" placeholder="name@example.com" aria-describedby="suEmailError" required>
              </div>
              <div class="su-field-error" id="suEmailError" data-su-error-for="email" aria-live="polite"></div>
            </div>

            <button type="submit" class="btn btn-submit rounded-pill w-100 fw-semibold" id="suSendBtn">Send Verification Code</button>

            <p class="auth-switch text-center mt-4 mb-0">
              Already have an account? <a href="login.php">Log in</a>
            </p>
          </section>

          <!-- ============ STEP 2: OTP ============ -->
          <section class="su-step" data-step="2" aria-labelledby="suTitle2">
            <h2 class="su-title" id="suTitle2">Enter the 6-digit code</h2>
            <p class="reset-desc su-desc">Sent to <strong id="suMasked">na••••@example.com</strong>. Check your inbox and spam folder.</p>

            <div class="mb-2">
              <label class="form-label" id="suOtpLabel">Verification code</label>
              <div class="otp-row" role="group" aria-labelledby="suOtpLabel">
                <input class="otp-input" type="text" inputmode="numeric" maxlength="1" autocomplete="one-time-code" aria-label="Digit 1">
                <input class="otp-input" type="text" inputmode="numeric" maxlength="1" aria-label="Digit 2">
                <input class="otp-input" type="text" inputmode="numeric" maxlength="1" aria-label="Digit 3">
                <input class="otp-input" type="text" inputmode="numeric" maxlength="1" aria-label="Digit 4">
                <input class="otp-input" type="text" inputmode="numeric" maxlength="1" aria-label="Digit 5">
                <input class="otp-input" type="text" inputmode="numeric" maxlength="1" aria-label="Digit 6">
              </div>
              <div class="su-field-error" data-su-error-for="otp" aria-live="polite"></div>
            </div>

            <p class="su-timer" role="timer">
              <span id="suExpiry">Code expires in 5:00</span>
            </p>

            <button type="submit" class="btn btn-submit rounded-pill w-100 fw-semibold" id="suVerifyBtn">Verify Code</button>

            <div class="su-links">
              <button type="button" class="su-link" id="suResendBtn" disabled>Resend code</button>
              <button type="button" class="su-link" id="suChangeEmail">Change Email</button>
            </div>
          </section>

          <!-- ============ STEP 3: name ============ -->
          <section class="su-step" data-step="3" aria-labelledby="suTitle3">
            <h2 class="su-title" id="suTitle3">What's your name?</h2>
            <p class="reset-desc su-desc">Your email is verified. Use the name you'd like on quotations and bookings.</p>

            <div class="mb-4">
              <label for="suFullName" class="form-label">Name</label>
              <div class="input-wrapper position-relative">
                <svg class="input-icon position-absolute" viewBox="0 0 24 24" fill="none" stroke="#000" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="8" r="3.6"/><path d="M4.5 20.5c.8-3.6 3.6-5.5 7.5-5.5s6.7 1.9 7.5 5.5"/></svg>
                <input type="text" id="suFullName" name="full_name" class="form-control" autocomplete="name" maxlength="100" placeholder="Enter your name" required>
              </div>
              <div class="su-field-error" data-su-error-for="full_name" aria-live="polite"></div>
            </div>

            <button type="submit" class="btn btn-submit rounded-pill w-100 fw-semibold" id="suContinueBtn">Continue</button>
            <button type="button" class="btn btn-su-secondary rounded-pill w-100 fw-semibold mt-2" data-back="2">Back</button>
          </section>

          <!-- ============ STEP 4: credentials ============ -->
          <section class="su-step" data-step="4" aria-labelledby="suTitle4">
            <h2 class="su-title" id="suTitle4">Set up your login</h2>
            <p class="reset-desc su-desc">You'll use these to log in next time.</p>

            <div class="mb-3">
              <label for="suPhone" class="form-label">Mobile number</label>
              <div class="input-wrapper position-relative">
                <svg class="input-icon position-absolute" viewBox="0 0 24 24" fill="none" stroke="#000" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="7" y="2.5" width="10" height="19" rx="2.5"/><path d="M11 18.5h2"/></svg>
                <span class="su-prefix" aria-hidden="true">+63</span>
                <input type="tel" id="suPhone" name="phone" class="form-control su-phone" inputmode="numeric"
                       autocomplete="tel-national" maxlength="20" placeholder="9XX XXX XXXX" aria-describedby="suPhoneHelp" required>
              </div>
              <div class="su-help" id="suPhoneHelp">Enter a Philippine mobile number (e.g., 917 123 4567).</div>
              <div class="su-field-error" data-su-error-for="phone" aria-live="polite"></div>
            </div>

            <div class="mb-3">
              <label for="suUsername" class="form-label">Username</label>
              <div class="input-wrapper position-relative">
                <svg class="input-icon position-absolute" viewBox="0 0 24 24" fill="none" stroke="#000" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="8" r="3.6"/><path d="M4.5 20.5c.8-3.6 3.6-5.5 7.5-5.5s6.7 1.9 7.5 5.5"/></svg>
                <input type="text" id="suUsername" name="username" class="form-control" autocomplete="username" maxlength="30" placeholder="Choose a username" aria-describedby="suUserHelp" required>
              </div>
              <div class="su-help" id="suUserHelp">4–30 characters. Use letters, numbers, periods, or underscores.</div>
              <div class="su-field-error" data-su-error-for="username" aria-live="polite"></div>
            </div>

            <div class="mb-3">
              <label for="suPassword" class="form-label">Password</label>
              <div class="password-wrapper position-relative">
                <img src="icons/password-icon.svg" class="input-icon position-absolute" alt="">
                <input type="password" id="suPassword" name="password" class="form-control" autocomplete="new-password" maxlength="72" placeholder="Create a password" aria-describedby="suPassHelp" required>
                <button type="button" class="toggle-password position-absolute border-0 bg-transparent" data-toggle-for="suPassword" aria-label="Show password">
                  <img src="icons/eye-closed.svg" class="eye-closed-icon" alt="">
                  <img src="icons/eye-open.svg" class="eye-open-icon" alt="">
                </button>
              </div>
              <div class="su-help" id="suPassHelp">Use at least 12 characters with uppercase and lowercase letters, a number, and a special character.</div>
              <div class="su-strength d-none" id="suStrength" aria-live="polite">
                <div class="su-strength-track">
                  <div class="su-strength-bar" id="suStrengthBar" role="progressbar" aria-labelledby="suStrengthLabel" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0"></div>
                </div>
                <span class="su-strength-label" id="suStrengthLabel"></span>
              </div>
              <div class="su-field-error" data-su-error-for="password" aria-live="polite"></div>
            </div>

            <div class="mb-3">
              <label for="suConfirm" class="form-label">Confirm password</label>
              <div class="password-wrapper position-relative">
                <img src="icons/password-icon.svg" class="input-icon position-absolute" alt="">
                <input type="password" id="suConfirm" name="confirm_password" class="form-control" autocomplete="new-password" maxlength="72" placeholder="Type the password again" required>
                <button type="button" class="toggle-password position-absolute border-0 bg-transparent" data-toggle-for="suConfirm" aria-label="Show password">
                  <img src="icons/eye-closed.svg" class="eye-closed-icon" alt="">
                  <img src="icons/eye-open.svg" class="eye-open-icon" alt="">
                </button>
              </div>
              <div class="su-field-error" data-su-error-for="confirm_password" aria-live="polite"></div>
            </div>

            <label class="su-terms" for="suTerms">
              <input type="checkbox" id="suTerms" class="su-check" name="terms" value="1">
              <span>I agree to the <a href="terms.php" target="_blank" rel="noopener">Terms and Privacy Policy</a>.</span>
            </label>
            <div class="su-field-error su-terms-error" data-su-error-for="terms" aria-live="polite"></div>

            <button type="submit" class="btn btn-submit rounded-pill w-100 fw-semibold" id="suCreateBtn">Create Account</button>
            <button type="button" class="btn btn-su-secondary rounded-pill w-100 fw-semibold mt-2" data-back="3">Back</button>
          </section>

        </form>
      </div>
    </section>

  </main>
  
  <script src="all-pages-js/toast.js?v=2"></script>
  <script src="all-pages-js/signup.js?v=2"></script>
    <script src="all-pages-js/loading.js"></script>
  <script src="all-pages-js/cookie-consent.js" defer></script>
</body>
</html>
