import { initNavbar } from "./navbar.js";
import { initReveal } from "./reveal.js";
import { initStudentRegisterPage } from "./studentRegister.js";

function boot() {
  initNavbar();
  initReveal();
  initStudentRegisterPage();
}

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
else boot();