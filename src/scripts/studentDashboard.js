import { drives, announcements, interviews, results, subscribe, getState } from "./store.js";
import { currentStudent, logoutStudent } from "./studentAuth.js";
import { initNotificationBell } from "./notificationsUI.js";
import { notifyOfficer } from "./notifications.js";
import { emptyState, confirmDialog } from "./ux.js";
import { driveDepartments, formatDepartments, DEPARTMENTS } from "./departments.js";

import { supabase } from "./supabase.js";

// ---------- guard ----------
const session = currentStudent();
if (!session) { window.location.href = "/student-login.html"; }

let me = {
  id: session.id,
  email: session.email,
  fullName: session.fullName,
  department: "",
  year: "",
  cgpa: 0.0,
  resumeUrl: "",
  resumeName: "",
  profilePicture: "",
  phone: "",
  linkedin: "",
  github: "",
};

let myApplicationsList = [];

// Initialize profile and application data asynchronously
async function initStudentData() {
  try {
    // 1. Fetch profile
    const { data: profile } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", session.id)
      .single();

    if (profile) {
      me = {
        id: profile.id,
        email: profile.email,
        fullName: profile.full_name,
        department: profile.department || "",
        year: profile.year || "",
        cgpa: parseFloat(profile.cgpa) || 0.0,
        resumeUrl: profile.resume_url || "",
        resumeName: profile.resume_name || "",
        profilePicture: profile.profile_picture || "",
        phone: profile.phone || "",
        linkedin: profile.linkedin || "",
        github: profile.github || "",
      };
      fillProfileForm();
      renderProfilePic();
      renderResumeCard();
    }

    // 2. Fetch applications
    const { data: apps, error: appsErr } = await supabase
      .from("applications")
      .select("*")
      .eq("student_id", session.id);

    if (appsErr) {
      console.error("Error fetching applications:", appsErr);
      toast("Error loading applications: " + appsErr.message, "error");
    }

    if (apps) {
      myApplicationsList = apps.map((row) => ({
        driveId: row.drive_id,
        appliedAt: new Date(row.applied_at).getTime(),
        resumeUrl: row.resume_url || "",
      }));
    }

    renderAll();
  } catch (err) {
    console.error("Error loading student data from Supabase:", err);
    toast("Failed to load student data: " + err.message, "error");
  }
}

initStudentData();

async function saveStudentProfile(updated) {
  me = { ...me, ...updated };
  
  const { error } = await supabase
    .from("profiles")
    .update({
      full_name: me.fullName,
      department: me.department,
      year: me.year,
      cgpa: me.cgpa,
      resume_url: me.resumeUrl,
      resume_name: me.resumeName,
      profile_picture: me.profilePicture,
      phone: me.phone,
      linkedin: me.linkedin,
      github: me.github,
    })
    .eq("id", session.id);

  if (error) {
    console.error("Error updating student profile in Supabase:", error);
  }
}

function myApps() {
  return myApplicationsList;
}

function hasApplied(driveId) {
  return myApplicationsList.some((a) => a.driveId === driveId);
}

async function apply(driveId) {
  if (hasApplied(driveId)) return;
  const newApp = {
    driveId,
    appliedAt: Date.now(),
    resumeUrl: me.resumeUrl || "",
  };

  // Optimistic Update
  myApplicationsList.push(newApp);
  renderAll();

  const { error } = await supabase.from("applications").insert({
    student_id: session.id,
    drive_id: driveId,
    resume_url: me.resumeUrl || "",
  });

  if (error) {
    console.error("Error saving application to Supabase:", error);
    toast(error.message || "Failed to submit application. Please try again.", "error");
    // Rollback
    myApplicationsList = myApplicationsList.filter((a) => a.driveId !== driveId);
    renderAll();
  } else {
    const drive = drives.list().find((d) => d.id === driveId);
    const company = drive?.company || "a placement drive";
    notifyOfficer({
      title: "New Application",
      message: `${me.fullName || "A student"} applied for ${company}.`,
      type: "application",
      company,
    });
  }
}


// ---------- eligibility ----------
const DEPT_ALIASES = {
  "cse": ["computer science & engineering", "computer science and engineering", "computer science", "cs"],
  "cs": ["computer science & engineering", "computer science"],
  "it": ["information technology"],
  "ece": ["electronics & communication engineering", "electronics and communication"],
  "eee": ["electrical & electronics engineering", "electrical and electronics"],
  "eie": ["electronics & instrumentation"],
  "mech": ["mechanical engineering"],
  "civil": ["civil engineering"],
  "auto": ["automobile engineering"],
  "aero": ["aeronautical engineering"],
  "bme": ["biomedical engineering"],
  "bt": ["biotechnology"],
  "biotech": ["biotechnology"],
  "chem": ["chemical engineering"],
  "ft": ["food technology"],
  "mct": ["mechatronics engineering", "mechatronics"],
  "aids": ["artificial intelligence & data science", "ai & data science"],
  "ai&ds": ["artificial intelligence & data science", "ai & data science"],
  "aiml": ["artificial intelligence & machine learning", "ai & machine learning"],
  "ai&ml": ["artificial intelligence & machine learning", "ai & machine learning"],
  "csbs": ["computer science & business systems"],
  "csd": ["computer science & design"],
  "cscs": ["computer science & engineering (cyber security)", "cyber security"],
};

