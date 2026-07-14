// Export helpers for Officer Dashboard — CSV + XLSX from localStorage data.
import * as XLSX from "xlsx";

function todayStamp() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

function safeSlug(s) {
  return String(s || "All").trim().replace(/[^\w.\- ]+/g, "_").replace(/\s+/g, "_") || "All";
}

function csvEscape(v) {
  if (v == null) return "";
  const s = String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function toCSV(rows) {
  if (!rows.length) return "";
  const headers = Object.keys(rows[0]);
  const lines = [headers.join(",")];
  for (const r of rows) lines.push(headers.map((h) => csvEscape(r[h])).join(","));
  // BOM for Excel compatibility
  return "\uFEFF" + lines.join("\r\n");
}

function triggerDownload(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 500);
}

export function downloadCSV(rows, filename) {
  const csv = toCSV(rows);
  triggerDownload(new Blob([csv], { type: "text/csv;charset=utf-8" }), filename);
}

export function downloadXLSX(rows, filename, sheetName = "Sheet1") {
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName.slice(0, 31) || "Sheet1");
  const out = XLSX.write(wb, { bookType: "xlsx", type: "array" });
  triggerDownload(
    new Blob([out], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }),
    filename
  );
}

export function buildAppFilename(company, ext) {
  return `Applications_${safeSlug(company)}_${todayStamp()}.${ext}`;
}
export function buildSelectedFilename(company, ext) {
  return `Selected_Students_${safeSlug(company)}_${todayStamp()}.${ext}`;
}
export function buildRejectedFilename(company, ext) {
  return `Rejected_Students_${safeSlug(company)}_${todayStamp()}.${ext}`;
}

// ---- Toast ----
let toastRoot = null;
export function showToast(message, tone = "success") {
  if (!toastRoot) {
    toastRoot = document.createElement("div");
    toastRoot.className = "export-toast-root";
    document.body.appendChild(toastRoot);
  }
  const t = document.createElement("div");
  t.className = `export-toast export-toast-${tone}`;
  t.textContent = message;
  toastRoot.appendChild(t);
  requestAnimationFrame(() => t.classList.add("is-in"));
  setTimeout(() => {
    t.classList.remove("is-in");
    setTimeout(() => t.remove(), 250);
  }, 2600);
}