document.addEventListener("DOMContentLoaded", () => {
  const formContent = document.querySelector(".login-panel .form-content");
  const togglePasswordBtn = document.getElementById("togglePassword");
  const passwordInput = document.getElementById("password");

  // Show or Hide Password when clicking the eye icon
  if (togglePasswordBtn && passwordInput) {
    togglePasswordBtn.addEventListener("click", () => {
      const isPassword = passwordInput.type === "password";
      passwordInput.type = isPassword ? "text" : "password";
      togglePasswordBtn.classList.toggle("visible", isPassword);
    });
  }

  // Smooth entrance animation for form content
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