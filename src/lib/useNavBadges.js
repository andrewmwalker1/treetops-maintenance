import { useEffect, useState } from "react";
import { supabase } from "./supabaseClient.js";

// The two counts the desktop sidebar shows beside its links: open jobs past
// their due date, and keys currently checked out. Both are head-only count
// queries -- the sidebar needs the number, not the rows -- and both go
// through RLS, so a person only ever counts the jobs they can see.
//
// "Overdue" matches JobCard's own flag exactly (due strictly before today,
// status not a completed one), so the badge and the red-edged cards in the
// list always agree.
//
// Refreshed whenever `refreshKey` changes (Layout passes the route, so
// finishing a job and navigating away updates it) and once a minute, which
// is enough for a number nobody is watching tick.
export function useNavBadges(siteId, { keys = false, refreshKey } = {}) {
  const [overdueJobs, setOverdueJobs] = useState(0);
  const [keysOut, setKeysOut] = useState(0);

  useEffect(() => {
    if (!siteId) return;
    let cancelled = false;

    function load() {
      const today = new Date().toISOString().slice(0, 10);
      supabase
        .from("jobs")
        .select("id, job_statuses!inner(is_completed)", { count: "exact", head: true })
        .eq("site_id", siteId)
        .lt("due_date", today)
        .eq("job_statuses.is_completed", false)
        .then(({ count, error }) => {
          if (!cancelled && !error) setOverdueJobs(count || 0);
        });

      if (keys) {
        supabase
          .from("key_checkouts")
          .select("id, key_tags!inner(site_id)", { count: "exact", head: true })
          .is("checked_in_at", null)
          .eq("key_tags.site_id", siteId)
          .then(({ count, error }) => {
            if (!cancelled && !error) setKeysOut(count || 0);
          });
      } else {
        setKeysOut(0);
      }
    }

    load();
    const interval = setInterval(load, 60000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [siteId, keys, refreshKey]);

  return { overdueJobs, keysOut };
}
