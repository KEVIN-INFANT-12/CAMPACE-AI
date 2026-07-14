import {
  listNotifications,
  markRead,
  markAllRead,
  clearAll,
  onNotificationsChange,
} from "./notifications.js";

const ICONS = {
  drive: "📢",
  announcement: "📢",
  interview: "📅",
  result: "🎉",
  application: "📝",
  profile: "👤",
  resume: "📄",
  info: "🔔",
};

const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

function fmtWhen(ts) {
  if (!ts) return "";
  const d = new Date(ts);
  if (isNaN(d.getTime())) return "";
  const diff = Date.now() - d.getTime();
  if (diff < 60_000) return "Just now";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return d.toLocaleString(undefined, { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

export function initNotificationBell({ mount, userType, userId }) {
  if (!mount) return;
  mount.innerHTML = `
    <div class="notif-wrap">
      <button type="button" class="notif-bell" id="notifBellBtn" aria-label="Notifications" aria-haspopup="true" aria-expanded="false">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
        <span class="notif-badge" hidden>0</span>
      </button>
      <div class="notif-panel" id="notifPanel" hidden role="dialog" aria-label="Notifications">
        <div class="notif-head">
          <strong>Notifications</strong>
          <div class="notif-head-actions">
            <button type="button" data-notif-mark-all>Mark all read</button>
            <button type="button" data-notif-clear>Clear all</button>
          </div>
        </div>
        <div class="notif-list" id="notifList"></div>
      </div>
    </div>`;

  const bell = mount.querySelector("#notifBellBtn");
  const panel = mount.querySelector("#notifPanel");
  const badge = mount.querySelector(".notif-badge");
  const list = mount.querySelector("#notifList");

  function render() {
    const items = listNotifications({ userType, userId });
    const unread = items.filter((n) => !n.isRead).length;
    if (unread > 0) {
      badge.hidden = false;
      badge.textContent = unread > 99 ? "99+" : String(unread);
    } else {
      badge.hidden = true;
    }
    list.innerHTML = items.length
      ? items.map((n) => `
          <div class="notif-item${n.isRead ? "" : " is-unread"}" data-notif-id="${esc(n.id)}">
            <div class="notif-item-icon" aria-hidden="true">${ICONS[n.type] || ICONS.info}</div>
            <div class="notif-item-body">
              <div class="notif-item-title">${esc(n.title)}</div>
              <div class="notif-item-msg">${esc(n.message)}</div>
              <div class="notif-item-foot">
                <time datetime="${new Date(n.createdAt).toISOString()}">${esc(fmtWhen(n.createdAt))}</time>
                ${n.isRead ? `<span class="notif-dot-read">Read</span>` : `<button type="button" data-notif-mark="${esc(n.id)}">Mark as read</button>`}
              </div>
            </div>
          </div>`).join("")
      : `<div class="notif-empty"><div class="notif-empty-title">No notifications.</div><div class="notif-empty-sub">You're all caught up.</div></div>`;
  }

  function openPanel(open) {
    panel.hidden = !open;
    bell.setAttribute("aria-expanded", String(!!open));
    if (open) render();
  }

  bell.addEventListener("click", (e) => {
    e.stopPropagation();
    openPanel(panel.hidden);
  });
  document.addEventListener("click", (e) => {
    if (!panel.hidden && !panel.contains(e.target) && !bell.contains(e.target)) openPanel(false);
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !panel.hidden) openPanel(false);
  });

  panel.addEventListener("click", (e) => {
    const m = e.target.closest("[data-notif-mark]");
    if (m) { markRead(m.dataset.notifMark); render(); return; }
    if (e.target.closest("[data-notif-mark-all]")) { markAllRead({ userType, userId }); render(); return; }
    if (e.target.closest("[data-notif-clear]")) { clearAll({ userType, userId }); render(); return; }
  });

  onNotificationsChange(render);
  render();
}