function normDept(s) {
  return String(s || "")
    .toLowerCase()
    // treat "&" and the word "and" as the same connector so
    // "Computer Science & Engineering" == "Computer Science and Engineering"
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]/g, " ")
    .replace(/\bengg\b/g, "engineering")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeBranches(branches) {
  if (branches == null) return [];
  if (Array.isArray(branches)) return branches.map((b) => String(b).trim()).filter(Boolean);
  return String(branches).split(/[,/|]/).map((t) => t.trim()).filter(Boolean);
}

function branchMatches(drive, studentDept) {
  const depts = driveDepartments(drive);
  // No restriction (empty array or all departments) → drive is open to everyone.
  if (!depts.length || depts.length === DEPARTMENTS.length) return true;
  if (!studentDept) return false;
  // Exact match on the full official department name.
  if (depts.includes(studentDept)) return true;
  // Legacy tolerance: normalize both sides for old records that stored
  // free-text branch strings (e.g. "CSE, IT"). New drives use the canonical
  // list and match via strict equality above.
  const stu = normDept(studentDept);
  return depts.some((t) => {
    const tn = normDept(t);
    if (!tn) return false;
    if (stu === tn) return true;
    if (stu.includes(tn) || tn.includes(stu)) return true;
    const aliases = DEPT_ALIASES[tn.replace(/\s+/g, "")] || DEPT_ALIASES[tn];
    if (aliases && aliases.some((a) => stu.includes(normDept(a)) || normDept(a).includes(stu))) return true;
    // reverse alias: student typed the short code (e.g. "CSE"), drive stored the full name.
    const stuAliases = DEPT_ALIASES[stu.replace(/\s+/g, "")] || DEPT_ALIASES[stu];
    return !!(stuAliases && stuAliases.some((a) => normDept(a) === tn || normDept(a).includes(tn) || tn.includes(normDept(a))));
  });
}

function parseMinCgpa(eligibility) {
  if (!eligibility) return 0;
  const m = String(eligibility).match(/(\d+(?:\.\d+)?)/);
  return m ? parseFloat(m[1]) : 0;
}

function isEligible(drive) {
  const status = String(drive.status || "").toLowerCase();
  const depts = driveDepartments(drive);
  const min = parseMinCgpa(drive.eligibility);
  const cgpa = parseFloat(me.cgpa || 0);
  const closed = status === "closed";
  const branchOk = !closed && branchMatches(drive, me.department);
  const cgpaOk = !closed && (min <= 0 || cgpa >= min);
  const ok = !closed && branchOk && cgpaOk;
  if (typeof console !== "undefined" && console.debug) {
    console.debug("[eligibility]", {
      drive: drive.company,
      driveStatus: drive.status,
      driveDepartments: depts,
      driveMinCgpa: min,
      studentDepartment: me.department,
      studentYear: me.year,
      studentCgpa: cgpa,
      branchOk,
      cgpaOk,
      eligible: ok,
    });
  }
  return ok;
}

