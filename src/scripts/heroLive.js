import { fetchHighlights, fetchUpcomingDrive, fetchLatestAnnouncement } from "./dataSource.js";

function setText(root, key, value) {
  const el = root.querySelector(`[data-key="${key}"]`);
  if (el != null && value != null) el.textContent = value;
}

async function renderHighlights() {
  const root = document.getElementById("heroHighlights");
  if (!root) return;
  try {
    const d = await fetchHighlights();
    setText(root, "activeDrives", d.activeDrives);
    setText(root, "applicationsToday", d.applicationsToday);
    setText(root, "offersReleased", d.offersReleased);
  } catch (_) { /* keep placeholders */ }
}

async function renderUpcomingDrive() {
  const root = document.getElementById("heroUpcomingDrive");
  const chip = document.getElementById("heroDriveDeadline");
  if (!root) return;
  try {
    const d = await fetchUpcomingDrive();
    setText(root, "initial", (d.company || "?").charAt(0).toUpperCase());
    setText(root, "company", d.company);
    setText(root, "role", d.role);
    if (chip && d.deadline) chip.textContent = d.deadline;
  } catch (_) { /* keep placeholders */ }
}

async function renderLatestAnnouncement() {
  const root = document.getElementById("heroLatestAnnouncement");
  const chip = document.getElementById("heroAnnDate");
  if (!root) return;
  try {
    const d = await fetchLatestAnnouncement();
    setText(root, "title", d.title);
    if (chip && d.date) chip.textContent = d.date;
  } catch (_) { /* keep placeholders */ }
}

export function initHeroLive() {
  renderHighlights();
  renderUpcomingDrive();
  renderLatestAnnouncement();
}