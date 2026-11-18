// Whether the signed-in person is ticked "Exclude from timesheets" on
// Admin -> Work patterns (staff_time_profiles.exclude_from_timesheets,
// 91-exclude-from-timesheets.sql). Hides their Timesheet nav link, kiosk
// tile and page; the office grid filters them out separately in
// getSubmittableProfiles. Fails open (not excluded) on any error, so a
// lookup problem never takes the timesheet away from someone who needs it.
import { useEffect, useState } from "react";
import { useAuth } from "./AuthContext.jsx";
import { supabase } from "./supabaseClient.js";

export function useTimesheetExcluded() {
  const { profile } = useAuth();
  const [excluded, setExcluded] = useState(false);

  useEffect(() => {
    if (!profile?.id) return;
    let cancelled = false;
    supabase
      .from("staff_time_profiles")
      .select("exclude_from_timesheets")
      .eq("profile_id", profile.id)
      .maybeSingle()
      .then(({ data, error }) => {
        if (error) console.error("useTimesheetExcluded failed", error);
        if (!cancelled) setExcluded(!error && !!data?.exclude_from_timesheets);
      });
    return () => {
      cancelled = true;
    };
  }, [profile?.id]);

  return excluded;
}
