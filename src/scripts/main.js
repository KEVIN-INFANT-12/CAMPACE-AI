import { initNavbar } from "./navbar.js";
import { initReveal } from "./reveal.js";
import { initCounters } from "./counters.js";
import { initChat } from "./chat.js";
import { renderFeatures, renderWorkflow, renderAnnouncements, wireFeatureCards } from "./content.js";
import { initHeroLive } from "./heroLive.js";

function boot() {
  renderFeatures();
  renderWorkflow();
  renderAnnouncements();
  wireFeatureCards();
  initHeroLive();
  initNavbar();
  initReveal();
  initCounters();
  initChat();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", boot);
} else {
  boot();
}