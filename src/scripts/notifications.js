import { supabase } from "./supabase.js";

let notificationsList = [];
const listeners = new Set();

// Synchronize notification cache with Supabase
async function loadNotifications() {
  try {
    const { data } = await supabase
      .from("notifications")
      .select("*")
      .order("created_at", { ascending: false });

    if (data) {
      notificationsList = data.map((n) => {
        let msg = n.message || "";
        let userType = "student";
        let userId = null;

        try {
          if (n.message && n.message.trim().startsWith("{")) {
            const parsed = JSON.parse(n.message);
            msg = parsed.message || "";
            userType = parsed.userType || "student";
            userId = parsed.userId || null;
          }
        } catch (e) {}

        return {
          id: n.id,
          userType,
          userId,
          title: n.title,
          message: msg,
          type: n.type,
          company: n.company,
          isRead: n.is_read,
          createdAt: new Date(n.created_at).getTime(),
        };
      });
      triggerListeners();
    }
  } catch (err) {
    console.error("Error loading notifications from Supabase:", err);
  }
}

// Automatically load on initialization
loadNotifications();

// Realtime subscriptions for notifications
if (typeof window !== "undefined") {
  supabase
    .channel("public-notifications")
    .on("postgres_changes", { event: "*", schema: "public", table: "notifications" }, () => {
      loadNotifications();
    })
    .subscribe();
}

function triggerListeners() {
  listeners.forEach((fn) => fn());
}

function matches(n, userType, userId) {
  if (n.userType !== userType) return false;
  if (userType === "officer") return true;
  return n.userId === userId;
}

export function listNotifications({ userType, userId }) {
  return notificationsList
    .filter((n) => matches(n, userType, userId))
    .sort((a, b) => b.createdAt - a.createdAt);
}

export function unreadCount(opts) {
  return listNotifications(opts).filter((n) => !n.isRead).length;
}

export async function addNotification(n) {
  const messagePayload = JSON.stringify({
    message: n.message,
    userType: n.userType || "student",
    userId: n.userId || "officer",
  });

  const newNotif = {
    title: n.title,
    message: messagePayload,
    type: n.type || "info",
    company: n.company || "",
    is_read: false,
  };

  const { error } = await supabase.from("notifications").insert(newNotif);
  if (error) console.error("Error creating notification in Supabase:", error);
}

export async function markRead(id) {
  const { error } = await supabase
    .from("notifications")
    .update({ is_read: true })
    .eq("id", id);
  if (error) console.error("Error marking notification read in Supabase:", error);
}

export async function markAllRead(opts) {
  const targets = notificationsList.filter((n) => matches(n, opts.userType, opts.userId) && !n.isRead);
  if (!targets.length) return;

  const promises = targets.map((n) =>
    supabase.from("notifications").update({ is_read: true }).eq("id", n.id)
  );
  await Promise.all(promises);
  loadNotifications();
}

export async function clearAll(opts) {
  const targets = notificationsList.filter((n) => matches(n, opts.userType, opts.userId));
  if (!targets.length) return;

  const promises = targets.map((n) =>
    supabase.from("notifications").delete().eq("id", n.id)
  );
  await Promise.all(promises);
  loadNotifications();
}

export function onNotificationsChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

// ---------- fan-out helpers ----------
export async function notifyAllStudents(payload) {
  try {
    const { data: students } = await supabase
      .from("profiles")
      .select("id")
      .eq("role", "student");

    if (students) {
      const inserts = students.map((s) => ({
        user_type: "student",
        user_id: s.id,
        title: payload.title,
        message: payload.message,
        type: payload.type || "info",
        company: payload.company || "",
        is_read: false,
      }));

      const { error } = await supabase.from("notifications").insert(inserts);
      if (error) console.error("Error notifying all students in Supabase:", error);
    }
  } catch (err) {
    console.error("Error fanning out notification:", err);
  }
}

export async function notifyStudentsByCompany(company, payload) {
  try {
    const c = String(company || "").trim().toLowerCase();
    if (!c) return;

    // 1. Get drive ids for this company
    const { data: drives } = await supabase
      .from("drives")
      .select("id")
      .ilike("company", c);

    if (drives && drives.length > 0) {
      const driveIds = drives.map((d) => d.id);

      // 2. Get applications for these drives
      const { data: apps } = await supabase
        .from("applications")
        .select("student_id")
        .in("drive_id", driveIds);

      if (apps && apps.length > 0) {
        // Unique student ids
        const studentIds = [...new Set(apps.map((a) => a.student_id))];

        const inserts = studentIds.map((sid) => ({
          user_type: "student",
          user_id: sid,
          title: payload.title,
          message: payload.message,
          type: payload.type || "info",
          company: company,
          is_read: false,
        }));

        const { error } = await supabase.from("notifications").insert(inserts);
        if (error) console.error("Error notifying applied students in Supabase:", error);
      }
    }
  } catch (err) {
    console.error("Error fanning out company notification:", err);
  }
}

export async function notifyOfficer(payload) {
  await addNotification({ userType: "officer", userId: "officer", ...payload });
}