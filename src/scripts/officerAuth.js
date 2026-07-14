import { supabase } from "./supabase.js";

const SESSION_KEY = "campace.officer.session.v1";
export const OFFICER_LOGIN_URL = "/officer-login.html";

const DEFAULT_OFFICER = {
  email: "placement@rajalakshmi.edu.in",
  password: "admin123",
  role: "Placement Officer",
  name: "Placement Officer",
};

export async function loginOfficer(email, password) {
  const e = String(email || "").trim().toLowerCase();
  const p = String(password || "");

  // 1. Try to sign in
  let { data, error } = await supabase.auth.signInWithPassword({
    email: e,
    password: p,
  });

  // 2. If it fails, check if we should auto-seed the default officer
  if (error && e === DEFAULT_OFFICER.email && p === DEFAULT_OFFICER.password) {
    const signup = await supabase.auth.signUp({
      email: e,
      password: p,
      options: {
        data: {
          fullName: DEFAULT_OFFICER.name,
          role: "officer",
        },
      },
    });

    if (!signup.error) {
      data = signup.data;
      error = null;
    } else {
      error = signup.error;
    }
  }

  if (error) {
    return { ok: false, error: error.message };
  }

  // 3. Verify user is indeed an officer
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", data.user.id)
    .single();

  const role = profile?.role || data.user.user_metadata?.role;
  if (role !== "officer") {
    await supabase.auth.signOut();
    return { ok: false, error: "Access denied. User is not a Placement Officer." };
  }

  const session = {
    email: data.user.email,
    role: "Placement Officer",
    loginTime: Date.now(),
  };
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  return { ok: true, session };
}

export function currentOfficer() {
  try { return JSON.parse(localStorage.getItem(SESSION_KEY) || "null"); }
  catch { return null; }
}

export async function logoutOfficer() {
  localStorage.removeItem(SESSION_KEY);
  await supabase.auth.signOut();
}

export function requireOfficer() {
  if (!currentOfficer()) {
    window.location.replace(OFFICER_LOGIN_URL);
    return false;
  }
  return true;
}

