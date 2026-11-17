// The lists the New job form needs before it can save anything (statuses,
// job templates, who-can-be-assigned, pitches, areas, activity types) --
// fetched together and kept in a per-org/site/role localStorage copy so
// the form still works with no signal. Without the copy, opening New job
// offline left "Create job" stuck on "Still loading" forever, since
// openStatus comes from job_statuses (NewJob.jsx), so the offline job
// queue (syncQueue.js) was unreachable in practice.
//
// Layout.jsx calls this on every online app load to keep the copy fresh,
// so a new job can be raised offline even if the form itself was never
// opened while there was signal.
import { supabase } from "./supabaseClient.js";
import { getAssignableTargets } from "./assignableTargets.js";

function cacheKey(orgId, siteId, roleId) {
  return `newJob:referenceData:${orgId}:${siteId}:${roleId}`;
}

function readCache(key) {
  try {
    return JSON.parse(localStorage.getItem(key) || "null");
  } catch {
    return null;
  }
}

async function fetchFresh(orgId, siteId, roleId) {
  const [jobTypes, statuses, targets, contractors, pitches, areas, activityTypes, typeLinks] = await Promise.all([
    supabase.from("job_types").select("id, name, template_schema").eq("org_id", orgId),
    supabase.from("job_statuses").select("id, name, sort_order").eq("org_id", orgId).order("sort_order"),
    getAssignableTargets(orgId, roleId),
    supabase.from("contractors").select("id, name").eq("org_id", orgId).order("name"),
    supabase.from("pitches").select("id, pitch_number_or_name").eq("site_id", siteId),
    supabase.from("areas").select("id, name").eq("site_id", siteId),
    supabase.from("task_types").select("id, name").eq("org_id", orgId),
    supabase.from("job_type_task_types").select("job_type_id, task_type_id"),
  ]);

  const defaultActivitiesByType = {};
  for (const link of typeLinks.data || []) {
    defaultActivitiesByType[link.job_type_id] = [...(defaultActivitiesByType[link.job_type_id] || []), link.task_type_id];
  }

  const failed = [jobTypes, statuses, contractors, pitches, areas, activityTypes, typeLinks].some((r) => r.error);
  return {
    failed,
    assignError: targets.error || null,
    data: {
      jobTypes: jobTypes.data || [],
      statuses: statuses.data || [],
      people: targets.people || [],
      groups: targets.groups || [],
      contractors: contractors.data || [],
      pitches: pitches.data || [],
      areas: areas.data || [],
      activityTypes: activityTypes.data || [],
      defaultActivitiesByType,
    },
  };
}

// Resolves to { data, assignError, fromCache }. `data` is null only when
// there's no signal AND nothing has ever been cached for this org/site/role.
export async function loadNewJobReferenceData({ orgId, siteId, roleId }) {
  const key = cacheKey(orgId, siteId, roleId);
  const cached = readCache(key);

  if (!navigator.onLine) return { data: cached, assignError: null, fromCache: true };

  const fresh = await fetchFresh(orgId, siteId, roleId);
  // Patchy signal (navigator.onLine is true but requests fail): fall back
  // to the last good copy rather than an empty, unsaveable form.
  if ((fresh.failed || fresh.assignError) && cached) {
    return { data: cached, assignError: null, fromCache: true };
  }
  if (!fresh.failed && !fresh.assignError) {
    try {
      localStorage.setItem(key, JSON.stringify(fresh.data));
    } catch {
      // Storage full/blocked -- the form still works online.
    }
  }
  return { data: fresh.data, assignError: fresh.assignError, fromCache: false };
}
