// Shared UX helpers: empty states, skeletons, confirm dialog, button loading, toast.
import { showToast as _showToast } from "./exports.js";

const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => (
  { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]
));

// ---- Icons for empty states ----
const ICONS = {
  default: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 10h18"/></svg>`,
  drives:  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h16M4 12h16M4 17h10"/></svg>`,
  apps:    `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z"/><path d="M14 2v6h6"/></svg>`,
  interview: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>`,
  results: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2 15 8l6 .8-4.5 4.2L18 20l-6-3-6 3 1.5-7L3 8.8 9 8Z"/></svg>`,
  announce: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M3 11v2a2 2 0 0 0 2 2h3l6 4V5L8 9H5a2 2 0 0 0-2 2Z"/></svg>`,
  notifications: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M6 8a6 6 0 1 1 12 0c0 7 3 8 3 8H3s3-1 3-8"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/></svg>`,
  chat:    `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H8l-5 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2Z"/></svg>`,
  analytics: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3v18h18"/><path d="M7 15l4-4 3 3 5-6"/></svg>`,
  search:  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/></svg>`,
};

export function emptyState({ icon = "default", title, subtitle = "" } = {}) {
  const svg = ICONS[icon] || ICONS.default;
  return `<div class="empty-state" role="status">
    <div class="empty-icon" aria-hidden="true">${svg}</div>
    <div class="empty-title">${esc(title)}</div>
    ${subtitle ? `<div class="empty-sub">${esc(subtitle)}</div>` : ""}
  </div>`;
}

export function emptyRow(cols, opts) {
  return `<tr class="empty-row"><td colspan="${cols}">${emptyState(opts)}</td></tr>`;
}

// ---- Skeletons ----
export function skeletonRows(cols, rows = 4) {
  const lines = Array.from({ length: cols }, () => `<td><div class="skeleton skeleton-line md"></div></td>`).join("");
  return Array.from({ length: rows }, () => `<tr class="skeleton-row">${lines}</tr>`).join("");
}

export function skeletonCards(count = 3) {
  return Array.from({ length: count }, () => `
    <div class="skeleton-card">
      <div class="skeleton skeleton-line lg"></div>
      <div class="skeleton skeleton-line md"></div>
      <div class="skeleton skeleton-line sm"></div>
      <div class="skeleton skeleton-block"></div>
    </div>`).join("");
}

// ---- Toast (re-export) ----
export function toast(msg, tone = "success") { _showToast(msg, tone); }
export const showToast = _showToast;

// ---- Confirm dialog ----
let dialogRoot = null;
function ensureDialogRoot() {
  if (dialogRoot) return dialogRoot;
  dialogRoot = document.createElement("div");
  dialogRoot.className = "ux-dialog-root";
  dialogRoot.innerHTML = `
    <div class="ux-dialog-backdrop" data-ux-close></div>
    <div class="ux-dialog" role="dialog" aria-modal="true" aria-labelledby="uxDlgTitle">
      <div class="ux-dialog-head">
        <div class="ux-dialog-icon" data-ux-icon></div>
        <div class="ux-dialog-title" id="uxDlgTitle"></div>
      </div>
      <div class="ux-dialog-body" data-ux-body></div>
      <div class="ux-dialog-actions">
        <button type="button" class="btn btn-secondary" data-ux-cancel>Cancel</button>
        <button type="button" class="btn btn-danger" data-ux-confirm>Confirm</button>
      </div>
    </div>`;
  document.body.appendChild(dialogRoot);
  return dialogRoot;
}

const DANGER_ICON = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" width="20" height="20"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z"/><path d="M12 9v4M12 17h.01"/></svg>`;
const INFO_ICON = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" width="20" height="20"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></svg>`;

export function confirmDialog({
  title = "Are you sure?",
  message = "",
  confirmText = "Confirm",
  cancelText = "Cancel",
  tone = "danger",
} = {}) {
  const root = ensureDialogRoot();
  const dlg = root.querySelector(".ux-dialog");
  const iconWrap = root.querySelector("[data-ux-icon]");
  const btnConfirm = root.querySelector("[data-ux-confirm]");
  const btnCancel = root.querySelector("[data-ux-cancel]");
  root.querySelector("#uxDlgTitle").textContent = title;
  root.querySelector("[data-ux-body]").textContent = message;
  btnConfirm.textContent = confirmText;
  btnCancel.textContent = cancelText;
  dlg.classList.toggle("is-info", tone !== "danger");
  iconWrap.innerHTML = tone === "danger" ? DANGER_ICON : INFO_ICON;
  btnConfirm.className = "btn " + (tone === "danger" ? "btn-danger" : "btn-primary");

  return new Promise((resolve) => {
    const close = (v) => {
      root.classList.remove("is-open");
      document.removeEventListener("keydown", onKey);
      root.removeEventListener("click", onClick);
      resolve(v);
    };
    const onKey = (e) => {
      if (e.key === "Escape") close(false);
      if (e.key === "Enter") close(true);
    };
    const onClick = (e) => {
      if (e.target.closest("[data-ux-confirm]")) return close(true);
      if (e.target.closest("[data-ux-cancel]") || e.target.closest("[data-ux-close]")) return close(false);
    };
    root.classList.add("is-open");
    document.addEventListener("keydown", onKey);
    root.addEventListener("click", onClick);
    setTimeout(() => btnConfirm.focus(), 20);
  });
}

// ---- Button loading ----
export function setBtnLoading(btn, loadingText) {
  if (!btn || btn.dataset.uxLoading === "1") return;
  btn.dataset.uxLoading = "1";
  btn.dataset.uxOriginal = btn.innerHTML;
  btn.disabled = true;
  btn.classList.add("is-loading");
  btn.innerHTML = `<span class="btn-spinner" aria-hidden="true"></span>${esc(loadingText || "Processing...")}`;
}
export function resetBtn(btn) {
  if (!btn || btn.dataset.uxLoading !== "1") return;
  btn.disabled = false;
  btn.classList.remove("is-loading");
  btn.innerHTML = btn.dataset.uxOriginal || btn.innerHTML;
  delete btn.dataset.uxLoading;
  delete btn.dataset.uxOriginal;
}