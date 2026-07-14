import { drives, announcements, interviews, results, activity, subscribe, getState } from "./store.js";
import { initNotificationBell } from "./notificationsUI.js";
import { notifyAllStudents, notifyStudentsByCompany } from "./notifications.js";
import {
  downloadCSV, downloadXLSX, showToast,
  buildAppFilename, buildSelectedFilename, buildRejectedFilename,
} from "./exports.js";
import { emptyState, emptyRow as uxEmptyRow, confirmDialog, setBtnLoading, resetBtn } from "./ux.js";
import { logoutOfficer, OFFICER_LOGIN_URL } from "./officerAuth.js";
import { initDepartmentMultiSelect } from "./multiSelect.js";
import { driveDepartments, formatDepartments, DEPARTMENTS as DEPARTMENTS_LIST } from "./departments.js";

// ---------- helpers ----------
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

import { supabase } from "./supabase.js";

let studentsList = [];
let applicationsList = [];

export async function loadOfficerData() {
  try {
    const [studentsRes, appsRes] = await Promise.all([
      supabase.from("profiles").select("*").eq("role", "student"),
      supabase.from("applications").select("*")
    ]);
    
    if (studentsRes.data) {
      studentsList = studentsRes.data.map(profile => ({
        id: profile.id,
        email: profile.email,
        fullName: profile.full_name,
        registerNumber: profile.register_number,
        department: profile.department,
        year: profile.year,
        cgpa: profile.cgpa,
        resumeUrl: profile.resume_url,
        resumeName: profile.resume_name,
        profilePicture: profile.profile_picture,
        phone: profile.phone,
        linkedin: profile.linkedin,
        github: profile.github,
      }));
    }
    
    if (appsRes.data) {
      applicationsList = appsRes.data;
    }
    
    renderAll();
  } catch (err) {
    console.error("Error loading officer data from Supabase:", err);
  }
}

// Automatically load on module run
loadOfficerData();

// Listen to realtime updates on profiles and applications
if (typeof window !== "undefined") {
  supabase
    .channel("officer-realtime")
    .on("postgres_changes", { event: "*", schema: "public" }, () => {
      loadOfficerData();
    })
    .subscribe();
}

function readStudents() {
  return studentsList;
}

function allApplications() {
  const students = readStudents();
  const stuById = new Map(students.map((s) => [s.id, s]));
  const driveList = drives.list();
  const driveById = new Map(driveList.map((d) => [d.id, d]));
  const out = [];
  
  applicationsList.forEach((a) => {
    const stu = stuById.get(a.student_id);
    const drive = driveById.get(a.drive_id);
    if (!stu || !drive) return;
    out.push({
      student: stu,
      drive,
      appliedAt: new Date(a.applied_at).getTime(),
      resumeUrl: a.resume_url || stu.resumeUrl || "",
    });
  });
  return out;
}

