// Icon set (inline SVG)
const icon = (path) =>
  `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${path}</svg>`;

const FEATURES = [
  { t: "Student Dashboard", d: "One home for opportunities, applications and prep — tailored to each student.", i: icon('<rect x="3" y="3" width="7" height="9"/><rect x="14" y="3" width="7" height="5"/><rect x="14" y="12" width="7" height="9"/><rect x="3" y="16" width="7" height="5"/>') },
  { t: "Placement Drive Management", d: "The Placement Officer creates and manages every drive from a single console.", i: icon('<path d="M8 2v4M16 2v4M3 10h18M5 6h14a2 2 0 012 2v11a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2z"/>') },
  { t: "AI Resume Review", d: "ACE AI scores resumes and suggests fixes aligned to each drive's requirements.", i: icon('<path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><path d="M14 2v6h6M9 13h6M9 17h4"/>') },
  { t: "Interview Preparation", d: "Company-specific mock tests, HR simulations and personalized study plans.", i: icon('<path d="M12 3l9 4-9 4-9-4 9-4z"/><path d="M3 7v6a9 4 0 0018 0V7"/>') },
  { t: "Application Tracking", d: "Every application, shortlist and result — visible in real time.", i: icon('<path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/>') },
  { t: "Interview Scheduling", d: "Slots, rooms and reminders auto-published to eligible students.", i: icon('<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>') },
  { t: "Placement Analytics", d: "Live insights on offers, packages and department performance for the Cell.", i: icon('<path d="M3 3v18h18"/><path d="M7 15l4-4 4 4 5-6"/>') },
  { t: "Announcements", d: "Broadcast workshops, deadlines and results to the right students, instantly.", i: icon('<path d="M3 11l18-8v18L3 13v-2z"/><path d="M11.6 16.8a3 3 0 11-5.8-1.6"/>') },
];

const WORKFLOW = [
  "Company sends requirements to Placement Cell",
  "Placement Cell receives details",
  "Placement Officer creates drive",
  "Eligibility criteria added",
  "Eligible students notified",
  "Students apply",
  "Interviews & results published",
];

const DRIVES = [
  { co: "Zoho", color: "linear-gradient(135deg,#e11d48,#b91c1c)", role: "Software Engineer", pkg: "6.0 LPA", deadline: "15 Jul 2026", cgpa: "7.5", branch: "CSE, IT, ECE", loc: "Chennai", tag: "Eligible" },
  { co: "Infosys", color: "linear-gradient(135deg,#0284c7,#0369a1)", role: "Systems Engineer", pkg: "4.5 LPA", deadline: "18 Jul 2026", cgpa: "6.5", branch: "All Branches", loc: "Bengaluru", tag: "Open" },
  { co: "TCS", color: "linear-gradient(135deg,#4f46e5,#3730a3)", role: "Digital Trainee", pkg: "7.0 LPA", deadline: "22 Jul 2026", cgpa: "7.0", branch: "CSE, IT, EEE", loc: "Hyderabad", tag: "Open" },
];

const ANNOUNCEMENTS = [
  { tag: "Workshop", tagClass: "chip-accent", date: "Fri · 11 Jul", title: "Resume Building Workshop", desc: "Hands-on session with the Placement Cell in Seminar Hall A." },
  { tag: "Practice", tagClass: "chip-primary", date: "Sat · 12 Jul", title: "Mock Interview Marathon", desc: "One-on-one HR + tech mocks with senior alumni panelists." },
  { tag: "Contest", tagClass: "chip-warning", date: "Sun · 13 Jul", title: "Campus Coding Contest", desc: "2-hour contest to shortlist for premium company drives." },
  { tag: "Training", tagClass: "chip-success", date: "Mon · 14 Jul", title: "Placement Training Week", desc: "Daily aptitude + soft-skills training for final-year students." },
];

export function renderFeatures() {
  const el = document.getElementById("featureGrid");
  if (!el) return;
  el.innerHTML = FEATURES.map((f) => `
    <article class="card feature-card reveal">
      <div class="f-icon">${f.i}</div>
      <h3 class="f-title">${f.t}</h3>
      <p class="f-desc">${f.d}</p>
    </article>
  `).join("");
}

export function wireFeatureCards() {
  document.querySelectorAll(".feature-card").forEach((card) => {
    card.addEventListener("mousemove", (e) => {
      const r = card.getBoundingClientRect();
      card.style.setProperty("--mx", `${((e.clientX - r.left) / r.width) * 100}%`);
      card.style.setProperty("--my", `${((e.clientY - r.top) / r.height) * 100}%`);
    });
  });
}

export function renderWorkflow() {
  const el = document.getElementById("workflow");
  if (!el) return;
  el.innerHTML = WORKFLOW.map((step, i) => `
    <li class="wf-step">
      <div class="wf-num">${String(i + 1).padStart(2, "0")}</div>
      <div class="wf-label">${step}</div>
    </li>
  `).join("");
}

export function renderAnnouncements() {
  const el = document.getElementById("annGrid");
  if (!el) return;
  el.innerHTML = ANNOUNCEMENTS.map((a) => `
    <article class="card ann-card reveal">
      <div class="ann-head">
        <span class="chip ${a.tagClass}">${a.tag}</span>
        <span class="ann-date">${a.date}</span>
      </div>
      <div class="ann-title">${a.title}</div>
      <p class="ann-desc">${a.desc}</p>
      <a class="ann-more" href="#">Read more →</a>
    </article>
  `).join("");
}