import { supabase } from "./supabase.js";

export const ALLOWED_EMAIL_DOMAIN = "rajalakshmi.edu.in";

export function isAllowedEmail(email) {
  const trimmed = String(email).trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) return false;
  const domain = trimmed.split("@")[1];
  return domain === ALLOWED_EMAIL_DOMAIN;
}

const SESSION_KEY = "campace.student.session.v1";

export async function registerStudent(payload) {
  const email = payload.email.trim().toLowerCase();
  if (!isAllowedEmail(email)) {
    return { ok: false, error: "Please use your official college email address." };
  }

  const { data, error } = await supabase.auth.signUp({
    email,
    password: payload.password,
    options: {
      data: {
        fullName: payload.fullName.trim(),
        registerNumber: payload.registerNumber.trim(),
        department: payload.department,
        year: payload.year,
        cgpa: parseFloat(payload.cgpa) || 0,
        role: "student",
      },
    },
  });

  if (error) {
    return { ok: false, error: error.message };
  }

  return { ok: true, student: data.user };
}

export async function loginStudent(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email: email.trim().toLowerCase(),
    password,
  });

  if (error) {
    return { ok: false, error: error.message };
  }

  // Fetch the full profile details from profiles table
  const { data: profile, error: profileErr } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", data.user.id)
    .single();

  const fullName = profile?.full_name || data.user.user_metadata?.fullName || "Student";
  
  const session = {
    id: data.user.id,
    email: data.user.email,
    fullName,
    at: Date.now(),
  };

  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  return { ok: true, session };
}

export function currentStudent() {
  try { return JSON.parse(localStorage.getItem(SESSION_KEY) || "null"); }
  catch { return null; }
}

export async function logoutStudent() {
  localStorage.removeItem(SESSION_KEY);
  await supabase.auth.signOut();
}