function formatDate(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

function formatDateTime(ts) {
  if (!ts) return "—";
  const d = new Date(ts);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function statusChip(status) {
  const map = {
    Open: "chip-success",
    "Closing Soon": "chip-warning",
    Upcoming: "chip-primary",
    Closed: "chip-danger",
    Published: "chip-success",
    Draft: "chip-warning",
  };
  return `<span class="chip ${map[status] || "chip-primary"}">${esc(status)}</span>`;
}

const ACTION_ICONS = {
  view: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12z"/><circle cx="12" cy="12" r="3"/></svg>`,
  edit: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 1 1 3 3L7 19l-4 1 1-4 12.5-12.5z"/></svg>`,
  del:  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-2 14a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2L5 6"/></svg>`,
};

function actionCell(entity, id) {
  return `<td class="actions">
    <button class="icon-btn" data-act="view" data-entity="${entity}" data-id="${id}" aria-label="View">${ACTION_ICONS.view}</button>
    <button class="icon-btn" data-act="edit" data-entity="${entity}" data-id="${id}" aria-label="Edit">${ACTION_ICONS.edit}</button>
    <button class="icon-btn danger" data-act="delete" data-entity="${entity}" data-id="${id}" aria-label="Delete">${ACTION_ICONS.del}</button>
  </td>`;
}

// Rich empty state row. `msgOrOpts` may be a legacy string, or
// { icon, title, subtitle } consumed by the shared ux.js helper.
function emptyRow(cols, msgOrOpts) {
  if (typeof msgOrOpts === "string") {
    return uxEmptyRow(cols, { icon: "default", title: msgOrOpts });
  }
  return uxEmptyRow(cols, msgOrOpts || {});
}
function emptyBlock(opts) { return emptyState(opts); }

// ---------- modal ----------
const modal = {
  root: null, title: null, body: null,
  init() {
    this.root = $("#modalRoot");
    this.title = $("#modalTitle");
    this.body = $("#modalBody");
    if (!this.root) return;
    this.root.addEventListener("click", (e) => {
      if (e.target.matches("[data-modal-close]") || e.target.closest("[data-modal-close]")) this.close();
    });
    document.addEventListener("keydown", (e) => { if (e.key === "Escape") this.close(); });
  },
  open(title, html) {
    this.title.textContent = title;
    this.body.innerHTML = html;
    this.root.classList.add("is-open");
    this.root.setAttribute("aria-hidden", "false");
  },
  close() {
    this.root.classList.remove("is-open");
    this.root.setAttribute("aria-hidden", "true");
    this.body.innerHTML = "";
  },
};

// ---------- renderers ----------
function renderDrives() {
  const list = drives.list();
  const rows = list.length
    ? list.map((d) => `
      <tr>
        <td>${esc(d.company)}</td>
        <td>${esc(d.eligibility)} · ${esc(formatDepartments(d))}</td>
        <td>${formatDate(d.deadline)}</td>
        <td>${statusChip(d.status)}</td>
        ${actionCell("drive", d.id)}
      </tr>`).join("")
    : emptyRow(5, { icon: "drives", title: "No placement drives available.", subtitle: "Click ‘Create Placement Drive’ to add one." });
  const drivesBody = $("#drivesBody");
  const recentBody = $("#recentDrivesBody");
  if (drivesBody) drivesBody.innerHTML = rows;
  if (recentBody) {
    const recent = list.slice(0, 5);
    recentBody.innerHTML = recent.length
      ? recent.map((d) => `
        <tr>
          <td>${esc(d.company)}</td>
          <td>${esc(d.eligibility)} · ${esc(formatDepartments(d))}</td>
          <td>${formatDate(d.deadline)}</td>
          <td>${statusChip(d.status)}</td>
          ${actionCell("drive", d.id)}
        </tr>`).join("")
      : emptyRow(5, { icon: "drives", title: "No recent drives yet.", subtitle: "New placement drives will appear here." });
  }
}

function renderAnnouncements() {
  const list = announcements.list();
  const body = $("#announcementsBody");
  if (!body) return;
  body.innerHTML = list.length
    ? list.map((a) => `
      <tr>
        <td>${esc(a.title)}</td>
        <td>${a.status === "Published" ? formatDate(a.publishedAt) : "—"}</td>
        <td>${statusChip(a.status)}</td>
        ${actionCell("announcement", a.id)}
      </tr>`).join("")
    : emptyRow(4, { icon: "announce", title: "No announcements.", subtitle: "Publish updates for students from this panel." });
}

function renderInterviews() {
  const body = $("#interviewsBody");
  if (!body) return;
  const list = interviews.list();
  body.innerHTML = list.length
    ? list.map((i) => `
      <tr>
        <td>${esc(i.company)}</td>
        <td>${formatDate(i.date)}</td>
        <td>${esc(i.time || "—")}</td>
        <td>${esc(i.venue)}</td>
        ${actionCell("interview", i.id)}
      </tr>`).join("")
    : emptyRow(5, { icon: "interview", title: "No interviews scheduled.", subtitle: "Schedule interviews and they will appear here." });
}

function renderResults() {
  const grid = $("#resultsCards");
  if (!grid) return;
  const list = results.list();
  if (!list.length) {
    grid.innerHTML = emptyBlock({ icon: "results", title: "No results published.", subtitle: "Publish results from the Applications page — they will appear here automatically." });
    return;
  }
  grid.innerHTML = list.map((r) => {
    const sel = resultStudents(r, "selected");
    const rej = resultStudents(r, "rejected");
    return `
      <article class="result-card">
        <header class="result-card-head">
          <h4>${esc(r.company)}</h4>
          <span class="muted" style="font-size:0.8rem;">Published: ${formatDate(r.publishedAt)}</span>
        </header>
        <div class="result-card-stats">
          <div><span class="result-num" style="color:#86efac;">${sel.length}</span><span class="muted"> Selected</span></div>
          <div><span class="result-num" style="color:#fca5a5;">${rej.length}</span><span class="muted"> Rejected</span></div>
        </div>
        <div class="result-card-actions">
          <button type="button" class="btn btn-secondary btn-sm" data-view-result="${esc(r.id)}">View Details</button>
          <button type="button" class="icon-btn danger" data-act="delete" data-entity="result" data-id="${esc(r.id)}" title="Delete">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2"/></svg>
          </button>
        </div>
      </article>`;
  }).join("");
}

// Parse a result's selected/rejected into rich student objects
function resultStudents(r, key) {
  const students = readStudents();
  const findStudent = (needle) => {
    if (!needle) return null;
    const n = String(needle).toLowerCase();
    return students.find((x) =>
      String(x.id || "").toLowerCase() === n ||
      String(x.registerNumber || "").toLowerCase() === n ||
      String(x.fullName || "").toLowerCase() === n ||
      String(x.email || "").toLowerCase() === n
    ) || null;
  };
  const enrich = (obj) => {
    // Always look up the latest full student record when possible so we
    // never render stale/partial data (e.g. missing register number).
    const lookup =
      findStudent(obj?.studentId) ||
      findStudent(obj?.id) ||
      findStudent(obj?.registerNumber) ||
      findStudent(obj?.email) ||
      findStudent(obj?.fullName) ||
      findStudent(obj?.studentName);
    const src = lookup || {};
    return {
      registerNumber: src.registerNumber || obj?.registerNumber || "—",
      fullName: src.fullName || obj?.fullName || obj?.studentName || "—",
      department: src.department || obj?.department || "—",
      year: src.year || obj?.year || "—",
      cgpa: src.cgpa || obj?.cgpa || "—",
      email: src.email || obj?.email || "",
    };
  };
  const arr = Array.isArray(r[key + "Students"]) ? r[key + "Students"] : null;
  if (arr && arr.length) {
    return arr.map((entry) => {
      if (entry && typeof entry === "object") return enrich(entry);
      // Raw ID / register number / name string stored in the array
      return enrich({ studentId: entry, registerNumber: entry, fullName: entry });
    });
  }
  const lines = (r[key] || "").split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
  if (!lines.length) return [];
  return lines.map((line) => {
    const m = line.match(/^(.*?)\s*\(([^)]+)\)\s*$/);
    const name = (m ? m[1] : line).trim();
    const reg = m ? m[2].trim() : "";
    return enrich({ fullName: name, registerNumber: reg, studentId: reg || name });
  });
}

function openResultDetailsModal(r) {
  const sel = resultStudents(r, "selected");
  const rej = resultStudents(r, "rejected");
  const rowsHtml = (arr) => arr.length ? `
    <div class="table-wrap"><table class="dash-table">
      <thead><tr><th>Register No</th><th>Student Name</th><th>Department</th></tr></thead>
      <tbody>${arr.map((s) => `<tr><td>${esc(s.registerNumber)}</td><td>${esc(s.fullName)}</td><td>${esc(s.department)}</td></tr>`).join("")}</tbody>
    </table></div>` : `<p class="muted" style="font-style:italic;">None</p>`;
  modal.open(`${r.company} — Result Details`, `
    <div style="display:flex;flex-direction:column;gap:18px;">
      <div>
        <h4 style="margin-bottom:8px;color:#86efac;">Selected Students (${sel.length})</h4>
        ${rowsHtml(sel)}
      </div>
      <div>
        <h4 style="margin-bottom:8px;color:#fca5a5;">Rejected Students (${rej.length})</h4>
        ${rowsHtml(rej)}
      </div>
    </div>
    <div class="form-actions"><button type="button" class="btn btn-primary" data-modal-close>Close</button></div>
  `);
}

function renderStats() {
  const s = getState();
  const active = s.drives.filter((d) => d.status === "Open" || d.status === "Closing Soon").length;
  const published = s.announcements.filter((a) => a.status === "Published").length;
  const now = Date.now();
  const week = now + 7 * 86400000;
  const upcoming = s.interviews.filter((i) => {
    const t = new Date(i.date).getTime();
    return !isNaN(t) && t >= now - 86400000 && t <= week;
  }).length;
  const set = (id, v) => { const el = $("#" + id); if (el) el.textContent = v; };
  set("statActiveDrives", active);
  set("statInterviews", upcoming);
  set("statAnnouncements", published);
  const totalApps = allApplications().length;
  set("statApplications", totalApps);
  // Analytics totals
  set("anaTotalDrives", s.drives.length);
  set("anaTotalApplications", totalApps);
  // Students placed = total selected entries across all published results
  const placed = s.results.reduce((sum, r) => {
    return sum + (r.selected || "").split(/\r?\n/).map((x) => x.trim()).filter(Boolean).length;
  }, 0);
  set("anaStudentsPlaced", placed);
  renderAnalyticsInsights();
  renderCompanyPerformance();
}

// ---------- ANALYTICS ----------
function companyKey(name) { return (name || "").trim().toLowerCase(); }

function appsByCompany() {
  const map = new Map();
  allApplications().forEach((a) => {
    const k = companyKey(a.drive.company);
    if (!k) return;
    if (!map.has(k)) map.set(k, { company: a.drive.company, apps: [] });
    map.get(k).apps.push(a);
  });
  return map;
}

function selectedCountForCompany(company) {
  const k = companyKey(company);
  return getState().results
    .filter((r) => companyKey(r.company) === k)
    .reduce((sum, r) => sum + (r.selected || "").split(/\r?\n/).map((x) => x.trim()).filter(Boolean).length, 0);
}

function renderAnalyticsInsights() {
  const set = (id, v) => { const el = $("#" + id); if (el) el.textContent = v; };
  const map = appsByCompany();
  const entries = Array.from(map.values()).map((v) => ({ company: v.company, count: v.apps.length }));
  if (entries.length) {
    const sorted = [...entries].sort((a, b) => b.count - a.count);
    const top = sorted[0], low = sorted[sorted.length - 1];
    set("anaHighCompany", top.company);
    set("anaHighCount", `${top.count} Application${top.count === 1 ? "" : "s"}`);
    set("anaLowCompany", low.company);
    set("anaLowCount", `${low.count} Application${low.count === 1 ? "" : "s"}`);
  } else {
    set("anaHighCompany", "—"); set("anaHighCount", "No applications yet");
    set("anaLowCompany", "—"); set("anaLowCount", "No applications yet");
  }
  // Most active department
  const deptMap = new Map();
  allApplications().forEach((a) => {
    const d = (a.student.department || "").trim();
    if (!d) return;
    deptMap.set(d, (deptMap.get(d) || 0) + 1);
  });
  if (deptMap.size) {
    const [dept, count] = Array.from(deptMap.entries()).sort((a, b) => b[1] - a[1])[0];
    set("anaTopDept", dept);
    set("anaTopDeptCount", `${count} Application${count === 1 ? "" : "s"}`);
  } else {
    set("anaTopDept", "—"); set("anaTopDeptCount", "No applications yet");
  }
}

function renderCompanyPerformance() {
  const body = $("#anaPerfBody");
  if (!body) return;
  const map = appsByCompany();
  // Include drive companies that may have no apps yet
  drives.list().forEach((d) => {
    const k = companyKey(d.company);
    if (k && !map.has(k)) map.set(k, { company: d.company, apps: [] });
  });
  const rows = Array.from(map.values())
    .map((v) => {
      const total = v.apps.length;
      const sel = selectedCountForCompany(v.company);
      const rate = total ? Math.round((sel / total) * 100) : 0;
      return { company: v.company, total, sel, rate };
    })
    .sort((a, b) => b.total - a.total);
  body.innerHTML = rows.length
    ? rows.map((r) => `
      <tr>
        <td>${esc(r.company)}</td>
        <td>${r.total}</td>
        <td>${r.sel}</td>
        <td>${r.total ? r.rate + "%" : "—"}</td>
      </tr>`).join("")
    : emptyRow(4, { icon: "analytics", title: "No analytics available.", subtitle: "Analytics will appear after placement activities begin." });
}



const ACTIVITY_META = {
  drive_created: { label: "Placement Drive Created", tone: "chip-success" },
  drive_updated: { label: "Placement Drive Updated", tone: "chip-primary" },
  drive_deleted: { label: "Placement Drive Deleted", tone: "chip-danger" },
  interview_created: { label: "Interview Scheduled", tone: "chip-success" },
  interview_updated: { label: "Interview Updated", tone: "chip-primary" },
  interview_deleted: { label: "Interview Deleted", tone: "chip-danger" },
  announcement_published: { label: "Announcement Published", tone: "chip-success" },
  announcement_draft: { label: "Announcement Saved as Draft", tone: "chip-warning" },
  announcement_updated: { label: "Announcement Updated", tone: "chip-primary" },
  announcement_deleted: { label: "Announcement Deleted", tone: "chip-danger" },
  result_published: { label: "Result Published", tone: "chip-success" },
  result_updated: { label: "Result Updated", tone: "chip-primary" },
  result_deleted: { label: "Result Deleted", tone: "chip-danger" },
};

function renderActivity() {
  const body = $("#activityBody");
  if (!body) return;
  const list = activity.list();
  body.innerHTML = list.length
    ? list.map((a) => {
        const meta = ACTIVITY_META[a.type] || { label: a.type, tone: "chip-primary" };
        return `<tr>
          <td><span class="chip ${meta.tone}">${esc(meta.label)}</span></td>
          <td>${esc(a.name || "—")}</td>
          <td>${formatDateTime(a.at)}</td>
        </tr>`;
      }).join("")
    : emptyRow(3, { icon: "default", title: "No activity yet.", subtitle: "Actions taken across the dashboard will appear here." });
}

// Currently active dashboard view. Only its renderers run on store changes
// so we don't re-serialize innerHTML for hidden panels on every mutation.
let currentView = "dashboard";

// Map view -> renderers that touch DOM inside that view.
const VIEW_RENDERERS = {
  dashboard: () => { renderStats(); renderDrives(); renderActivity(); },
  drives: () => { renderDrives(); },
  applications: () => { renderApplications(); },
  interviews: () => { renderInterviews(); },
  announcements: () => { renderAnnouncements(); },
  results: () => { renderResults(); },
  // renderStats already refreshes analytics counters + insights + perf table.
  analytics: () => { renderStats(); },
};

function renderAll() {
  (VIEW_RENDERERS[currentView] || VIEW_RENDERERS.dashboard)();
}

// ---------- APPLICATIONS MODULE ----------
const appsState = { company: "", search: "", dept: "", year: "", sort: "applied_desc" };

function driveCompanies() {
  const seen = new Set();
  return drives.list()
    .map((d) => (d.company || "").trim())
    .filter((c) => c && !seen.has(c.toLowerCase()) && seen.add(c.toLowerCase()));
}

function applicationsForCompany(company) {
  if (!company) return [];
  const c = company.trim().toLowerCase();
  return allApplications().filter((a) => (a.drive.company || "").trim().toLowerCase() === c);
}

function renderApplications() {
  const companySel = $("#appCompany");
  if (!companySel) return;
  const companies = driveCompanies();
  const prev = appsState.company;
  companySel.innerHTML = `<option value="">All Companies</option>` +
    companies.map((c) => `<option value="${esc(c)}">${esc(c)}</option>`).join("");
  if (prev && companies.some((c) => c.toLowerCase() === prev.toLowerCase())) {
    companySel.value = companies.find((c) => c.toLowerCase() === prev.toLowerCase());
    appsState.company = companySel.value;
  } else {
    companySel.value = "";
    appsState.company = "";
  }
  renderApplicationsTable();
}

function renderApplicationsTable() {
  const body = $("#appsBody");
  if (!body) return;
  const base = appsState.company
    ? applicationsForCompany(appsState.company)
    : allApplications();
  const total = base.length;
  let rows = base.slice();

  // Filters
  const q = (appsState.search || "").trim().toLowerCase();
  if (q) rows = rows.filter((r) => {
    const s = r.student;
    return [
      s.fullName, s.registerNumber, s.email, s.collegeEmail,
      s.phone, s.department, r.drive.company,
    ].some((v) => String(v || "").toLowerCase().includes(q));
  });
  if (appsState.dept) rows = rows.filter((r) => r.student.department === appsState.dept);
  if (appsState.year) rows = rows.filter((r) => String(r.student.year) === String(appsState.year));

  // Sort
  const cmps = {
    applied_desc: (a, b) => (b.appliedAt || 0) - (a.appliedAt || 0),
    applied_asc:  (a, b) => (a.appliedAt || 0) - (b.appliedAt || 0),
    cgpa_desc:    (a, b) => (parseFloat(b.student.cgpa) || 0) - (parseFloat(a.student.cgpa) || 0),
    cgpa_asc:     (a, b) => (parseFloat(a.student.cgpa) || 0) - (parseFloat(b.student.cgpa) || 0),
    name_asc:     (a, b) => String(a.student.fullName || "").localeCompare(String(b.student.fullName || "")),
    name_desc:    (a, b) => String(b.student.fullName || "").localeCompare(String(a.student.fullName || "")),
  };
  rows.sort(cmps[appsState.sort] || cmps.applied_desc);

  // Cache the currently visible (filtered + sorted) rows for exports
  appsState.visibleRows = rows;

  const countText = `Showing ${rows.length} of ${total} application${total === 1 ? "" : "s"}`;
  const countEl = $("#appsCount"); if (countEl) countEl.textContent = countText;
  const countTop = $("#appsCountTop"); if (countTop) countTop.textContent = countText;

  if (!rows.length) {
    const isPristine = total === 0 && !appsState.company && !q && !appsState.dept && !appsState.year;
    body.innerHTML = isPristine
      ? emptyRow(8, { icon: "apps", title: "No applications received yet.", subtitle: "Applications will appear here once students apply." })
      : emptyRow(8, { icon: "search", title: "No matching records found.", subtitle: "Try adjusting your search or filters." });
    const sa = $("#appSelectAll"); if (sa) { sa.checked = false; sa.disabled = true; }
    return;
  }
  const sa = $("#appSelectAll"); if (sa) sa.disabled = false;

  body.innerHTML = rows.map((r) => {
    const s = r.student;
    const resume = r.resumeUrl
      ? `<button type="button" class="btn btn-secondary btn-sm" data-download-resume="${esc(r.resumeUrl)}" data-resume-name="${esc(s.fullName || "Resume")}">Download Resume</button>`
      : `<span class="muted" style="font-size:0.82rem;">Not uploaded</span>`;
    const initial = (s.fullName || "S").trim().charAt(0).toUpperCase();
    const avatar = s.profilePicture
      ? `<span class="stu-cell-avatar" style="background-image:url('${esc(s.profilePicture)}');"></span>`
      : `<span class="stu-cell-avatar">${esc(initial)}</span>`;
    const contacts = [];
    if (s.phone) contacts.push(`<span title="Phone">📞 ${esc(s.phone)}</span>`);
    if (s.linkedin) contacts.push(`<a href="${esc(s.linkedin)}" target="_blank" rel="noopener">LinkedIn</a>`);
    if (s.github) contacts.push(`<a href="${esc(s.github)}" target="_blank" rel="noopener">GitHub</a>`);
    const nameCell = `<div class="stu-cell">${avatar}<div class="stu-cell-info"><span class="stu-cell-name">${esc(s.fullName || "—")}</span>${contacts.length ? `<span class="stu-cell-contacts">${contacts.join(" · ")}</span>` : ""}</div></div>`;
    return `<tr data-app-row data-student-id="${esc(s.id)}">
      <td><input type="checkbox" class="app-check" data-student-id="${esc(s.id)}" /></td>
      <td>${esc(s.registerNumber || "—")}</td>
      <td>${nameCell}</td>
      <td>${esc(s.department || "—")}</td>
      <td>${esc(s.year || "—")}</td>
      <td>${esc(s.cgpa || "—")}</td>
      <td>${resume}</td>
      <td>${r.appliedAt ? formatDateTime(r.appliedAt) : "—"}</td>
    </tr>`;
  }).join("");
}

function downloadResume(url, name) {
  if (!url) return;
  const isPdf = /\.pdf(\?|$)/i.test(url) || /^data:application\/pdf/i.test(url);
  const safeName = String(name || "Resume").replace(/[^\w.\- ]+/g, "_");
  const fileName = isPdf ? `${safeName}.pdf` : safeName;
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

function openPublishResultsModal(preSelectedIds) {
  const company = appsState.company;
  if (!company) { showToast("Select a company first.", "warning"); return; }
  const rows = applicationsForCompany(company);
  if (!rows.length) { showToast("No applicants for this company yet.", "warning"); return; }
  const preset = new Set(preSelectedIds || []);
  const list = rows.map((r) => {
    const s = r.student;
    const checked = preset.has(s.id) ? "checked" : "";
    return `<label class="publish-row">
      <input type="checkbox" data-publish-check data-student-id="${esc(s.id)}" ${checked} />
      <span class="publish-info">
        <strong>${esc(s.fullName || "—")}</strong>
        <span class="muted" style="font-size:0.8rem;">${esc(s.registerNumber || "")} · ${esc(s.department || "")} · CGPA ${esc(s.cgpa || "—")}</span>
      </span>
    </label>`;
  }).join("");

  modal.open(`Publish Results — ${company}`, `
    <p style="color:var(--text-muted);font-size:0.9rem;margin-bottom:8px;">
      Check every student who has been <strong>selected</strong>. All others will be marked <strong>Not Selected</strong>.
    </p>
    <div class="publish-list">${list}</div>
    <div class="form-actions">
      <button type="button" class="btn btn-secondary" data-modal-close>Cancel</button>
      <button type="button" class="btn btn-primary" id="publishConfirmBtn">Publish Results</button>
    </div>
  `);

  $("#publishConfirmBtn").addEventListener("click", () => {
    const checked = $$(`[data-publish-check]`).filter((c) => c.checked).map((c) => c.dataset.studentId);
    const total = rows.length;
    const selCount = checked.length;
    const remCount = total - selCount;
    // Confirmation
    modal.open(`Confirm Publish — ${company}`, `
      <dl class="detail-list">
        <dt>Selected Students</dt><dd><strong>${selCount}</strong></dd>
        <dt>Remaining Applicants</dt><dd><strong>${remCount}</strong></dd>
      </dl>
      <p style="color:var(--text-muted);font-size:0.88rem;">Remaining applicants will automatically be marked as <strong>Not Selected</strong>.</p>
      <div class="form-actions">
        <button type="button" class="btn btn-secondary" data-modal-close>Cancel</button>
        <button type="button" class="btn btn-primary" id="publishFinalBtn">Publish</button>
      </div>
    `);
    $("#publishFinalBtn").addEventListener("click", () => {
      const selSet = new Set(checked);
      const selected = rows.filter((r) => selSet.has(r.student.id))
        .map((r) => `${r.student.fullName} (${r.student.registerNumber})`);
      const rejected = rows.filter((r) => !selSet.has(r.student.id))
        .map((r) => `${r.student.fullName} (${r.student.registerNumber})`);
      results.save({
        company,
        selected: selected.join("\n"),
        rejected: rejected.join("\n"),
        selectedStudents: rows.filter((r) => selSet.has(r.student.id)).map((r) => ({
          studentId: r.student.id,
          registerNumber: r.student.registerNumber || "",
          fullName: r.student.fullName || "",
          department: r.student.department || "",
          year: r.student.year || "",
          cgpa: r.student.cgpa || "",
          email: r.student.email || "",
        })),
        rejectedStudents: rows.filter((r) => !selSet.has(r.student.id)).map((r) => ({
          studentId: r.student.id,
          registerNumber: r.student.registerNumber || "",
          fullName: r.student.fullName || "",
          department: r.student.department || "",
          year: r.student.year || "",
          cgpa: r.student.cgpa || "",
          email: r.student.email || "",
        })),
        publishedAt: Date.now(),
      });
      activity.log({ type: "result_published", name: company });
      showToast("Results published successfully.");
      notifyStudentsByCompany(company, {
        title: "🎉 Result Published",
        message: `The result for ${company} is now available.`,
        type: "result",
      });
      modal.close();
    });
  });
}

// ---------- forms: drive modal ----------
function driveForm(d = {}) {
  return `
    <form class="dash-form" id="driveForm" novalidate>
      <input type="hidden" name="id" value="${esc(d.id || "")}" />
      <div class="form-group full">
        <label class="form-label" for="drCompany">Company Name</label>
        <input class="form-input" id="drCompany" name="company" type="text" value="${esc(d.company || "")}" required />
      </div>
      <div class="form-group full">
        <label class="form-label" for="drRole">Role</label>
        <input class="form-input" id="drRole" name="role" type="text" placeholder="e.g. Software Engineer" value="${esc(d.role || "")}" required />
      </div>
      <div class="form-group">
        <label class="form-label" for="drEligibility">Eligibility</label>
        <input class="form-input" id="drEligibility" name="eligibility" type="text" placeholder="e.g. CGPA ≥ 7.0" value="${esc(d.eligibility || "")}" />
      </div>
      <div class="form-group">
        <label class="form-label" for="drDepartments">Eligible Departments</label>
        <div id="drDepartments" data-multiselect="departments"></div>
      </div>
      <div class="form-group full">
        <label class="form-label" for="drDeadline">Deadline</label>
        <input class="form-input" id="drDeadline" name="deadline" type="date" value="${esc(d.deadline || "")}" required />
      </div>
      <div class="form-group full">
        <label class="form-label" for="drDesc">Job Description</label>
        <textarea class="form-input" id="drDesc" name="description">${esc(d.description || "")}</textarea>
      </div>
      <div class="form-group full">
        <label class="form-label" for="drStatus">Status</label>
        <select class="form-input form-select" id="drStatus" name="status">
          ${["Upcoming", "Open", "Closing Soon", "Closed"].map((s) => `<option ${s === (d.status || "Upcoming") ? "selected" : ""}>${s}</option>`).join("")}
        </select>
      </div>
      <div class="form-actions">
        <button type="button" class="btn btn-secondary" data-modal-close>Cancel</button>
        <button type="submit" class="btn btn-primary">Save Drive</button>
      </div>
    </form>`;
}

function openDriveModal(d) {
  modal.open(d ? "Edit Placement Drive" : "Create Placement Drive", driveForm(d || {}));
  const form = $("#driveForm");
  const msEl = form.querySelector('[data-multiselect="departments"]');
  initDepartmentMultiSelect(msEl, { initial: driveDepartments(d || {}) });
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const fd = new FormData(form);
    const item = Object.fromEntries(fd.entries());
    if (!item.company || !item.role || !item.deadline) return;
    // Store departments as an array. Drop the legacy `branches` string.
    item.departments = JSON.parse(msEl.dataset.value || "[]");
    delete item.branches;
    const isNew = !item.id;
    if (isNew) delete item.id;
    drives.save(item);
    activity.log({ type: isNew ? "drive_created" : "drive_updated", name: item.company });
    showToast(isNew ? "Placement Drive created successfully." : "Placement Drive updated successfully.");
    if (isNew) {
      notifyAllStudents({
        title: "📢 New Placement Drive",
        message: `${item.company} has opened applications.`,
        type: "drive",
        company: item.company,
      });
    }
    modal.close();
  });
}

