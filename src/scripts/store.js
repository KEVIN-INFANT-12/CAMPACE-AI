import { supabase } from "./supabase.js";

const KEY = "campace.dashboard.v1";

const DEFAULT_STATE = {
  drives: [],
  announcements: [],
  interviews: [],
  results: [],
  activities: [],
};

let state = structuredClone(DEFAULT_STATE);
const listeners = new Set();
let emitScheduled = false;

// Coalesce multiple mutations in the same tick into a single notification
function emit() {
  if (emitScheduled) return;
  emitScheduled = true;
  queueMicrotask(() => {
    emitScheduled = false;
    listeners.forEach((fn) => fn(state));
  });
}

export function subscribe(fn) {
  listeners.add(fn);
  fn(state);
  return () => listeners.delete(fn);
}

export function getState() { return state; }

// Generates a simple ID for new entries if Supabase doesn't generate it (e.g. text PKs)
export function uid(prefix = "x") {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

// Fetch initial data from Supabase
export async function reload() {
  try {
    const [drivesRes, announcementsRes, interviewsRes, resultsRes, activitiesRes] = await Promise.all([
      supabase.from("drives").select("*"),
      supabase.from("announcements").select("*"),
      supabase.from("interviews").select("*"),
      supabase.from("results").select("*"),
      supabase.from("notifications").select("*").order("created_at", { ascending: false }).limit(50),
    ]);

    // Map drives
    state.drives = (drivesRes.data || []).map((d) => ({
      id: d.id,
      company: d.company,
      role: d.role,
      eligibility: d.eligibility,
      branches: d.branches,
      departments: d.branches ? d.branches.split(",").map((s) => s.trim()).filter(Boolean) : [],
      deadline: d.deadline,
      description: d.description,
      status: d.status,
    }));

    // Map announcements
    state.announcements = (announcementsRes.data || []).map((a) => {
      let desc = a.content || "";
      let status = "Published";
      let category = "General";
      let posterUrl = "";
      let pdfUrl = "";
      let pdfName = "";
      let publishedAt = a.created_at ? new Date(a.created_at).getTime() : null;

      try {
        if (a.content && (a.content.trim().startsWith("{") || a.content.trim().startsWith("["))) {
          const parsed = JSON.parse(a.content);
          desc = parsed.description || "";
          status = parsed.status || "Published";
          category = parsed.category || "General";
          posterUrl = parsed.posterUrl || "";
          pdfUrl = parsed.pdfUrl || "";
          pdfName = parsed.pdfName || "";
          publishedAt = parsed.publishedAt || publishedAt;
        }
      } catch (e) {}

      return {
        id: a.id,
        title: a.title,
        description: desc,
        content: desc,
        status,
        publishedAt,
        date: a.date || "",
        category,
        posterUrl,
        pdfUrl,
        pdfName,
      };
    });

    // Map interviews
    state.interviews = (interviewsRes.data || []).map((i) => ({
      id: i.id,
      studentName: i.student_name,
      company: i.company,
      date: i.date,
      time: i.time,
      venue: i.venue,
      status: i.status || "Scheduled",
    }));

    // Map results
    state.results = (resultsRes.data || []).map((r) => {
      let selected = "";
      let rejected = "";
      let selectedStudents = [];
      let rejectedStudents = [];
      let publishedAt = r.created_at ? new Date(r.created_at).getTime() : null;

      try {
        if (r.selected_students && r.selected_students.trim().startsWith("{")) {
          const parsed = JSON.parse(r.selected_students);
          selected = parsed.selected || "";
          rejected = parsed.rejected || "";
          selectedStudents = parsed.selectedStudents || [];
          rejectedStudents = parsed.rejectedStudents || [];
          publishedAt = parsed.publishedAt || publishedAt;
        } else {
          selected = r.selected_students || "";
        }
      } catch (e) {
        selected = r.selected_students || "";
      }

      return {
        id: r.id,
        company: r.company,
        role: r.role,
        selected,
        rejected,
        selectedStudents,
        rejectedStudents,
        publishedAt,
        date: r.date || "",
      };
    });

    state.activities = (activitiesRes.data || []).map(act => ({
      id: act.id,
      at: new Date(act.created_at).getTime(),
      title: act.title,
      message: act.message,
      type: act.type,
      company: act.company,
    }));

    emit();
  } catch (error) {
    console.error("Failed to load data from Supabase:", error);
  }
  return state;
}

// Initialize Supabase realtime subscriptions
if (typeof window !== "undefined") {
  reload();

  // Listen for changes across tables
  supabase
    .channel("public-db-changes")
    .on("postgres_changes", { event: "*", schema: "public" }, () => {
      reload(); // Reload all to ensure clean mapping from columns
    })
    .subscribe();
}

export const drives = {
  list: () => state.drives,
  get: (id) => state.drives.find((d) => d.id === id),
  save: async (d) => {
    const id = d.id || uid("d");
    const branches = Array.isArray(d.departments) ? d.departments.join(",") : (d.branches || "");
    
    const driveData = {
      id,
      company: d.company,
      role: d.role,
      eligibility: d.eligibility || "",
      branches,
      deadline: d.deadline || "",
      description: d.description || "",
      status: d.status || "Upcoming",
    };
    
    // Optimistic Update
    const localData = { ...d, id, branches, departments: d.departments || [] };
    const idx = state.drives.findIndex((x) => x.id === id);
    if (idx >= 0) state.drives[idx] = localData;
    else state.drives.unshift(localData);
    emit();

    const { error } = await supabase.from("drives").upsert(driveData);
    if (error) console.error("Error saving drive to Supabase:", error);
  },
  remove: async (id) => {
    // Optimistic Update
    state.drives = state.drives.filter((x) => x.id !== id);
    emit();

    const { error } = await supabase.from("drives").delete().eq("id", id);
    if (error) console.error("Error deleting drive from Supabase:", error);
  },
};

export const announcements = {
  list: () => state.announcements,
  get: (id) => state.announcements.find((a) => a.id === id),
  save: async (a) => {
    const id = a.id || uid("a");
    
    const contentPayload = JSON.stringify({
      description: a.description || a.content || "",
      status: a.status || "Published",
      category: a.category || "General",
      posterUrl: a.posterUrl || "",
      pdfUrl: a.pdfUrl || "",
      pdfName: a.pdfName || "",
      publishedAt: a.publishedAt || Date.now(),
    });

    const annData = {
      id,
      title: a.title,
      content: contentPayload,
      date: a.date || new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "short" }),
    };

    // Optimistic Update
    const localData = { ...a, id };
    const idx = state.announcements.findIndex((x) => x.id === id);
    if (idx >= 0) state.announcements[idx] = localData;
    else state.announcements.unshift(localData);
    emit();

    const { error } = await supabase.from("announcements").upsert(annData);
    if (error) console.error("Error saving announcement to Supabase:", error);
  },
  remove: async (id) => {
    // Optimistic Update
    state.announcements = state.announcements.filter((x) => x.id !== id);
    emit();

    const { error } = await supabase.from("announcements").delete().eq("id", id);
    if (error) console.error("Error deleting announcement from Supabase:", error);
  },
};

