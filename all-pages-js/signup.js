/**
 * signup.js - Customer Sign-Up wizard (4 steps)
 *   1 email -> 2 OTP (sent by email, valid 5 minutes) -> 3 full name -> 4 mobile number / username / password
 * Talks to signup-api.php (send_otp, verify_otp, create_account).
 */
(function () {
  "use strict";

  var API = "signup-api.php";
  var form = document.getElementById("signupForm");
  if (!form) return;

  var csrf = form.getAttribute("data-csrf") || "";
  var $ = function (id) { return document.getElementById(id); };

  var steps = Array.prototype.slice.call(form.querySelectorAll(".su-step"));
  var dots = Array.prototype.slice.call(document.querySelectorAll(".su-dot"));
  var alertBox = $("suAlert");
  var otp = Array.prototype.slice.call(form.querySelectorAll(".otp-input"));

  var OTP_EXPIRY_SECONDS = 300;   // 5 minutes
  var RESEND_SECONDS = 30;

  var state = {
    step: 1,
    email: "",           // email entered in step 1
    verifiedEmail: "",   // set after step 2 succeeds
    resendLeft: 0,
    expiryLeft: 0,
    ticker: null,
    busy: false
  };

  /* ---------------- small helpers ---------------- */

  function showAlert(message, type) {
    if (window.crmToast) {
      var toastType = type === "success" ? "success" : (type === "warning" ? "warning" : (type === "info" ? "info" : "error"));
      window.crmToast(message, toastType);
      alertBox.classList.add("d-none");
      return;
    }
    console.error("CRM toast component was not loaded before sign-up messages.");
  }

  function clearAlert() {
    alertBox.classList.add("d-none");
    alertBox.textContent = "";
  }

  function showInlineAlert(message) {
    alertBox.textContent = message;
    alertBox.classList.remove("d-none");
    alertBox.focus();
  }

  var ERROR_INPUTS = {
    email: "suEmail",
    otp: null,
    full_name: "suFullName",
    phone: "suPhone",
    username: "suUsername",
    password: "suPassword",
    confirm_password: "suConfirm",
    terms: "suTerms"
  };
  var COMMON_PASSWORDS = [
    "password", "password1", "password12", "password123", "passw0rd",
    "passw0rd1", "passw0rd123", "qwerty", "qwerty123", "123456",
    "123456789", "1234567890", "111111", "000000", "abc123",
    "letmein", "welcome", "welcome1", "admin", "admin123", "iloveyou",
    "sunshine", "monkey", "dragon", "football", "master", "changeme",
    "trustno1", "secret", "login", "princess", "baseball", "asdfghjkl",
    "zxcvbnm", "access", "freedom", "hello", "whatever", "starwars"
  ];

  function setFieldError(field, message, shouldFocus) {
    var error = form.querySelector('[data-su-error-for="' + field + '"]');
    var input = ERROR_INPUTS[field] ? $(ERROR_INPUTS[field]) : (field === "otp" ? otp[0] : null);
    if (error) error.textContent = message;
    if (input) {
      input.classList.add("is-invalid");
      input.setAttribute("aria-invalid", "true");
      if (shouldFocus !== false) input.focus();
    }
    return false;
  }

  function usernameError(value) {
    var username = value.trim();
    if (!username) return "Username is required.";
    if (username.length < 4) return "Username must be at least 4 characters.";
    if (username.length > 30) return "Username cannot exceed 30 characters.";
    if (!/^[A-Za-z0-9_.]+$/.test(username)) return "Only letters, numbers, periods, and underscores are allowed.";
    return "";
  }

  function clearFieldError(field) {
    var error = form.querySelector('[data-su-error-for="' + field + '"]');
    var input = ERROR_INPUTS[field] ? $(ERROR_INPUTS[field]) : (field === "otp" ? otp[0] : null);
    if (error) error.textContent = "";
    if (input) {
      input.classList.remove("is-invalid");
      input.removeAttribute("aria-invalid");
    }
  }

  function setBusy(button, on, text) {
    state.busy = on;
    button.disabled = on;
    if (on) {
      button.setAttribute("data-label", button.textContent);
      button.textContent = text;
    } else if (button.hasAttribute("data-label")) {
      button.textContent = button.getAttribute("data-label");
      button.removeAttribute("data-label");
    }
  }

  function api(action, data, suppressGlobalLoader) {
    var body = new URLSearchParams();
    body.set("action", action);
    Object.keys(data || {}).forEach(function (key) { body.set(key, data[key]); });

    return fetch(API, {
      method: "POST",
      credentials: "same-origin",
      headers: { Accept: "application/json", "X-CSRF-Token": csrf },
      body: body,
      suppressGlobalLoader: suppressGlobalLoader === true
    })
      .then(function (response) {
        var status = response.status;
        return response.json().catch(function () {
          return { success: false, message: "Unexpected server response. Try again." };
        }).then(function (data) {
          data.status = status;
          return data;
        });
      })
      .catch(function () {
        return { success: false, message: "No connection. Check your internet and try again." };
      });
  }

  function passwordError(password) {
    var characters = Array.from(password);
    var normalized = password.toLowerCase()
      .replace(/@/g, "a").replace(/\$/g, "s").replace(/[^a-z0-9]/g, "");
    var leetNormalized = normalized.replace(/0/g, "o").replace(/1/g, "i")
      .replace(/3/g, "e").replace(/5/g, "s").replace(/7/g, "t");
    if (!password) return "Password is required.";
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
    var meter = $("suStrength");
    var bar = $("suStrengthBar");
    var label = $("suStrengthLabel");
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

  function clearIfCorrected(input) {
    if (input.classList.contains("otp-input")) {
      if (getCode().length === 6) clearFieldError("otp");
      return;
    }
    var fieldById = {
      suEmail: "email", suFullName: "full_name", suPhone: "phone", suUsername: "username",
      suPassword: "password", suConfirm: "confirm_password", suTerms: "terms"
    };
    var field = fieldById[input.id];
    if (!field) return;
    var valid = false;
    var error = form.querySelector('[data-su-error-for="' + field + '"]');
    if (field === "email") {
      var emailMessage = emailError(input.value);
      valid = emailMessage === "";
      if (!valid && error && error.textContent) error.textContent = emailMessage;
    }
    else if (field === "full_name") valid = input.value.replace(/\s+/g, " ").trim().length >= 2;
    else if (field === "phone") {
      var phoneMessage = phoneError(input.value);
      valid = phoneMessage === "";
      if (!valid) setFieldError("phone", phoneMessage, false);
    } else if (field === "username") {
      valid = usernameError(input.value) === "";
      if (!valid && error && error.textContent) error.textContent = usernameError(input.value);
    } else if (field === "password") {
      var message = passwordError(input.value);
      valid = message === "";
      if (!valid && error && error.textContent) error.textContent = message;
      updateStrength(input.value);
      if (valid && $("suConfirm").value === input.value) clearFieldError("confirm_password");
    } else if (field === "confirm_password") valid = input.value !== "" && input.value === $("suPassword").value;
    else if (field === "terms") valid = input.checked;
    if (valid) clearFieldError(field);
  }

  form.addEventListener("input", function (e) {
    if (e.target && e.target.classList) {
      if (e.target.id === "suEmail") {
        if (state.verifiedEmail && e.target.value.trim().toLowerCase() !== state.verifiedEmail) {
          state.verifiedEmail = "";
        }
        var emailErrorNode = form.querySelector('[data-su-error-for="email"]');
        if (emailErrorNode && emailErrorNode.textContent) {
          var emailMessage = emailError(e.target.value);
          if (emailMessage) setFieldError("email", emailMessage, false);
          else clearFieldError("email");
        }
      } else if (e.target.id === "suUsername") {
        var usernameErrorNode = form.querySelector('[data-su-error-for="username"]');
        if (usernameErrorNode && usernameErrorNode.textContent) {
          var message = usernameError(e.target.value);
          if (message) setFieldError("username", message, false);
          else clearFieldError("username");
        }
      } else clearIfCorrected(e.target);
    }
    if (alertBox.textContent === "Please complete the required fields.") clearAlert();
  });
  $("suUsername").addEventListener("blur", function () {
    var message = usernameError(this.value);
    var error = form.querySelector('[data-su-error-for="username"]');
    if (!message && error && error.textContent === "This username is already taken.") return;
    if (message) setFieldError("username", message, false);
    else clearFieldError("username");
  });
  $("suEmail").addEventListener("blur", function () {
    var message = emailError(this.value);
    var error = form.querySelector('[data-su-error-for="email"]');
    if (!message && error && error.textContent === "This email address is already registered.") return;
    if (message) setFieldError("email", message, false);
    else clearFieldError("email");
  });
  $("suTerms").addEventListener("change", function () { clearIfCorrected(this); });

  /* ---------------- steps ---------------- */

  function showStep(n) {
    state.step = n;
    var backButton = $("suBack");
    backButton.querySelector("span").textContent = n === 1 ? "Back to login" : "Back";
    backButton.setAttribute("aria-label", n === 1 ? "Back to login" : "Back to previous step");
    steps.forEach(function (s) {
      s.classList.toggle("is-active", Number(s.getAttribute("data-step")) === n);
    });
    dots.forEach(function (d) {
      var i = Number(d.getAttribute("data-dot"));
      d.classList.toggle("is-done", i < n);
      d.classList.toggle("is-current", i === n);
    });
    $("suCount").textContent = "Step " + n + " of 4";
    clearAlert();

    var focusId = { 1: "suEmail", 3: "suFullName", 4: "suPhone" }[n];
    if (focusId) $(focusId).focus();
    if (n === 2) otp[0].focus();
  }

  $("suBack").addEventListener("click", function () {
    if (state.busy) return;
    if (state.step === 1) window.location.href = "login.php";
    else showStep(state.step - 1);
  });

  Array.prototype.forEach.call(form.querySelectorAll("[data-back]"), function (btn) {
    btn.addEventListener("click", function () {
      showStep(Number(btn.getAttribute("data-back")));
    });
  });

  /* ---------------- step 1: email ---------------- */

  var emailInput = $("suEmail");
  var EMAIL_RE = /^[A-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Z0-9](?:[A-Z0-9-]{0,61}[A-Z0-9])?(?:\.[A-Z0-9](?:[A-Z0-9-]{0,61}[A-Z0-9])?)+$/i;

  function emailError(value) {
    var email = value.trim();
    if (!email) return "Email address is required.";
    if (email.length > 150 || !EMAIL_RE.test(email)) return "Enter a valid email address.";
    return "";
  }

  function maskEmail(addr) {
    var at = addr.indexOf("@");
    var name = addr.slice(0, at);
    var shown = name.slice(0, Math.min(2, name.length));
    return shown + "\u2022\u2022\u2022\u2022" + addr.slice(at);
  }

  function sendCode(isResend) {
    var address = emailInput.value.trim().toLowerCase();
    var emailMessage = emailError(address);
    if (emailMessage) {
      showStep(1);
      return setFieldError("email", emailMessage);
    }

    // already verified this exact email: no need for another code
    if (!isResend && state.verifiedEmail === address) {
      showStep(3);
      return;
    }

    var btn = isResend ? $("suResendBtn") : $("suSendBtn");
    if (isResend) {
      state.busy = true;
      btn.disabled = true;
      btn.innerHTML = '<span class="spinner-border spinner-border-sm me-2" aria-hidden="true"></span>Sending code...';
    } else {
      setBusy(btn, true, "Sending code...");
      btn.innerHTML = '<span class="spinner-border spinner-border-sm me-2" aria-hidden="true"></span>Sending code...';
    }

    api("send_otp", { email: address }, true).then(function (res) {
      if (isResend) {
        state.busy = false;
        renderTimers();
      } else {
        setBusy(btn, false);
      }

      if (!res.success) {
        if (res.resend_in) {
          state.resendLeft = res.resend_in;
          renderTimers();
        }
        if (res.field === "email") {
          if (isResend) {
            state.verifiedEmail = "";
            showStep(1);
          }
          setFieldError("email", res.message || "Enter a valid email address.");
          return;
        }
        showAlert(res.message || "We could not send the code. Try again.");
        return;
      }

      state.email = address;
      state.verifiedEmail = "";
      $("suMasked").textContent = maskEmail(address);
      clearOtp();
      // the code is valid for 5 minutes, whatever the server says
      startTimers(res.resend_in || RESEND_SECONDS, OTP_EXPIRY_SECONDS);
      showStep(2);
      if (isResend) showAlert("A new code was sent to your email.", "success");
    });
  }

  /* ---------------- phone helpers (used on step 4) ---------------- */

  var phoneInput = $("suPhone");

  function cleanPhone(raw) {
    var text = String(raw).trim();
    var d = text.replace(/\D/g, "");
    if (/^\+?63/.test(text) && d.indexOf("63") === 0) d = d.slice(2); // Avoid duplicating the UI's +63 prefix.
    return d.slice(0, 10);
  }

  function phoneError(raw) {
    var text = String(raw).trim();
    var digits = cleanPhone(raw);
    if (!digits) return text ? "Please enter a complete Philippine mobile number (+63 9XX XXX XXXX)." : "Mobile number is required.";
    if (digits.charAt(0) !== "9") return "Philippine mobile numbers must start with 9 after +63.";
    if (!/^9\d{9}$/.test(digits)) return "Please enter a complete Philippine mobile number (+63 9XX XXX XXXX).";
    return "";
  }

  function formatPhone(d) {
    return [d.slice(0, 3), d.slice(3, 6), d.slice(6)].filter(Boolean).join(" ");
  }

  phoneInput.addEventListener("input", function () {
    var value = phoneInput.value;
    var caret = phoneInput.selectionStart || 0;
    var digitsBeforeCaret = cleanPhone(value.slice(0, caret)).length;
    var digits = cleanPhone(value);
    var formatted = formatPhone(digits);
    if (value !== formatted) {
      phoneInput.value = formatted;
      var position = Math.min(digitsBeforeCaret, digits.length);
      if (position > 3) position++;
      if (position > 7) position++;
      phoneInput.setSelectionRange(position, position);
    }
  });

  /* ---------------- step 2: OTP ---------------- */

  function clearOtp() {
    otp.forEach(function (box) { box.value = ""; });
  }

  function getCode() {
    return otp.map(function (box) { return box.value; }).join("");
  }

  function fillOtp(digits, start) {
    for (var k = 0; k < digits.length && start + k < otp.length; k++) {
      otp[start + k].value = digits[k];
    }
    otp[Math.min(start + digits.length, otp.length - 1)].focus();
  }

  // the first box accepts a whole code (SMS autofill) and keeps only digit 1
  otp[0].maxLength = 6;

  otp.forEach(function (box, i) {
    box.addEventListener("input", function () {
      var v = box.value.replace(/\D/g, "");
      if (v.length > 1) {
        fillOtp(v, i);
        return;
      }
      box.value = v;
      if (v && i < otp.length - 1) otp[i + 1].focus();
    });

    box.addEventListener("keydown", function (e) {
      if (e.key === "Backspace" && !box.value && i > 0) {
        otp[i - 1].value = "";
        otp[i - 1].focus();
        e.preventDefault();
      } else if (e.key === "ArrowLeft" && i > 0) {
        otp[i - 1].focus();
        e.preventDefault();
      } else if (e.key === "ArrowRight" && i < otp.length - 1) {
        otp[i + 1].focus();
        e.preventDefault();
      }
    });

    box.addEventListener("paste", function (e) {
      var text = (e.clipboardData || window.clipboardData).getData("text").replace(/\D/g, "");
      if (text) {
        e.preventDefault();
        fillOtp(text, 0);
      }
    });

    box.addEventListener("focus", function () { box.select(); });
  });

  function formatTime(total) {
    var m = Math.floor(total / 60);
    var s = total % 60;
    return m + ":" + (s < 10 ? "0" : "") + s;
  }

  function renderTimers() {
    $("suExpiry").textContent = state.expiryLeft > 0
      ? "Code expires in " + formatTime(state.expiryLeft)
      : "This code has expired. Request a new one.";

    var verifyBtn = $("suVerifyBtn");
    if (!state.busy) verifyBtn.disabled = state.expiryLeft <= 0;

    var resend = $("suResendBtn");
    if (state.busy && resend.disabled) return;   // "Sending..." is showing
    if (state.resendLeft > 0) {
      resend.disabled = true;
      resend.textContent = "Resend code in " + state.resendLeft + "s";
    } else {
      resend.disabled = false;
      resend.textContent = "Resend code";
    }
  }

  function startTimers(resendIn, expiresIn) {
    state.resendLeft = resendIn;
    state.expiryLeft = expiresIn;
    renderTimers();
    clearInterval(state.ticker);
    state.ticker = setInterval(function () {
      if (state.resendLeft > 0) state.resendLeft--;
      if (state.expiryLeft > 0) state.expiryLeft--;
      renderTimers();
      if (state.resendLeft === 0 && state.expiryLeft === 0) clearInterval(state.ticker);
    }, 1000);
  }

  function verifyCode() {
    if (state.expiryLeft <= 0) {
      showAlert("This code has expired. Request a new one.");
      return;
    }
    var code = getCode();
    if (code.length !== 6) {
      setFieldError("otp", "Enter all 6 digits.");
      var empty = otp.filter(function (b) { return !b.value; })[0];
      (empty || otp[0]).focus();
      return;
    }

    var btn = $("suVerifyBtn");
    setBusy(btn, true, "Verifying...");

    api("verify_otp", { code: code }).then(function (res) {
      setBusy(btn, false);

      if (res.success) {
        state.verifiedEmail = state.email;
        clearInterval(state.ticker);
        showStep(3);
        return;
      }

      if (res.expired) {
        state.expiryLeft = 0;
        state.resendLeft = 0;
        clearInterval(state.ticker);
        renderTimers();
      }
      clearOtp();
      if (res.field === "otp") setFieldError("otp", res.message || "That code is not correct.");
      else showAlert(res.message || "That code is not correct.");
    });
  }

  $("suResendBtn").addEventListener("click", function () {
    if (!state.busy) sendCode(true);
  });

  $("suChangeEmail").addEventListener("click", function () {
    showStep(1);
  });

  /* ---------------- step 3: full name ---------------- */

  function goToCredentials() {
    var input = $("suFullName");
    var name = input.value.replace(/\s+/g, " ").trim();
    if (name.length < 2) {
      return setFieldError("full_name", "Enter your full name.");
    }
    input.value = name;
    showStep(4);
  }

  /* ---------------- step 4: credentials ---------------- */

  Array.prototype.forEach.call(form.querySelectorAll("[data-toggle-for]"), function (btn) {
    btn.addEventListener("click", function () {
      var input = $(btn.getAttribute("data-toggle-for"));
      var show = input.type === "password";
      input.type = show ? "text" : "password";
      btn.classList.toggle("visible", show);
      btn.setAttribute("aria-label", show ? "Hide password" : "Show password");
    });
  });

  var FIELD_IDS = {
    email: "suEmail",   // lives on step 1 (handled separately below)
    otp: null,
    full_name: "suFullName",
    phone: "suPhone",
    username: "suUsername",
    password: "suPassword",
    confirm_password: "suConfirm",
    terms: "suTerms"
  };

  function createAccount() {
    var phone = $("suPhone");
    var username = $("suUsername");
    var password = $("suPassword");
    var confirm = $("suConfirm");
    var terms = $("suTerms");

    var phoneDigits = cleanPhone(phone.value);
    var phoneMessage = phoneError(phone.value);
    if (phoneMessage) return setFieldError("phone", phoneMessage);
    var usernameMessage = usernameError(username.value);
    if (usernameMessage) return setFieldError("username", usernameMessage);
    var pw = password.value;
    var pwError = passwordError(pw);
    if (pwError) {
      return setFieldError("password", pwError);
    }
    if (confirm.value !== pw) {
      return setFieldError("confirm_password", "Passwords do not match.");
    }
    if (!terms.checked) {
      return setFieldError("terms", "Please agree to the Terms and Privacy Policy to continue.");
    }

    var btn = $("suCreateBtn");
    setBusy(btn, true, "Creating account...");

    api("create_account", {
      full_name: $("suFullName").value,
      email: state.verifiedEmail,
      phone: phoneDigits,
      username: username.value.trim(),
      password: pw,
      confirm_password: confirm.value,
      terms: "1"
    }).then(function (res) {
      if (res.success) {
        showAlert((res.message || "Account created.") + " Taking you to log in...", "success");
        setTimeout(function () {
          window.location.href = res.redirect || "login.php?registered=1";
        }, 900);
        return;   // button stays disabled while redirecting
      }

      setBusy(btn, false);

      if (res.restart) {
        state.verifiedEmail = "";
        showStep(1);
        showAlert(res.message);
        return;
      }
      if (res.step === 3) {
        showStep(3);
        setFieldError("full_name", res.message || "Enter your full name.");
        return;
      }
      if (res.field === "email") {
        state.verifiedEmail = "";
        showStep(1);
        setFieldError("email", res.message);
        return;
      }
      if (res.field === "full_name") {
        showStep(3);
        setFieldError("full_name", res.message);
        return;
      }
      if (res.field === "otp") {
        showStep(2);
        setFieldError("otp", res.message);
        return;
      }
      if (res.field && FIELD_IDS[res.field]) {
        setFieldError(res.field, res.message);
        return;
      }
      if (res.status === 422) {
        showInlineAlert("Please complete the required fields.");
        return;
      }
      showAlert(res.message || "We could not create your account. Try again.");
    });
  }

  /* ---------------- form submit = primary button of the visible step ---------------- */

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    if (state.busy) return;

    if (state.step === 1) sendCode(false);
    else if (state.step === 2) verifyCode();
    else if (state.step === 3) goToCredentials();
    else if (state.step === 4) createAccount();
  });

  showStep(1);
})();