function openViewModal(entity, item) {
  const rows = Object.entries(item)
    .filter(([k]) => k !== "id" && k !== "createdAt")
    .map(([k, v]) => {
      const label = k.replace(/([A-Z])/g, " $1").replace(/^./, (c) => c.toUpperCase());
      let val = v;
      if (k === "deadline" || k === "date" || k === "publishedAt") val = formatDate(v);
      if (v == null || v === "") val = "—";
      const strVal = String(val);
      const html = (k === "selected" || k === "rejected") && strVal.includes("\n")
        ? `<ul class="student-list">${strVal.split(/\r?\n/).map((s) => s.trim()).filter(Boolean).map((n) => `<li>${esc(n)}</li>`).join("")}</ul>`
        : esc(strVal).replace(/\n/g, "<br>");
      return `<dt>${esc(label)}</dt><dd>${html}</dd>`;
    }).join("");
  const titles = { drive: "Placement Drive", announcement: "Announcement", interview: "Interview", result: "Result" };
  modal.open(titles[entity] || "Details", `<dl class="detail-list">${rows}</dl>
    <div class="form-actions"><button type="button" class="btn btn-secondary" data-modal-close>Close</button></div>`);
}

function openAnnouncementEditModal(a) {
  modal.open("Edit Announcement", `
    <form class="dash-form" id="annEditForm" novalidate>
      <input type="hidden" name="id" value="${esc(a.id)}" />
      <div class="form-group full">
        <label class="form-label" for="aeTitle">Announcement Title</label>
        <input class="form-input" id="aeTitle" name="title" type="text" value="${esc(a.title)}" required />
      </div>
      <div class="form-group full">
        <label class="form-label" for="aeDesc">Description</label>
        <textarea class="form-input" id="aeDesc" name="description" required>${esc(a.description || "")}</textarea>
      </div>
      <div class="form-group full">
        <label class="form-label" for="aeStatus">Status</label>
        <select class="form-input" id="aeStatus" name="status">
          ${["Published", "Draft"].map((s) => `<option ${s === a.status ? "selected" : ""}>${s}</option>`).join("")}
        </select>
      </div>
      <div class="form-actions">
        <button type="button" class="btn btn-secondary" data-modal-close>Cancel</button>
        <button type="submit" class="btn btn-primary">Save Changes</button>
      </div>
    </form>`);
  $("#annEditForm").addEventListener("submit", (e) => {
    e.preventDefault();
    const fd = Object.fromEntries(new FormData(e.target).entries());
    const prev = announcements.get(fd.id);
    announcements.save({
      ...prev,
      ...fd,
      publishedAt: fd.status === "Published" ? (prev?.publishedAt || Date.now()) : null,
    });
    activity.log({ type: "announcement_updated", name: fd.title });
    showToast("Announcement updated successfully.");
    modal.close();
  });
}

