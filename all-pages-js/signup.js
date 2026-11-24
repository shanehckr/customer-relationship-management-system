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

  function api(action, data) {
    var body = new URLSearchParams();
    body.set("action", action);
    Object.keys(data || {}).forEach(function (key) { body.set(key, data[key]); });

    return fetch(API, {
      method: "POST",
      credentials: "same-origin",
      headers: { Accept: "application/json", "X-CSRF-Token": csrf },
      body: body
    })
      .then(function (response) {
        return response.json().catch(function () {
          return { success: false, message: "Unexpected server response. Try again." };
        });
      })
      .catch(function () {
        return { success: false, message: "No connection. Check your internet and try again." };
      });
  }

  function markInvalid(input, message) {
    input.classList.add("is-invalid");
    input.setAttribute("aria-invalid", "true");
    showAlert(message);
    input.focus();
    return false;
  }

  form.addEventListener("input", function (e) {
    if (e.target && e.target.classList) {
      e.target.classList.remove("is-invalid");
      e.target.removeAttribute("aria-invalid");
    }
  });

  /* ---------------- steps ---------------- */

  function showStep(n) {
    state.step = n;
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

  Array.prototype.forEach.call(form.querySelectorAll("[data-back]"), function (btn) {
    btn.addEventListener("click", function () {
      showStep(Number(btn.getAttribute("data-back")));
    });
  });

  /* ---------------- step 1: email ---------------- */

  var emailInput = $("suEmail");
  var EMAIL_RE = /^[^\s@]+@gmail\.com$/i;   // Gmail only; use /^[^\s@]+@[^\s@]+\.[^\s@]+$/ to allow any provider

  function maskEmail(addr) {
    var at = addr.indexOf("@");
    var name = addr.slice(0, at);
    var shown = name.slice(0, Math.min(2, name.length));
    return shown + "\u2022\u2022\u2022\u2022" + addr.slice(at);
  }

  function sendCode(isResend) {
    var address = emailInput.value.trim().toLowerCase();
    if (!EMAIL_RE.test(address)) {
      showStep(1);
      return markInvalid(emailInput, "Enter a valid Gmail address, like yourname@gmail.com.");
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
      btn.textContent = "Sending...";
    } else {
      setBusy(btn, true, "Sending...");
    }

    api("send_otp", { email: address }).then(function (res) {
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
    var d = String(raw).replace(/\D/g, "");
    if (d.indexOf("63") === 0) d = d.slice(2);   // pasted +63 ...
    d = d.replace(/^0+/, "");                     // pasted 09...
    return d.slice(0, 10);
  }

  function formatPhone(d) {
    return [d.slice(0, 3), d.slice(3, 6), d.slice(6, 10)].filter(Boolean).join(" ");
  }

  phoneInput.addEventListener("input", function () {
    var formatted = formatPhone(cleanPhone(phoneInput.value));
    if (phoneInput.value !== formatted) phoneInput.value = formatted;
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
      showAlert("Enter all 6 digits.");
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
      otp[0].focus();
      showAlert(res.message || "That code is not correct.");
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
      return markInvalid(input, "Enter your full name.");
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
    if (!/^9\d{9}$/.test(phoneDigits)) {
      return markInvalid(phone, "Enter a valid Philippine mobile number, like 917 123 4567.");
    }
    if (!/^[A-Za-z0-9_.]{4,30}$/.test(username.value.trim())) {
      return markInvalid(username, "Username must be 4 to 30 characters: letters, numbers, dot or underscore.");
    }
    var pw = password.value;
    if (pw.length < 8 || pw.length > 72 || !/[A-Za-z]/.test(pw) || !/\d/.test(pw)) {
      return markInvalid(password, "Password needs at least 8 characters with a letter and a number.");
    }
    if (confirm.value !== pw) {
      return markInvalid(confirm, "The two passwords do not match.");
    }
    if (!terms.checked) {
      showAlert("Accept the Terms to create your account.");
      terms.focus();
      return;
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
        showAlert(res.message);
        return;
      }
      if (res.field === "email") {
        state.verifiedEmail = "";
        showStep(1);
        markInvalid(emailInput, res.message);
        return;
      }
      if (res.field && FIELD_IDS[res.field]) {
        markInvalid($(FIELD_IDS[res.field]), res.message);
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