// ---------- helpers ----------
const $ = (sel) => document.querySelector(sel);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[c]));
function chip(status) {
  const map = { Open: "chip-success", "Closing Soon": "chip-warning", Upcoming: "chip-primary", Closed: "chip-danger", Published: "chip-success", Scheduled: "chip-primary", Completed: "chip-success", Cancelled: "chip-danger" };
  return `<span class="chip ${map[status] || "chip-primary"}">${esc(status || "—")}</span>`;
}
function fmtDate(v) { if (!v) return "—"; const d = new Date(v); return isNaN(d) ? esc(v) : d.toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" }); }
function fmtTime(v) { if (!v) return "—"; return esc(v); }

// ---------- views ----------
let currentView = "dashboard";
function switchView(name) {
  document.querySelectorAll("[data-view]").forEach((v) => v.classList.toggle("is-active", v.dataset.view === name));
  document.querySelectorAll("[data-view-link]").forEach((a) => a.classList.toggle("is-active", a.dataset.viewLink === name));
  const titles = {
    dashboard: ["Dashboard", "Your placement overview"],
    drives: ["Placement Drives", "Drives you are eligible for"],
    interviews: ["Interview Schedule", "Interviews for your applications"],
    announcements: ["Announcements", "Latest from the placement cell"],
    results: ["Results", "Your outcomes so far"],
    profile: ["My Profile", "Personal information"],
    aceai: ["ACE AI", "Placement prep assistant"],
  };
  const t = titles[name] || titles.dashboard;
  $("#viewTitle").textContent = t[0];
  $("#viewSubtitle").textContent = t[1];
  currentView = name;
  if (name === "profile") fillProfileForm();
  if (name === "aceai") renderAceChat();
  else renderAll();
}
document.addEventListener("click", (e) => {
  const link = e.target.closest("[data-view-link]");
  if (link) { e.preventDefault(); switchView(link.dataset.viewLink); }
  const quick = e.target.closest("[data-quick-action]");
  if (quick) { e.preventDefault(); switchView(quick.dataset.quickAction); }
});

// ---------- sidebar toggle ----------
$("#sidebarToggle")?.addEventListener("click", () => $("#dashShell").classList.toggle("is-collapsed"));

// ---------- topbar user ----------
function fillUser() {
  $("#userName").textContent = me.fullName || "Student";
  $("#userAvatar").textContent = (me.fullName || "S").trim().charAt(0).toUpperCase();
}

// ---------- render: dashboard + drives ----------
function eligibleDrives() {
  return drives.list().filter(isEligible);
}
function appliedDrives() {
  const ids = new Set(myApps().map((a) => a.driveId));
  return drives.list().filter((d) => ids.has(d.id));
}
function myInterviews() {
  const companies = new Set(appliedDrives().map((d) => (d.company || "").trim().toLowerCase()));
  return interviews.list().filter((i) => companies.has((i.company || "").trim().toLowerCase()));
}
function myResults() {
  const companies = new Set(appliedDrives().map((d) => (d.company || "").trim().toLowerCase()));
  return results.list().filter((r) => companies.has((r.company || "").trim().toLowerCase()));
}

function renderStats() {
  $("#stEligible").textContent = eligibleDrives().length;
  $("#stApplied").textContent = myApps().length;
  const now = Date.now();
  const upcoming = myInterviews().filter((i) => {
    if (!i.date) return true;
    const t = new Date(`${i.date}T${i.time || "00:00"}`).getTime();
    return isNaN(t) ? true : t >= now - 86400000;
  });
  $("#stInterviews").textContent = upcoming.length;
  $("#stResults").textContent = myResults().length;
}

function driveRow(d) {
  const applied = hasApplied(d.id);
  const btn = applied
    ? `<button class="btn btn-secondary btn-sm" disabled>Applied</button>`
    : `<button class="btn btn-primary btn-sm" data-apply="${d.id}">Apply</button>`;
  return `<tr>
    <td><strong>${esc(d.company)}</strong></td>
    <td>${esc(d.eligibility || "—")}</td>
    <td>${fmtDate(d.deadline)}</td>
    <td>${chip(d.status)}</td>
    <td>${btn}</td>
  </tr>`;
}
function renderRecent() {
  const list = eligibleDrives().slice(0, 5);
  const body = $("#recentDrivesBody");
  body.innerHTML = list.length ? list.map(driveRow).join("")
    : `<tr><td colspan="5">${emptyState({ icon: "drives", title: "No placement drives available.", subtitle: "The Placement Officer hasn't published any drives yet." })}</td></tr>`;
}

function driveCard(d) {
  const applied = hasApplied(d.id);
  const btn = applied
    ? `<button class="btn btn-secondary" disabled>Applied</button>`
    : `<button class="btn btn-primary" data-apply="${d.id}">Apply</button>`;
  return `<article class="stu-card">
    <div class="stu-card-head">
      <div>
        <div class="stu-card-title">${esc(d.company)}</div>
        <div class="stu-card-role">${esc(d.role || "Not Specified")}</div>
      </div>
      ${chip(d.status)}
    </div>
    <div class="stu-meta">
      <span><strong>Eligibility:</strong> ${esc(d.eligibility || "—")}</span>
      <span><strong>Departments:</strong> ${esc(formatDepartments(d))}</span>
      <span><strong>Deadline:</strong> ${fmtDate(d.deadline)}</span>
    </div>
    ${d.description ? `<p class="stu-desc">${esc(d.description)}</p>` : ""}
    <div class="stu-card-actions">${btn}</div>
  </article>`;
}
function renderDrivesView() {
  const list = eligibleDrives();
  const grid = $("#drivesGrid");
  grid.innerHTML = list.length ? list.map(driveCard).join("")
    : `<div style="grid-column:1/-1;">${emptyState({ icon: "drives", title: "No placement drives available.", subtitle: "The Placement Officer hasn't published any drives yet." })}</div>`;
}

// ---------- interviews ----------
function renderInterviews() {
  const list = myInterviews().slice().sort((a, b) => new Date(`${a.date||""}T${a.time||"00:00"}`) - new Date(`${b.date||""}T${b.time||"00:00"}`));
  const body = $("#interviewsBody");
  body.innerHTML = list.length ? list.map((i) => `<tr>
    <td><strong>${esc(i.company)}</strong></td>
    <td>${fmtDate(i.date)}</td>
    <td>${fmtTime(i.time)}</td>
    <td>${esc(i.venue || "—")}</td>
    <td>${chip(i.status || "Scheduled")}</td>
  </tr>`).join("")
    : `<tr><td colspan="5">${emptyState({ icon: "interview", title: "No interviews scheduled.", subtitle: "Interview schedules published by the Placement Officer will appear here." })}</td></tr>`;
}

// ---------- announcements ----------
function annCard(a) {
  const posterUrl = a.posterUrl || a.poster || "";
  const pdfUrl = a.pdfUrl || a.pdf || "";
  const posterName = a.posterName || `${(a.title || "poster").replace(/[^\w\-]+/g, "_")}.png`;
  const pdfName = a.pdfName || `${(a.title || "attachment").replace(/[^\w\-]+/g, "_")}.pdf`;
  const items = [];
  if (posterUrl) {
    items.push(`<div class="ann-attach">
      <span class="ann-attach-label">🖼️ Poster Available</span>
      <div class="ann-attach-actions">
        <button type="button" class="btn btn-secondary btn-sm" data-view-attach="${esc(posterUrl)}" data-kind="poster" data-name="${esc(posterName)}">View Poster</button>
        <button type="button" class="btn btn-secondary btn-sm" data-download-attach="${esc(posterUrl)}" data-name="${esc(posterName)}">Download Poster</button>
      </div>
    </div>`);
  }
  if (pdfUrl) {
    items.push(`<div class="ann-attach">
      <span class="ann-attach-label">📄 PDF Available</span>
      <div class="ann-attach-actions">
        <button type="button" class="btn btn-secondary btn-sm" data-view-attach="${esc(pdfUrl)}" data-kind="pdf" data-name="${esc(pdfName)}">View PDF</button>
        <button type="button" class="btn btn-secondary btn-sm" data-download-attach="${esc(pdfUrl)}" data-name="${esc(pdfName)}">Download PDF</button>
      </div>
    </div>`);
  }
  return `<article class="stu-card">
    <div class="stu-card-head">
      <div>
        <div class="stu-card-title">${esc(a.title)}</div>
        <div class="stu-card-role">${a.publishedAt ? fmtDate(a.publishedAt) : "Draft"}</div>
      </div>
      ${chip(a.status || "Published")}
    </div>
    <p class="stu-desc">${esc(a.description || "")}</p>
    ${items.length ? `<div class="ann-attachments">${items.join("")}</div>` : ""}
  </article>`;
}
function renderAnnouncements() {
  const list = announcements.list()
    .filter((a) => a.status !== "Draft")
    .slice()
    .sort((a, b) => (b.publishedAt || 0) - (a.publishedAt || 0));
  $("#annList").innerHTML = list.length ? list.map(annCard).join("")
    : emptyState({ icon: "announce", title: "No announcements.", subtitle: "Announcements from the Placement Cell will appear here." });
}

// ---------- attachment view/download ----------
async function urlToBlob(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error("fetch failed");
  return res.blob();
}
async function downloadAttachment(url, filename) {
  try {
    const blob = await urlToBlob(url);
    const blobUrl = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = blobUrl;
    a.download = filename || "attachment";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
  } catch {
    window.open(url, "_blank", "noopener");
  }
}
async function openBlockedFallback(url, kind, filename) {
  const label = kind === "poster" ? "Poster" : "PDF";
  const ok = await confirmDialog({
    title: "Attachment blocked",
    message: `Your browser blocked opening the ${label.toLowerCase()} automatically.`,
    confirmText: `Download ${label}`,
    cancelText: "Close",
    tone: "info",
  });
  if (ok) downloadAttachment(url, filename);
}
async function viewAttachment(url, kind, filename) {
  try {
    const blob = await urlToBlob(url);
    const typed = kind === "pdf" && blob.type !== "application/pdf"
      ? new Blob([blob], { type: "application/pdf" })
      : blob;
    const blobUrl = URL.createObjectURL(typed);
    // Use an anchor click (not window.open) — some Chrome extensions
    // block window.open(blob:) with ERR_BLOCKED_BY_CLIENT. Do NOT
    // revoke the blob URL immediately; the new tab still needs it.
    const a = document.createElement("a");
    a.href = blobUrl;
    a.target = "_blank";
    a.rel = "noopener";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  } catch {
    openBlockedFallback(url, kind, filename);
  }
}
document.addEventListener("click", (e) => {
  const vt = e.target.closest("[data-view-attach]");
  if (vt) {
    e.preventDefault();
    viewAttachment(vt.dataset.viewAttach, vt.dataset.kind, vt.dataset.name);
    return;
  }
  const dl = e.target.closest("[data-download-attach]");
  if (dl) {
    e.preventDefault();
    downloadAttachment(dl.dataset.downloadAttach, dl.dataset.name);
  }
});

// ---------- results ----------
function parseNames(v) { return String(v || "").split(/\r?\n|,/).map((s) => s.trim()).filter(Boolean); }

function studentInList(list) {
  const needles = [me.fullName, me.registerNumber, me.email].filter(Boolean).map((s) => s.toLowerCase());
  return list.some((n) => { const low = n.toLowerCase(); return needles.some((x) => low === x || low.includes(x) || x.includes(low)); });
}

function resultCard(r) {
  const sel = parseNames(r.selected);
  const rej = parseNames(r.rejected);
  const isSelected = studentInList(sel);
  const isRejected = !isSelected && studentInList(rej);
  const badge = isSelected
    ? `<span class="chip chip-success">Selected</span>`
    : `<span class="chip chip-danger">Not Selected</span>`;
  const message = isSelected
    ? `<div class="result-status is-success"><div class="result-status-title">✅ Congratulations!</div><div class="result-status-text">You have been placed in this company.</div></div>`
    : `<div class="result-status is-danger"><div class="result-status-title">❌ Better luck next time.</div><div class="result-status-text">You were not selected for this placement drive.</div></div>`;
  return `<article class="stu-card">
    <div class="stu-card-head">
      <div>
        <div class="stu-card-title">${esc(r.company)}</div>
        <div class="stu-card-role">${r.publishedAt ? fmtDate(r.publishedAt) : ""}</div>
      </div>
      ${badge}
    </div>
    ${message}
  </article>`;
}
function renderResults() {
  const list = myResults()
    .filter((r) => {
      const sel = parseNames(r.selected);
      const rej = parseNames(r.rejected);
      return studentInList(sel) || studentInList(rej);
    })
    .slice()
    .sort((a, b) => (b.publishedAt || 0) - (a.publishedAt || 0));
  $("#resultsList").innerHTML = list.length ? list.map(resultCard).join("")
    : emptyState({ icon: "results", title: "No results published.", subtitle: "Published placement results will appear here." });
}

// ---------- profile ----------
function fillProfileForm() {
  $("#pfName").value = me.fullName || "";
  $("#pfReg").value = me.registerNumber || "";
  $("#pfEmail").value = me.email || "";
  $("#pfDept").value = me.department || "";
  $("#pfYear").value = me.year || "";
  $("#pfCgpa").value = me.cgpa || "";
  $("#pfPass").value = "";
  const p2 = $("#pfPass2"); if (p2) p2.value = "";
  const pPhone = $("#pfPhone"); if (pPhone) pPhone.value = me.phone || "";
  const pLi = $("#pfLinkedin"); if (pLi) pLi.value = me.linkedin || "";
  const pGh = $("#pfGithub"); if (pGh) pGh.value = me.github || "";
  const msg = $("#pfMsg"); if (msg) { msg.textContent = ""; msg.className = "form-msg"; }
  renderResumeCard();
  renderProfilePic();
}

function renderResumeCard() {
  const status = $("#pfResumeStatus");
  const nameEl = $("#pfResumeName");
  const dl = $("#pfResumeDownload");
  const btnLabel = $("#pfResumeBtnLabel");
  if (!status) return;
  const has = !!me.resumeUrl;
  status.classList.toggle("is-uploaded", has);
  status.querySelector(".resume-status-text").textContent = has ? "🟢 Uploaded" : "🔴 Not Uploaded";
  if (nameEl) nameEl.textContent = has ? (me.resumeName || "Resume uploaded") : "No resume uploaded yet.";
  if (btnLabel) btnLabel.textContent = has ? "Replace Resume" : "Upload Resume";
  if (dl) {
    if (has) { dl.href = me.resumeUrl; dl.setAttribute("download", me.resumeName || "resume.pdf"); dl.hidden = false; }
    else { dl.hidden = true; }
  }
}

function renderProfilePic() {
  const wrap = $("#pfPicPreview");
  const initial = $("#pfPicInitial");
  const remove = $("#pfPicRemove");
  const btnLabel = $("#pfPicBtnLabel");
  const avatar = $("#userAvatar");
  if (!wrap) return;
  const url = me.profilePicture || "";
  if (url) {
    wrap.style.backgroundImage = `url(${JSON.stringify(url).slice(1,-1)})`;
    wrap.classList.add("has-image");
    if (initial) initial.style.display = "none";
    if (remove) remove.hidden = false;
    if (btnLabel) btnLabel.textContent = "Replace Picture";
    if (avatar) { avatar.style.backgroundImage = `url(${JSON.stringify(url).slice(1,-1)})`; avatar.textContent = ""; avatar.classList.add("has-image"); }
  } else {
    wrap.style.backgroundImage = "";
    wrap.classList.remove("has-image");
    if (initial) { initial.style.display = ""; initial.textContent = (me.fullName || "S").trim().charAt(0).toUpperCase(); }
    if (remove) remove.hidden = true;
    if (btnLabel) btnLabel.textContent = "Upload Picture";
    if (avatar) { avatar.style.backgroundImage = ""; avatar.classList.remove("has-image"); avatar.textContent = (me.fullName || "S").trim().charAt(0).toUpperCase(); }
  }
}

// Resume upload → saved on student record in Supabase
document.addEventListener("change", (e) => {
  const input = e.target;
  if (input && input.id === "pfResume" && input.files && input.files[0]) {
    const file = input.files[0];
    if (file.type !== "application/pdf") { const msg = $("#pfMsg"); if (msg) { msg.textContent = "Resume must be a PDF file."; msg.className = "form-msg is-error"; } return; }
    if (file.size > 5 * 1024 * 1024) { const msg = $("#pfMsg"); if (msg) { msg.textContent = "Resume must be under 5MB."; msg.className = "form-msg is-error"; } return; }
    const reader = new FileReader();
    reader.onload = async () => {
      await saveStudentProfile({ resumeUrl: reader.result, resumeName: file.name });
      fillProfileForm();
      renderResumeCard();
      toast("Resume uploaded.");
      notifyOfficer({
        title: "Resume Uploaded",
        message: `${me.fullName || "A student"} uploaded a resume.`,
        type: "resume",
      });
    };
    reader.readAsDataURL(file);
    input.value = "";
    return;
  }
  if (input && input.id === "pfPicInput" && input.files && input.files[0]) {
    const file = input.files[0];
    if (!/^image\//.test(file.type)) { toast("Profile picture must be an image.", "error"); return; }
    if (file.size > 2 * 1024 * 1024) { toast("Image must be under 2MB.", "error"); return; }
    const reader = new FileReader();
    reader.onload = async () => {
      await saveStudentProfile({ profilePicture: reader.result });
      renderProfilePic();
      toast("Profile picture updated.");
    };
    reader.readAsDataURL(file);
    input.value = "";
  }
});

document.addEventListener("click", (e) => {
  const rm = e.target.closest("#pfPicRemove");
  if (rm) {
    e.preventDefault();
    saveStudentProfile({ profilePicture: "" }).then(() => {
      renderProfilePic();
      toast("Profile picture removed.");
    });
  }
});

$("#profileForm")?.addEventListener("submit", async (e) => {
  e.preventDefault();
  const cgpa = parseFloat($("#pfCgpa").value);
  const pass = $("#pfPass").value;
  const pass2 = $("#pfPass2")?.value || "";
  const phone = ($("#pfPhone")?.value || "").trim();
  const linkedin = ($("#pfLinkedin")?.value || "").trim();
  const github = ($("#pfGithub")?.value || "").trim();
  const msg = $("#pfMsg");
  if (isNaN(cgpa) || cgpa < 0 || cgpa > 10) { msg.textContent = "Enter a valid CGPA (0–10)."; msg.className = "form-msg is-error"; return; }
  if (phone && !/^\d{10}$/.test(phone)) { msg.textContent = "Phone number must be exactly 10 digits."; msg.className = "form-msg is-error"; return; }
  if (linkedin && !/^https?:\/\/([a-z0-9-]+\.)*linkedin\.com\/.+/i.test(linkedin)) { msg.textContent = "Enter a valid linkedin.com URL."; msg.className = "form-msg is-error"; return; }
  if (github && !/^https?:\/\/([a-z0-9-]+\.)*github\.com\/.+/i.test(github)) { msg.textContent = "Enter a valid github.com URL."; msg.className = "form-msg is-error"; return; }
  if (pass || pass2) {
    if (pass.length < 8) { msg.textContent = "Password must be at least 8 characters."; msg.className = "form-msg is-error"; return; }
    if (pass !== pass2) { msg.textContent = "Passwords do not match."; msg.className = "form-msg is-error"; return; }
    
    // Update password in Supabase Auth
    const { error } = await supabase.auth.updateUser({ password: pass });
    if (error) {
      msg.textContent = error.message;
      msg.className = "form-msg is-error";
      return;
    }
  }
  
  await saveStudentProfile({ cgpa: cgpa.toFixed(2), phone, linkedin, github });
  msg.textContent = ""; msg.className = "form-msg";
  toast("Profile updated successfully.");
  notifyOfficer({
    title: "Profile Updated",
    message: `${me.fullName || "A student"} updated profile.`,
    type: "profile",
  });
  renderAll();
  fillProfileForm();
});

// ---------- modal + toast ----------
const modal = {
  root: null, title: null, body: null, ready: false,
  init() {
    this.root = $("#modalRoot");
    this.title = $("#modalTitle");
    this.body = $("#modalBody");
    if (!this.root || this.ready) return;
    this.ready = true;
    this.root.addEventListener("click", (e) => {
      if (e.target.matches("[data-modal-close]") || e.target.closest("[data-modal-close]")) this.close();
    });
    document.addEventListener("keydown", (e) => { if (e.key === "Escape") this.close(); });
  },
  open(title, html) {
    this.init();
    if (!this.root) return;
    this.title.textContent = title;
    this.body.innerHTML = html;
    this.root.classList.add("is-open");
    this.root.setAttribute("aria-hidden", "false");
  },
  close() {
    if (!this.root) return;
    this.root.classList.remove("is-open");
    this.root.setAttribute("aria-hidden", "true");
    this.body.innerHTML = "";
  },
};

function toast(message, type = "success") {
  const root = $("#toastRoot");
  if (!root) return;
  const el = document.createElement("div");
  el.className = `toast${type === "error" ? " is-error" : ""}`;
  el.textContent = message;
  root.appendChild(el);
  setTimeout(() => { el.classList.add("is-out"); setTimeout(() => el.remove(), 260); }, 2600);
}

// ---------- apply handler ----------
function openApplyConfirm(driveId) {
  const d = drives.list().find((x) => x.id === driveId);
  if (!d) return;
  const html = `
    <dl class="detail-list">
      <dt>Company</dt><dd><strong>${esc(d.company)}</strong></dd>
      <dt>Role</dt><dd>${esc(d.role || "Not Specified")}</dd>
      <dt>Eligibility</dt><dd>${esc(d.eligibility || "—")}</dd>
      <dt>Eligible Departments</dt><dd>${esc(formatDepartments(d))}</dd>
      <dt>Last Date</dt><dd>${fmtDate(d.deadline)}</dd>
    </dl>
    ${d.description ? `<div><div style="color:var(--text-dim);font-size:0.85rem;margin-bottom:6px;">Job Description</div><div class="confirm-desc">${esc(d.description)}</div></div>` : ""}
    <p class="confirm-copy">Are you sure you want to apply for this placement drive?<br/>Once submitted, your application will be visible to the Placement Officer.</p>
    <div class="confirm-actions">
      <button type="button" class="btn btn-secondary" data-modal-close>Cancel</button>
      <button type="button" class="btn btn-primary" data-apply-confirm="${esc(d.id)}">Apply Now</button>
    </div>
  `;
  modal.open("Apply for Placement Drive", html);
}

document.addEventListener("click", (e) => {
  const btn = e.target.closest("[data-apply]");
  if (btn) {
    e.preventDefault();
    if (hasApplied(btn.dataset.apply)) return;
    openApplyConfirm(btn.dataset.apply);
    return;
  }
  const confirmBtn = e.target.closest("[data-apply-confirm]");
  if (confirmBtn) {
    e.preventDefault();
    const id = confirmBtn.dataset.applyConfirm;
    apply(id);
    modal.close();
    toast("Application submitted successfully.");
    renderAll();
  }
});

// ---------- ACE AI ----------
const ACE_KEY = "campace.ace.chat.v1";
let aceHistory = [];
try { aceHistory = JSON.parse(localStorage.getItem(ACE_KEY) || "[]"); } catch {}
let aceTyping = false;

// Quick prompt cards → auto-send this exact prompt
const QUICK_PROMPTS = [
  { label: "Resume Review",         prompt: "Review my resume and suggest improvements." },
  { label: "HR Interview Questions", prompt: "Give me common HR interview questions with tips." },
  { label: "Aptitude Practice",     prompt: "Give me an aptitude practice plan." },
  { label: "DBMS Revision",         prompt: "Give me a quick DBMS revision list." },
  { label: "Operating Systems",     prompt: "Give me a quick Operating Systems revision list." },
  { label: "Computer Networks",     prompt: "Give me a quick Computer Networks revision list." },
  { label: "OOPS",                  prompt: "Give me a quick OOPS revision list." },
  { label: "DSA",                   prompt: "What DSA topics should I focus on for placements?" },
  { label: "SQL",                   prompt: "Give me a quick SQL revision list." },
  { label: "Company Preparation",   prompt: "How do I prepare for a company-specific placement drive?" },
];

const SUGGESTED_QUESTIONS = [
  "How do I prepare for TCS interview?",
  "Explain DBMS normalization.",
  "Give me HR interview questions.",
  "Generate aptitude questions.",
  "Review my resume.",
  "Explain OOPS concepts.",
];

// ---- Placeholder response engine (swap this out for OpenAI/Gemini later) ----
const ACE_RESPONSES = [
  { match: ["resume", "cv"],
    text: "Your resume should include measurable achievements, technical skills and projects relevant to the job. Keep it to one page, lead with impact bullets (Action + Metric + Outcome), tailor keywords to the JD, and link 2–3 strong projects." },
  { match: ["hr", "hr question", "hr interview"],
    text: "Common HR questions include:\n• Tell me about yourself.\n• Why should we hire you?\n• What are your strengths?\n• Describe a challenge you solved.\nUse the STAR method and end each answer with why you're a fit for the role." },
  { match: ["aptitude"],
    text: "Aptitude practice plan:\n• 45 mins/day split across Quant, Logical, Verbal.\n• Focus on ratios, probability, permutations, seating arrangements, and reading comprehension.\n• Take one timed mock every weekend and review every wrong answer." },
  { match: ["dbms", "normalization", "normalisation"],
    text: "Revise:\n• Normalization (1NF → BCNF)\n• Transactions\n• Joins\n• Indexing\n• ACID Properties" },
  { match: ["dsa", "data structure", "algorithm"],
    text: "Focus on:\n• Arrays\n• Strings\n• Linked Lists\n• Trees\n• Graphs\n• Dynamic Programming" },
  { match: ["oops", "oop", "object oriented"],
    text: "Master the four pillars — Encapsulation, Inheritance, Polymorphism, Abstraction. Know overloading vs overriding, virtual functions, and the SOLID principles with a code example for each." },
  { match: ["operating system", " os ", "^os$", "os revision"],
    text: "Operating Systems focus areas:\n• Process vs Thread\n• CPU scheduling algorithms\n• Synchronization (semaphores, mutex, deadlock)\n• Memory management (paging, segmentation)\n• File systems" },
  { match: ["computer network", "networking", " cn ", "^cn$"],
    text: "Computer Networks key topics:\n• OSI vs TCP/IP layers\n• TCP 3-way handshake, TCP vs UDP\n• IP addressing & subnetting\n• DNS, DHCP, HTTP(S)\n• Routing basics and congestion control" },
  { match: ["sql", "query"],
    text: "SQL revision list:\n• SELECT / WHERE / GROUP BY / HAVING\n• Joins (INNER, LEFT, RIGHT, FULL)\n• Subqueries and CTEs\n• Window functions\n• Indexing & query optimization" },
  { match: ["tcs", "infosys", "wipro", "zoho", "company"],
    text: "Company preparation checklist:\n• Study the company's tech stack, products and recent news.\n• Practice their previous year aptitude & coding rounds.\n• Prepare 2–3 STAR stories aligned to their values.\n• Draft 3 thoughtful questions to ask the interviewer." },
  { match: ["interview"],
    text: "Interview prep structure:\n1) Company & role research\n2) STAR-method behavioral stories\n3) Core DSA + system design refresh\n4) 2–3 mock interviews\n5) Prepare 3 thoughtful questions of your own." },
];

/**
 * generateAIResponse(message) — currently returns a placeholder string.
 * Replace the body with an OpenAI / Gemini call later; the UI does not
 * need to change as long as this returns (or resolves to) a string.
 */
function generateAIResponse(message) {
  const q = String(message || "").toLowerCase();
  for (const rule of ACE_RESPONSES) {
    if (rule.match.some((k) => q.includes(k.replace(/[\^$]/g, "").trim()))) {
      return rule.text;
    }
  }
  return `Thanks for your question — "${message}". ACE AI's live model isn't connected yet, but here's a quick tip: break the topic into 3 sub-topics, revise theory, then solve 5 practice problems. Try a quick prompt below to see a detailed answer.`;
}

function acePersist() {
  try { localStorage.setItem(ACE_KEY, JSON.stringify(aceHistory)); } catch {}
}

function renderAceChat() {
  const quick = $("#aceQuick");
  if (quick && !quick.dataset.ready) {
    quick.innerHTML = QUICK_PROMPTS.map((p) =>
      `<button type="button" class="ace-quick-btn" data-ace-prompt="${esc(p.prompt)}">${esc(p.label)}</button>`
    ).join("");
    quick.dataset.ready = "1";
  }

  const chat = $("#aceChat");
  if (!chat) return;

  let html = "";
  if (!aceHistory.length) {
    html += `
      <div class="ace-empty">
        <div class="ace-empty-icon" aria-hidden="true">✦</div>
        <h4>No conversation yet.</h4>
        <p>Start chatting with ACE AI — your personal placement assistant.</p>
        <div class="ace-suggested-block">
          <span class="ace-suggested-title">Suggested Questions</span>
          <div class="ace-suggested-list">
            ${SUGGESTED_QUESTIONS.map((q) =>
              `<button type="button" class="ace-suggested-item" data-ace-prompt="${esc(q)}">${esc(q)}</button>`
            ).join("")}
          </div>
        </div>
      </div>`;
  } else {
    html += aceHistory.map((m) => {
      const who = m.role === "user" ? "You" : "ACE AI";
      return `<div class="ace-row ${m.role}">
        <div class="ace-avatar ${m.role}" aria-hidden="true">${m.role === "user" ? "🧑" : "✦"}</div>
        <div class="ace-bubble">
          <div class="ace-who">${esc(who)}</div>
          <div class="ace-text">${esc(m.text)}</div>
        </div>
      </div>`;
    }).join("");
  }

  if (aceTyping) {
    html += `<div class="ace-row bot">
      <div class="ace-avatar bot" aria-hidden="true">✦</div>
      <div class="ace-bubble ace-typing"><span></span><span></span><span></span><em>ACE AI is typing…</em></div>
    </div>`;
  }

  chat.innerHTML = html;
  chat.scrollTop = chat.scrollHeight;
}

function aceAsk(text) {
  const q = String(text || "").trim();
  if (!q || aceTyping) return;
  aceHistory.push({ role: "user", text: q, at: Date.now() });
  acePersist();
  aceTyping = true;
  renderAceChat();

  setTimeout(async () => {
    try {
      const reply = await generateAIResponse(q);
      aceHistory.push({ role: "bot", text: String(reply ?? ""), at: Date.now() });
    } catch {
      aceHistory.push({ role: "bot", text: "Sorry, I couldn't respond just now. Please try again.", at: Date.now() });
    } finally {
      if (aceHistory.length > 200) aceHistory = aceHistory.slice(-200);
      aceTyping = false;
      acePersist();
      renderAceChat();
    }
  }, 1000);
}

document.addEventListener("click", (e) => {
  const p = e.target.closest("[data-ace-prompt]");
  if (p) { e.preventDefault(); aceAsk(p.dataset.acePrompt); }
});

$("#aceForm")?.addEventListener("submit", (e) => {
  e.preventDefault();
  const input = $("#aceInput");
  if (!input) return;
  const v = input.value;
  input.value = "";
  aceAsk(v);
  input.focus();
});

// Enter to send, Shift+Enter for newline
$("#aceInput")?.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    $("#aceForm")?.requestSubmit();
  }
});