function confirmDelete(entity, id, label) {
  confirmDialog({
    title: `Delete ${label}`,
    message: `Are you sure you want to delete this ${label.toLowerCase()}? This action cannot be undone.`,
    confirmText: "Delete",
    tone: "danger",
  }).then((ok) => {
    if (!ok) return;
    const stores = { drive: drives, announcement: announcements, interview: interviews, result: results };
    const store = stores[entity];
    const item = store.get(id);
    const name = item?.company || item?.title || "—";
    store.remove(id);
    activity.log({ type: `${entity}_deleted`, name });
    showToast(`${label} deleted successfully.`);
  });
}

// ---------- main init ----------
export function initDashboard() {
  const shell = document.getElementById("dashShell");
  const toggle = document.getElementById("sidebarToggle");
  const backdrop = document.getElementById("sidebarBackdrop");
  const links = document.querySelectorAll("[data-view-link]");
  const views = document.querySelectorAll(".dash-view");
  const title = document.getElementById("viewTitle");
  const subtitle = document.getElementById("viewSubtitle");
  const logoutBtn = document.getElementById("logoutBtn");

  const VIEW_META = {
    dashboard: { title: "Dashboard", subtitle: "Placement cell overview" },
    drives: { title: "Placement Drives", subtitle: "Manage upcoming and ongoing drives" },
    applications: { title: "Applications", subtitle: "Students who applied to each company" },
    interviews: { title: "Interview Schedule", subtitle: "Plan and publish interview slots" },
    announcements: { title: "Announcements", subtitle: "Publish updates for students" },
    results: { title: "Results", subtitle: "Publish company-wise results" },
    analytics: { title: "Analytics", subtitle: "Placement activity at a glance" },
  };

  const isMobile = () => window.matchMedia("(max-width: 820px)").matches;

  function activateView(view) {
    views.forEach((v) => v.classList.toggle("is-active", v.dataset.view === view));
    links.forEach((l) => l.classList.toggle("is-active", l.dataset.viewLink === view));
    const meta = VIEW_META[view] || VIEW_META.dashboard;
    if (title) title.textContent = meta.title;
    if (subtitle) subtitle.textContent = meta.subtitle;
    window.scrollTo({ top: 0, behavior: "smooth" });
    // Render only the newly-active view (hidden panels stay untouched).
    currentView = view;
    renderAll();
  }

  links.forEach((link) => {
    link.addEventListener("click", (e) => {
      e.preventDefault();
      const view = link.dataset.viewLink;
      if (!view) return;
      activateView(view);
      if (isMobile()) shell.classList.remove("is-mobile-open");
    });
  });

  if (toggle && shell) {
    toggle.addEventListener("click", () => {
      if (isMobile()) shell.classList.toggle("is-mobile-open");
      else shell.classList.toggle("is-collapsed");
    });
  }
  if (backdrop && shell) {
    backdrop.addEventListener("click", () => shell.classList.remove("is-mobile-open"));
  }

  if (logoutBtn) {
    logoutBtn.addEventListener("click", async (e) => {
      e.preventDefault();
      const ok = await confirmDialog({
        title: "Log out?",
        message: "You will be returned to the login screen.",
        confirmText: "Log out",
        tone: "danger",
      });
      if (ok) {
        logoutOfficer();
        window.location.href = OFFICER_LOGIN_URL;
      }
    });
  }

  // Quick action buttons jump to related views
  document.querySelectorAll("[data-quick-action]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const target = btn.dataset.quickAction;
      if (target) activateView(target);
    });
  });

  // File input display
  document.querySelectorAll(".file-drop input[type=file]").forEach((input) => {
    input.addEventListener("change", () => {
      const label = input.closest(".file-drop")?.querySelector(".file-name");
      if (label) label.textContent = input.files?.[0]?.name || label.dataset.default;
    });
  });

  // ---- modal init ----
  modal.init();

  // ---- notifications bell ----
  const notifMount = document.getElementById("notifMount");
  if (notifMount) initNotificationBell({ mount: notifMount, userType: "officer", userId: "officer" });

  // ---- Create drive ----
  const createBtn = $("#createDriveBtn");
  if (createBtn) createBtn.addEventListener("click", () => openDriveModal(null));

  // ---- Applications: filter/search/sort wiring ----
  // Populate dept filter from the shared canonical list so it always matches
  // what students actually store on their profile.
  const deptFilter = document.getElementById("appDeptFilter");
  if (deptFilter) {
    const current = deptFilter.value;
    deptFilter.innerHTML = `<option value="">All Departments</option>` +
      DEPARTMENTS_LIST.map((d) => `<option value="${esc(d)}">${esc(d)}</option>`).join("");
    deptFilter.value = current;
  }
  const bindApps = (id, key, evt = "input") => {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener(evt, () => { appsState[key] = el.value; renderApplicationsTable(); });
  };
  bindApps("appCompany", "company", "change");
  bindApps("appSearch", "search", "input");
  bindApps("appDeptFilter", "dept", "change");
  bindApps("appYearFilter", "year", "change");
  bindApps("appSort", "sort", "change");

  const resetBtn = document.getElementById("appResetBtn");
  if (resetBtn) resetBtn.addEventListener("click", () => {
    appsState.search = ""; appsState.dept = ""; appsState.year = "";
    appsState.company = ""; appsState.sort = "applied_desc";
    const s = $("#appSearch"); if (s) s.value = "";
    const d = $("#appDeptFilter"); if (d) d.value = "";
    const y = $("#appYearFilter"); if (y) y.value = "";
    const c = $("#appCompany"); if (c) c.value = "";
    const so = $("#appSort"); if (so) so.value = "applied_desc";
    renderApplicationsTable();
  });

  const selAll = document.getElementById("appSelectAll");
  if (selAll) {
    selAll.addEventListener("change", () => {
      $$(".app-check").forEach((c) => { c.checked = selAll.checked; });
    });
  }

  document.body.addEventListener("click", (e) => {
    const rb = e.target.closest("[data-download-resume]");
    if (rb) { downloadResume(rb.dataset.downloadResume, rb.dataset.resumeName || "Resume"); return; }
    const vr = e.target.closest("[data-view-result]");
    if (vr) {
      const r = results.get(vr.dataset.viewResult);
      if (r) openResultDetailsModal(r);
      return;
    }
    if (e.target.id === "proceedResultsBtn") {
      const ids = $$(".app-check").filter((c) => c.checked).map((c) => c.dataset.studentId);
      openPublishResultsModal(ids);
    }
  });

  // ---- table action delegation ----
  document.body.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-act]");
    if (!btn) return;
    const { act, entity, id } = btn.dataset;
    const stores = { drive: drives, announcement: announcements, interview: interviews, result: results };
    const labels = { drive: "Placement Drive", announcement: "Announcement", interview: "Interview", result: "Result" };
    const store = stores[entity];
    if (!store) return;
    const item = store.get(id);
    if (!item) return;
    if (act === "view") openViewModal(entity, item);
    else if (act === "delete") confirmDelete(entity, id, labels[entity]);
    else if (act === "edit") {
      if (entity === "drive") openDriveModal(item);
      else if (entity === "announcement") openAnnouncementEditModal(item);
      else if (entity === "interview") openInterviewEditModal(item);
      else if (entity === "result") openResultEditModal(item);
    }
  });

  // ---- Announcement form (main) ----
  const annForm = $("#announcementForm");
  if (annForm) {
    const readFileAsDataURL = (file) => new Promise((resolve, reject) => {
      if (!file) return resolve("");
      const r = new FileReader();
      r.onload = () => resolve(r.result);
      r.onerror = () => reject(r.error);
      r.readAsDataURL(file);
    });
    const submit = async (status) => {
      const title = $("#annTitle").value.trim();
      const desc = $("#annDesc").value.trim();
      if (!title || !desc) { annForm.reportValidity(); return; }
      const posterFile = $("#annPoster")?.files?.[0] || null;
      const pdfFile = $("#annPdf")?.files?.[0] || null;
      let posterUrl = "", pdfUrl = "", pdfName = "";
      try {
        [posterUrl, pdfUrl] = await Promise.all([
          readFileAsDataURL(posterFile),
          readFileAsDataURL(pdfFile),
        ]);
        pdfName = pdfFile?.name || "";
      } catch (err) {
        showToast("Failed to read attachment.", "error");
        return;
      }
      announcements.save({
        title, description: desc, status,
        category: "General",
        posterUrl, pdfUrl, pdfName,
        publishedAt: status === "Published" ? Date.now() : null,
      });
      activity.log({ type: status === "Published" ? "announcement_published" : "announcement_draft", name: title });
      showToast(status === "Published" ? "Announcement published successfully." : "Announcement saved as draft.");
      if (status === "Published") {
        notifyAllStudents({
          title: "📢 New Announcement",
          message: title,
          type: "announcement",
        });
      }
      annForm.reset();
      annForm.querySelectorAll(".file-name").forEach((el) => el.textContent = el.dataset.default);
    };
    annForm.addEventListener("submit", (e) => { e.preventDefault(); submit("Published"); });
    $("#annDraftBtn")?.addEventListener("click", () => submit("Draft"));
  }

  // ---- Interview form ----
  const ivForm = $("#interviewForm");
  if (ivForm) {
    ivForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const company = $("#ivCompany").value.trim();
      const date = $("#ivDate").value;
      const time = $("#ivTime").value;
      const venue = $("#ivVenue").value.trim();
      if (!company || !date || !time || !venue) { ivForm.reportValidity(); return; }
      
      try {
        await interviews.save({ company, date, time, venue, createdAt: Date.now() });
        activity.log({ type: "interview_created", name: company });
        showToast("Interview scheduled successfully.");
        notifyStudentsByCompany(company, {
          title: "📅 Interview Scheduled",
          message: `${company} interview has been scheduled.`,
          type: "interview",
        });
        ivForm.reset();
      } catch (err) {
        showToast("Failed to schedule interview: " + (err.message || err), "error");
      }
    });
    $("#interviewResetBtn")?.addEventListener("click", () => ivForm.reset());
  }

  // ---- render on store changes ----
  subscribe(renderAll);

  // Realtime rendering is driven by the store and loadOfficerData updates
  initExportMenus();
}

