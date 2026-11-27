/** Handles client-side interactions on the login interface.*/

document.addEventListener("DOMContentLoaded", () => {
  const formContent = document.querySelector(".login-panel .form-content");
  const loginForm = document.getElementById("loginForm");
  const identifierInput = document.getElementById("email");
  const togglePasswordBtn = document.getElementById("togglePassword");
  const passwordInput = document.getElementById("password");

  if (loginForm && identifierInput && passwordInput) {
    const identifierError = document.getElementById("loginIdentifierError");
    const passwordError = document.getElementById("loginPasswordError");
    const credentialMessage = "Invalid username/email or password.";

    function setInlineError(input, error, message) {
      error.textContent = message;
      input.classList.add("is-invalid");
      input.setAttribute("aria-invalid", "true");
    }

    function clearInlineError(input, error) {
      error.textContent = "";
      input.classList.remove("is-invalid");
      input.removeAttribute("aria-invalid");
    }

    function validateIdentifier() {
      if (!identifierInput.value.trim()) {
        setInlineError(identifierInput, identifierError, "Enter your username or email.");
        return false;
      }
      clearInlineError(identifierInput, identifierError);
      return true;
    }

    function validatePassword() {
      if (!passwordInput.value) {
        setInlineError(passwordInput, passwordError, "Enter your password.");
        return false;
      }
      clearInlineError(passwordInput, passwordError);
      return true;
    }

    identifierInput.addEventListener("blur", () => {
      if (passwordError.textContent === credentialMessage) return;
      validateIdentifier();
    });
    passwordInput.addEventListener("blur", () => {
      if (passwordError.textContent === credentialMessage) return;
      validatePassword();
    });

    [identifierInput, passwordInput].forEach((input) => {
      input.addEventListener("input", () => {
        if (passwordError.textContent === credentialMessage) {
          clearInlineError(identifierInput, identifierError);
          clearInlineError(passwordInput, passwordError);
        } else if (input === identifierInput && input.value.trim()) {
          clearInlineError(identifierInput, identifierError);
        } else if (input === passwordInput && input.value) {
          clearInlineError(passwordInput, passwordError);
        }
      });
    });

    loginForm.addEventListener("submit", (event) => {
      event.preventDefault();
      const identifierValid = validateIdentifier();
      const passwordValid = validatePassword();
      if (!identifierValid) {
        identifierInput.focus();
        return;
      }
      if (!passwordValid) {
        passwordInput.focus();
        return;
      }
      loginForm.submit();
    });

    const firstInvalid = loginForm.querySelector(".is-invalid");
    if (firstInvalid) firstInvalid.focus();
  }

  // Toggle password visibility when the eye button is clicked.
  if (togglePasswordBtn && passwordInput) {
    togglePasswordBtn.addEventListener("click", () => {
      const isPassword = passwordInput.type === "password";
      passwordInput.type = isPassword ? "text" : "password";
      togglePasswordBtn.classList.toggle("visible", isPassword);
    });
  }

  // Animate the form content as it appears.
  if (sessionStorage.getItem("pageTransition") === "true") {
    sessionStorage.removeItem("pageTransition");
    if (formContent) {
      setTimeout(() => {
        document.documentElement.classList.remove("preload-transition");
        formContent.classList.add("fade-in");
      }, 20);
    }
  }
});

(function () {
  if (window.__crmNoAutofillBound) return;
  window.__crmNoAutofillBound = true;

  const SKIP = ["hidden", "checkbox", "radio", "submit", "button", "reset", "file", "range", "color"];
  // Chrome often ignores autocomplete="off" on name / email / phone fields,
  // so those get a value it does not treat as an address field.
  const ADDRESS_LIKE = /name|email|phone|tel|address|username/i;
  let queued = false;

  function applyNoAutofill() {
    queued = false;
    document.querySelectorAll("form").forEach((form) => {
      if (form.getAttribute("autocomplete") !== "off") form.setAttribute("autocomplete", "off");
    });
    document.querySelectorAll("input, textarea").forEach((el) => {
      if (SKIP.includes(el.type)) return;
      let value;
      if (el.type === "password") value = "new-password";
      else if (el.type === "email" || el.type === "tel" || ADDRESS_LIKE.test((el.name || "") + " " + (el.id || ""))) value = "new-password";
      else value = "off";
      if (el.getAttribute("autocomplete") !== value) el.setAttribute("autocomplete", value);
      el.setAttribute("autocorrect", "off");
      el.setAttribute("spellcheck", "false");
    });
  }

  function queue() {
    if (queued) return;
    queued = true;
    requestAnimationFrame(applyNoAutofill);
  }

  function start() {
    applyNoAutofill();
    new MutationObserver(queue).observe(document.body, { childList: true, subtree: true });
    document.addEventListener("shown.bs.modal", applyNoAutofill);
  }

  if (document.body) start();
  else document.addEventListener("DOMContentLoaded", start);
})();