// New Chat = start fresh but keep prior history discarded (per spec: clears current conversation)
$("#aceNewChatBtn")?.addEventListener("click", () => {
  if (!aceHistory.length) return;
  aceHistory = [];
  aceTyping = false;
  acePersist();
  renderAceChat();
  $("#aceInput")?.focus();
});

// Clear Chat = wipe stored history entirely
$("#aceClearChatBtn")?.addEventListener("click", async () => {
  if (!aceHistory.length) return;
  const ok = await confirmDialog({
    title: "Clear chat history?",
    message: "This will remove your entire ACE AI conversation. This action cannot be undone.",
    confirmText: "Clear chat",
    tone: "danger",
  });
  if (!ok) return;
  aceHistory = [];
  aceTyping = false;
  try { localStorage.removeItem(ACE_KEY); } catch {}
  renderAceChat();
  toast("Chat history cleared.");
});

// ---------- logout ----------
$("#logoutBtn")?.addEventListener("click", async (e) => {
  e.preventDefault();
  const ok = await confirmDialog({
    title: "Log out?",
    message: "You will be returned to the login screen.",
    confirmText: "Log out",
    tone: "danger",
  });
  if (!ok) return;
  logoutStudent();
  window.location.href = "/student-login.html";
});

// ---------- render all + live updates ----------
// Only render panels that belong to the currently active view — hidden
// tabs don't need fresh innerHTML on every store mutation.
const STU_VIEW_RENDERERS = {
  dashboard: () => { renderStats(); renderRecent(); },
  drives: () => { renderDrivesView(); },
  interviews: () => { renderInterviews(); },
  announcements: () => { renderAnnouncements(); },
  results: () => { renderResults(); },
  profile: () => { /* profile form is filled on switch */ },
  aceai: () => { /* chat is rendered on switch */ },
};
function renderAll() {
  (STU_VIEW_RENDERERS[currentView] || STU_VIEW_RENDERERS.dashboard)();
}
fillUser();
// ---------- notifications bell ----------
const notifMount = document.getElementById("notifMount");
if (notifMount) initNotificationBell({ mount: notifMount, userType: "student", userId: me.id });
renderAll();
subscribe(() => renderAll());