// ---------- EXPORTS ----------
function appStatusFor(app) {
  const company = (app.drive.company || "").trim().toLowerCase();
  const sid = String(app.student.id || "").toLowerCase();
  const reg = String(app.student.registerNumber || "").toLowerCase();
  const rs = getState().results.filter((r) => (r.company || "").trim().toLowerCase() === company);
  const matches = (e) => {
    if (!e) return false;
    if (typeof e === "string") {
      const s = e.toLowerCase();
      return (reg && s.includes(reg)) || (sid && s.includes(sid));
    }
    return (
      String(e.studentId || "").toLowerCase() === sid ||
      (reg && String(e.registerNumber || "").toLowerCase() === reg)
    );
  };
  for (const r of rs) {
    if ((Array.isArray(r.selectedStudents) ? r.selectedStudents : []).some(matches)) return "Selected";
    if ((Array.isArray(r.rejectedStudents) ? r.rejectedStudents : []).some(matches)) return "Not Selected";
  }
  return "Pending";
}

function appRowsForExport() {
  const rows = Array.isArray(appsState.visibleRows) ? appsState.visibleRows : [];
  return rows.map((r) => ({
    "Register Number": r.student.registerNumber || "",
    "Student Name": r.student.fullName || "",
    "Department": r.student.department || "",
    "Year": r.student.year || "",
    "CGPA": r.student.cgpa || "",
    "Company": r.drive.company || "",
    "Role": r.drive.role || "",
    "Applied Date": r.appliedAt ? new Date(r.appliedAt).toISOString().slice(0, 10) : "",
    "Application Status": appStatusFor(r),
  }));
}