export const interviews = {
  list: () => state.interviews,
  get: (id) => state.interviews.find((i) => i.id === id),
  save: async (i) => {
    const id = i.id || uid("i");
    
    const intData = {
      id,
      student_name: i.studentName || "",
      company: i.company,
      date: i.date || "",
      time: i.time || "",
      venue: i.venue || "",
      status: i.status || "Scheduled",
    };

    // Optimistic Update
    const localData = { ...i, id };
    const idx = state.interviews.findIndex((x) => x.id === id);
    if (idx >= 0) state.interviews[idx] = localData;
    else state.interviews.unshift(localData);
    emit();

    const { error } = await supabase.from("interviews").upsert(intData);
    if (error) {
      console.error("Error saving interview to Supabase:", error);
      throw error;
    }
  },
  remove: async (id) => {
    // Optimistic Update
    state.interviews = state.interviews.filter((x) => x.id !== id);
    emit();

    const { error } = await supabase.from("interviews").delete().eq("id", id);
    if (error) console.error("Error deleting interview from Supabase:", error);
  },
};

export const results = {
  list: () => state.results,
  get: (id) => state.results.find((r) => r.id === id),
  save: async (r) => {
    const id = r.id || uid("r");
    
    const combinedData = JSON.stringify({
      selected: r.selected || "",
      rejected: r.rejected || "",
      selectedStudents: r.selectedStudents || [],
      rejectedStudents: r.rejectedStudents || [],
      publishedAt: r.publishedAt || Date.now(),
    });

    const resData = {
      id,
      company: r.company,
      role: r.role || "",
      selected_students: combinedData,
      date: r.date || new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "short" }),
    };

    // Optimistic Update
    const localData = { ...r, id };
    const idx = state.results.findIndex((x) => x.id === id);
    if (idx >= 0) state.results[idx] = localData;
    else state.results.unshift(localData);
    emit();

    const { error } = await supabase.from("results").upsert(resData);
    if (error) console.error("Error saving result to Supabase:", error);
  },
  remove: async (id) => {
    // Optimistic Update
    state.results = state.results.filter((x) => x.id !== id);
    emit();

    const { error } = await supabase.from("results").delete().eq("id", id);
    if (error) console.error("Error deleting result from Supabase:", error);
  },
};

export const activity = {
  list: () => state.activities || [],
  log: async (entry) => {
    const id = uid("act");
    const actData = {
      id,
      title: entry.title || entry.type || "Activity",
      message: entry.message || `${entry.type} occurred`,
      type: entry.type,
      company: entry.company,
    };

    // Optimistic Update
    state.activities.unshift({ ...actData, at: Date.now() });
    if (state.activities.length > 50) state.activities.length = 50;
    emit();

    const { error } = await supabase.from("notifications").insert(actData);
    if (error) console.error("Error logging activity:", error);
  },
};