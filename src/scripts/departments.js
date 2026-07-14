// Canonical department list — the single source of truth used by:
//   • Student Registration
//   • Student Profile
//   • Placement Drive Creation (multi-select)
//   • Officer Analytics filters
//
// Values are the full official names — never store abbreviations (CSE, IT,
// ECE, …). Eligibility checks compare a drive's stored `departments` array
// against the student's `department` string using strict equality:
//   drive.departments.includes(student.department)

export const DEPARTMENTS = [
  "Aeronautical Engineering",
  "Artificial Intelligence & Data Science",
  "Artificial Intelligence & Machine Learning",
  "Automobile Engineering",
  "Biomedical Engineering",
  "Biotechnology",
  "Chemical Engineering",
  "Civil Engineering",
  "Computer Science & Business Systems",
  "Computer Science & Design",
  "Computer Science & Engineering",
  "Computer Science & Engineering (Cyber Security)",
  "Electrical & Electronics Engineering",
  "Electronics & Communication Engineering",
  "Food Technology",
  "Information Technology",
  "Mechanical Engineering",
  "Mechatronics Engineering",
];

// Normalize a drive's eligibility to a departments array. Handles legacy
// records that stored `branches` as a comma-separated string, and new records
// that store `departments` as a proper array.
export function driveDepartments(drive) {
  if (!drive) return [];
  if (Array.isArray(drive.departments)) return drive.departments.filter(Boolean);
  if (Array.isArray(drive.branches)) return drive.branches.filter(Boolean);
  if (typeof drive.branches === "string" && drive.branches.trim()) {
    return drive.branches.split(",").map((s) => s.trim()).filter(Boolean);
  }
  return [];
}

// Human-readable summary for cards / tables.
export function formatDepartments(drive) {
  const list = driveDepartments(drive);
  if (!list.length) return "All Departments";
  if (list.length === DEPARTMENTS.length) return "All Departments";
  return list.join(", ");
}