function resultRowsFor(kind, companyFilter) {
  const list = results.list().filter((r) => {
    if (!companyFilter) return true;
    return (r.company || "").trim().toLowerCase() === companyFilter.trim().toLowerCase();
  });
  const statusLabel = kind === "selected" ? "Selected" : "Not Selected";
  const out = [];
  list.forEach((r) => {
    const students = resultStudents(r, kind);
    const published = r.publishedAt ? new Date(r.publishedAt).toISOString().slice(0, 10) : "";
    students.forEach((s) => {
      out.push({
        "Register Number": s.registerNumber || "",
        "Student Name": s.fullName || "",
        "Department": s.department || "",
        "Year": s.year || "",
        "CGPA": s.cgpa || "",
        "Company": r.company || "",
        "Role": r.role || "",
        "Result Status": statusLabel,
        "Published Date": published,
      });
    });
  });
  return out;
}

function handleExport(kind, scope) {
  const company = scope === "applications" ? (appsState.company || "") : "";
  const ext = kind.endsWith("csv") ? "csv" : "xlsx";
  let rows, name, sheet, successMsg;
  if (kind.startsWith("apps-")) {
    rows = appRowsForExport();
    name = buildAppFilename(company || "All", ext);
    sheet = "Applications";
    successMsg = "Applications exported successfully.";
  } else if (kind.startsWith("selected-")) {
    rows = resultRowsFor("selected", company);
    name = buildSelectedFilename(company || "All", ext);
    sheet = "Selected";
    successMsg = "Selected students exported successfully.";
  } else if (kind.startsWith("rejected-")) {
    rows = resultRowsFor("rejected", company);
    name = buildRejectedFilename(company || "All", ext);
    sheet = "Rejected";
    successMsg = "Rejected students exported successfully.";
  } else return;
  if (!rows.length) { showToast("No records available to export.", "warning"); return; }
  if (ext === "csv") downloadCSV(rows, name); else downloadXLSX(rows, name, sheet);
  showToast(successMsg);
}

