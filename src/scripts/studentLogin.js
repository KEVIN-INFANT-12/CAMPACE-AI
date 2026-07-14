import { loginStudent } from "./studentAuth.js";

export function initStudentLoginPage() {
  const form = document.getElementById("studentLoginForm");
  const email = document.getElementById("email");
  const password = document.getElementById("password");
  const toggle = document.getElementById("passwordToggle");
  const submitBtn = document.getElementById("loginSubmit");
  const alert = document.getElementById("loginAlert");
  if (!form) return;

  toggle?.addEventListener("click", () => {
    const isHidden = password.type === "password";
    password.type = isHidden ? "text" : "password";
    toggle.setAttribute("aria-label", isHidden ? "Hide password" : "Show password");
    toggle.innerHTML = isHidden ? eyeOff() : eye();
  });

  [email, password].forEach((i) => {
    i.addEventListener("input", () => {
      clearError(i);
      alert?.classList.remove("is-visible");
    });
  });

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    alert?.classList.remove("is-visible");
    let valid = true;
    if (!email.value.trim()) { showError(email, "Email is required."); valid = false; }
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.value.trim())) { showError(email, "Enter a valid email."); valid = false; }
    if (!password.value) { showError(password, "Password is required."); valid = false; }
    if (!valid) return;

    setLoading(true);
    await new Promise((r) => setTimeout(r, 600));
    const res = await loginStudent(email.value, password.value);
    if (!res.ok) {
      setLoading(false);
      showAlert(res.error);
      return;
    }
    window.location.href = "/student-dashboard.html";
  });


  function showError(input, msg) {
    input.classList.add("is-invalid");
    const err = input.closest(".form-group")?.querySelector(".form-error");
    if (err) { err.querySelector("span").textContent = msg; err.classList.add("is-visible"); }
  }
  function clearError(input) {
    input.classList.remove("is-invalid");
    input.closest(".form-group")?.querySelector(".form-error")?.classList.remove("is-visible");
  }
  function showAlert(msg) {
    if (!alert) return;
    alert.querySelector("span").textContent = msg;
    alert.classList.add("is-visible");
  }
  function setLoading(loading) {
    if (loading) {
      submitBtn.disabled = true;
      submitBtn.innerHTML = `<span class="spinner" aria-hidden="true"></span> Signing In...`;
    } else {
      submitBtn.disabled = false;
      submitBtn.innerHTML = "Login";
    }
  }
}

function eye() { return `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>`; }
function eyeOff() { return `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9.88 9.88a3 3 0 1 0 4.24 4.24"/><path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68"/><path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61"/><line x1="2" x2="22" y1="2" y2="22"/></svg>`; }