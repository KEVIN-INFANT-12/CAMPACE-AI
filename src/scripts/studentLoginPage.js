import { initNavbar } from "./navbar.js";
import { initReveal } from "./reveal.js";
import { initStudentLoginPage } from "./studentLogin.js";

function boot() {
  initNavbar();
  initReveal();
  initStudentLoginPage();
}

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
else boot();