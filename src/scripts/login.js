import { loginOfficer, currentOfficer } from "./officerAuth.js";

export function initLoginPage() {

  // If already signed in, skip the login screen.
  if (currentOfficer()) {
    window.location.replace("/officer-dashboard.html");
    return;
  }

  const form = document.getElementById("loginForm");
  const officerId = document.getElementById("officerId");
  const password = document.getElementById("password");
  const toggle = document.getElementById("passwordToggle");
  const submitBtn = document.getElementById("loginSubmit");
  const alert = document.getElementById("loginAlert");

  if (!form || !officerId || !password || !submitBtn) return;

  // Password show/hide toggle
  if (toggle) {
    toggle.addEventListener("click", () => {
      const isHidden = password.type === "password";
      password.type = isHidden ? "text" : "password";
      toggle.setAttribute("aria-label", isHidden ? "Hide password" : "Show password");
      toggle.innerHTML = isHidden ? eyeOffIcon() : eyeIcon();
    });
  }

  // Real-time validation cleanup
  [officerId, password].forEach((input) => {
    input.addEventListener("input", () => {
      clearFieldError(input);
      if (alert) alert.classList.remove("is-visible");
    });
  });

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (alert) alert.classList.remove("is-visible");

    const isValid = validateForm();
    if (!isValid) return;

    setLoading(true);

    // Simulate a short network delay so the loading state is visible.
    await new Promise((resolve) => setTimeout(resolve, 600));

    const result = await loginOfficer(officerId.value, password.value);
    if (!result.ok) {
      setLoading(false);
      showAlert(result.error || "Invalid Placement Officer credentials.");
      showFieldError(password, " ");
      return;
    }

    window.location.href = "/officer-dashboard.html";
  });

  function showAlert(message) {
    if (!alert) return;
    const span = alert.querySelector("span");
    if (span) span.textContent = message;
    alert.classList.add("is-visible");
  }

  function validateForm() {
    let valid = true;

    if (!officerId.value.trim()) {
      showFieldError(officerId, "Email address is required.");
      valid = false;
    }

    if (!password.value) {
      showFieldError(password, "Password is required.");
      valid = false;
    }

    return valid;
  }

  function showFieldError(input, message) {
    input.classList.add("is-invalid");
    const error = input.closest(".form-group")?.querySelector(".form-error");
    if (error) {
      error.querySelector("span").textContent = message;
      error.classList.add("is-visible");
    }
    input.setAttribute("aria-invalid", "true");
  }

  function clearFieldError(input) {
    input.classList.remove("is-invalid");
    const error = input.closest(".form-group")?.querySelector(".form-error");
    if (error) error.classList.remove("is-visible");
    input.removeAttribute("aria-invalid");
  }

  function setLoading(loading) {
    if (loading) {
      submitBtn.disabled = true;
      submitBtn.classList.add("is-loading");
      submitBtn.innerHTML = `<span class="spinner" aria-hidden="true"></span> Signing In...`;
      submitBtn.setAttribute("aria-busy", "true");
    } else {
      submitBtn.disabled = false;
      submitBtn.classList.remove("is-loading");
      submitBtn.innerHTML = `Login`;
      submitBtn.removeAttribute("aria-busy");
    }
  }
}

function eyeIcon() {
  return `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>`;
}

function eyeOffIcon() {
  return `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9.88 9.88a3 3 0 1 0 4.24 4.24"/><path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68"/><path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61"/><line x1="2" x2="22" y1="2" y2="22"/></svg>`;
}
