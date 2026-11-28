document.addEventListener("DOMContentLoaded", function () {
  var form = document.getElementById("forgotPasswordForm");
  var email = document.getElementById("email");
  var error = document.getElementById("forgotEmailError");
  if (!form || !email || !error) return;

  function validate() {
    var value = email.value.trim();
    var emailFormat = document.createElement("input");
    emailFormat.type = "email";
    emailFormat.value = value;
    var message = "";
    if (!value) {
      message = "Email address is required.";
    } else if (value.length > 150 || emailFormat.validity.typeMismatch) {
      message = "Enter a valid email address.";
    }

    error.textContent = message;
    email.classList.toggle("is-invalid", Boolean(message));
    if (message) email.setAttribute("aria-invalid", "true");
    else email.removeAttribute("aria-invalid");
    return !message;
  }

  email.addEventListener("blur", validate);
  email.addEventListener("input", function () {
    if (error.textContent || email.classList.contains("is-invalid")) validate();
  });
  form.addEventListener("submit", function (event) {
    event.preventDefault();
    if (!validate()) {
      email.focus();
      return;
    }
    form.submit();
  });
});
