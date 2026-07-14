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
      notificationsList = data.map((n) => ({
        id: n.id,
        userType: n.user_type,
        userId: n.user_id,
        title: n.title,
        message: n.message,
        type: n.type,
        company: n.company,
        isRead: n.is_read,
        createdAt: new Date(n.created_at).getTime(),
      }));
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
  const newNotif = {
    user_type: n.userType || "student",
    user_id: n.userId || "officer",
    title: n.title,
    message: n.message,
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
  const { error } = await supabase
    .from("notifications")
    .update({ is_read: true })
    .eq("user_type", opts.userType)
    .eq("user_id", opts.userId)
    .eq("is_read", false);
  if (error) console.error("Error marking all read in Supabase:", error);
}

export async function clearAll(opts) {
  const { error } = await supabase
    .from("notifications")
    .delete()
    .eq("user_type", opts.userType)
    .eq("user_id", opts.userId);
  if (error) console.error("Error clearing notifications in Supabase:", error);
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