import { supabase } from "./supabase.js";

export async function fetchHighlights() {
  try {
    // 1. Active Drives Count
    const { count: activeDrivesCount } = await supabase
      .from("drives")
      .select("*", { count: "exact", head: true })
      .neq("status", "Closed");

    // 2. Applications today
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const { count: appsTodayCount } = await supabase
      .from("applications")
      .select("*", { count: "exact", head: true })
      .gte("applied_at", startOfToday.toISOString());

    // 3. Results (Offers)
    const { data: resultsData } = await supabase
      .from("results")
      .select("selected_students");

    let offersCount = 0;
    if (resultsData) {
      resultsData.forEach((row) => {
        if (row.selected_students) {
          // split by commas or newlines and count non-empty entries
          const students = row.selected_students
            .split(/,|\n/)
            .map((s) => s.trim())
            .filter(Boolean);
          offersCount += students.length;
        }
      });
    }

    return {
      activeDrives: activeDrivesCount || 0,
      applicationsToday: appsTodayCount || 0,
      offersReleased: offersCount || 0,
    };
  } catch (err) {
    console.error("Error fetching highlights from Supabase:", err);
    return { activeDrives: 0, applicationsToday: 0, offersReleased: 0 };
  }
}

export async function fetchUpcomingDrive() {
  try {
    const { data } = await supabase
      .from("drives")
      .select("company, role, deadline")
      .eq("status", "Upcoming")
      .order("deadline", { ascending: true })
      .limit(1);

    if (data && data.length > 0) {
      return {
        company: data[0].company,
        role: data[0].role,
        deadline: data[0].deadline,
      };
    }
  } catch (err) {
    console.error("Error fetching upcoming drive from Supabase:", err);
  }
  return null;
}

export async function fetchLatestAnnouncement() {
  try {
    const { data } = await supabase
      .from("announcements")
      .select("title, date")
      .order("created_at", { ascending: false })
      .limit(1);

    if (data && data.length > 0) {
      return {
        title: data[0].title,
        date: data[0].date,
      };
    }
  } catch (err) {
    console.error("Error fetching latest announcement from Supabase:", err);
  }
  return null;
}