function initExportMenus() {
  document.querySelectorAll("[data-export-wrap]").forEach((wrap) => {
    const toggle = wrap.querySelector("[data-export-toggle]");
    if (!toggle) return;
    toggle.addEventListener("click", (e) => {
      e.stopPropagation();
      const wasOpen = wrap.classList.contains("is-open");
      document.querySelectorAll("[data-export-wrap].is-open").forEach((w) => w.classList.remove("is-open"));
      if (!wasOpen) wrap.classList.add("is-open");
    });
    wrap.querySelectorAll("[data-export]").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const kind = btn.dataset.export;
        const scope = wrap.dataset.exportWrap;
        wrap.classList.remove("is-open");
        handleExport(kind, scope);
      });
    });
  });
  document.addEventListener("click", () => {
    document.querySelectorAll("[data-export-wrap].is-open").forEach((w) => w.classList.remove("is-open"));
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      document.querySelectorAll("[data-export-wrap].is-open").forEach((w) => w.classList.remove("is-open"));
    }
  });
}

function openInterviewEditModal(i) {
  modal.open("Edit Interview", `
    <form class="dash-form" id="ivEditForm" novalidate>
      <input type="hidden" name="id" value="${esc(i.id)}" />
      <div class="form-group"><label class="form-label">Company</label><input class="form-input" name="company" value="${esc(i.company)}" required /></div>
      <div class="form-group"><label class="form-label">Venue</label><input class="form-input" name="venue" value="${esc(i.venue)}" required /></div>
      <div class="form-group"><label class="form-label">Date</label><input class="form-input" type="date" name="date" value="${esc(i.date)}" required /></div>
      <div class="form-group"><label class="form-label">Time</label><input class="form-input" type="time" name="time" value="${esc(i.time)}" required /></div>
      <div class="form-actions">
        <button type="button" class="btn btn-secondary" data-modal-close>Cancel</button>
        <button type="submit" class="btn btn-primary">Save Changes</button>
      </div>
    </form>`);
  $("#ivEditForm").addEventListener("submit", (e) => {
    e.preventDefault();
    const fd = Object.fromEntries(new FormData(e.target).entries());
    interviews.save({ ...i, ...fd });
    activity.log({ type: "interview_updated", name: fd.company || i.company });
    showToast("Interview updated successfully.");
    modal.close();
  });
}

function openResultEditModal(r) {
  modal.open("Edit Result", `
    <form class="dash-form" id="resEditForm" novalidate>
      <input type="hidden" name="id" value="${esc(r.id)}" />
      <div class="form-group full"><label class="form-label">Company</label><input class="form-input" name="company" value="${esc(r.company)}" required /></div>
      <div class="form-group full"><label class="form-label">Selected Students</label><textarea class="form-input" name="selected" required>${esc(r.selected || "")}</textarea></div>
      <div class="form-group full"><label class="form-label">Rejected Students</label><textarea class="form-input" name="rejected">${esc(r.rejected || "")}</textarea></div>
      <div class="form-actions">
        <button type="button" class="btn btn-secondary" data-modal-close>Cancel</button>
        <button type="submit" class="btn btn-primary">Save Changes</button>
      </div>
    </form>`);
  $("#resEditForm").addEventListener("submit", (e) => {
    e.preventDefault();
    const fd = Object.fromEntries(new FormData(e.target).entries());
    results.save({ ...r, ...fd });
    activity.log({ type: "result_updated", name: fd.company || r.company });
    showToast("Results updated successfully.");
    modal.close();
  });
}
