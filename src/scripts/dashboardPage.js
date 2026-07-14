import { initReveal } from "./reveal.js";
import { initDashboard } from "./dashboard.js";
import { requireOfficer } from "./officerAuth.js";

function boot() {
  // Route protection: bounce to login when no officer session exists.
  if (!requireOfficer()) return;
  initReveal();
  initDashboard();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", boot);
} else {
  boot();
}