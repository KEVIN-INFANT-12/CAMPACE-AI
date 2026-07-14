import { initNavbar } from "./navbar.js";
import { initReveal } from "./reveal.js";
import { initLoginPage } from "./login.js";

function boot() {
  initNavbar();
  initReveal();
  initLoginPage();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", boot);
} else {
  boot();
}
