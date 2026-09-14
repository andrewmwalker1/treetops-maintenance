// Single shared read/write path for staff timesheets -- consumed by the
// self-service page, the Kiosk tile, and the admin grid alike, so
// "office enters on someone's behalf" genuinely runs through the same
// code as self-entry rather than a hand-copied second version. Frozen-
// week blocking and audit logging live server-side in the triggers in
// supabase/69-staff-timesheets.sql; this file just calls straight
// through and lets those errors surface.

import { supabase } from "./supabaseClient.js";

export async function getWeekEntries(profileId, weekStart) {
  const { data, error } = await supabase
    .from("timesheet_entries")
    .select("*")
    .eq("profile_id", profileId)
    .eq("entered_week_start", weekStart)
    .order("work_date");
  if (error) {
    console.error("getWeekEntries failed", error);
    throw error;
  }
  return data || [];
}

// Every entry (daily and adjustment) for a whole week, across every
// person -- the admin grid's one query per week, rather than one per row.
export async function getWeekEntriesForProfiles(profileIds, weekStart) {
  if (!profileIds.length) return [];
  const { data, error } = await supabase
    .from("timesheet_entries")
    .select("*")
    .in("profile_id", profileIds)
    .eq("entered_week_start", weekStart);
  if (error) {
    console.error("getWeekEntriesForProfiles failed", error);
    throw error;
  }
  return data || [];
}

// The last few weeks of a person's own daily rows -- the picklist for
// "which day are you correcting" when adding an adjustment.
export async function getRecentDailyEntries(profileId, limit = 21) {
  const { data, error } = await supabase
    .from("timesheet_entries")
    .select("id, work_date, morning_hours, afternoon_hours, daily_total")
    .eq("profile_id", profileId)
    .eq("entry_kind", "daily")
    .order("work_date", { ascending: false })
    .limit(limit);
  if (error) {
    console.error("getRecentDailyEntries failed", error);
    throw error;
  }
  return data || [];
}

export async function getWeekFreezeStatus(weekStart) {
  const { data, error } = await supabase
    .from("timesheet_weeks")
    .select("frozen_at, frozen_by, frozen_by_profile:profiles!timesheet_weeks_frozen_by_fkey(display_name)")
    .eq("week_start", weekStart)
    .maybeSingle();
  if (error) {
    console.error("getWeekFreezeStatus failed", error);
    throw error;
  }
  return data; // null (not just frozen_at null) if the week has no row at all yet
}

// One function for every normal-day write, self-entry or office-on-
// behalf alike -- finds the existing daily row for (profile, date) if
// there is one and updates it, otherwise inserts. Not a single
// .upsert() call: the "one daily row per person per date" constraint is
// a partial unique index (entry_kind = 'daily' only), which the
// supabase-js upsert() helper can't target directly.
export async function upsertDailyEntry({ profileId, workDate, morningHours, afternoonHours, notes }) {
  const { data: existing, error: findErr } = await supabase
    .from("timesheet_entries")
    .select("id")
    .eq("profile_id", profileId)
    .eq("work_date", workDate)
    .eq("entry_kind", "daily")
    .maybeSingle();
  if (findErr) {
    console.error("upsertDailyEntry lookup failed", findErr);
    throw findErr;
  }

  const payload = {
    morning_hours: morningHours === "" || morningHours == null ? null : Number(morningHours),
    afternoon_hours: afternoonHours === "" || afternoonHours == null ? null : Number(afternoonHours),
  };
  // Only touches notes when the caller actually passed something for it --
  // omitting the argument entirely must never silently wipe an existing
  // note out from under a caller that only cares about the hours.
  if (notes !== undefined) payload.notes = notes === "" ? null : notes;

  if (existing) {
    const { error } = await supabase.from("timesheet_entries").update(payload).eq("id", existing.id);
    if (error) {
      console.error("upsertDailyEntry update failed", error);
      throw error;
    }
    return existing.id;
  }

  const { data, error } = await supabase
    .from("timesheet_entries")
    .insert({ profile_id: profileId, work_date: workDate, entry_kind: "daily", ...payload })
    .select("id")
    .single();
  if (error) {
    console.error("upsertDailyEntry insert failed", error);
    throw error;
  }
  return data.id;
}

export async function insertAdjustment({ profileId, correctsEntryId, workDate, enteredWeekStart, adjustmentHours, reason }) {
  const { data, error } = await supabase
    .from("timesheet_entries")
    .insert({
      profile_id: profileId,
      entry_kind: "adjustment",
      work_date: workDate,
      entered_week_start: enteredWeekStart,
      adjustment_hours: Number(adjustmentHours),
      corrects_entry_id: correctsEntryId,
      adjustment_reason: reason,
    })
    .select()
    .single();
  if (error) {
    console.error("insertAdjustment failed", error);
    throw error;
  }
  return data;
}

// Everyone whose role currently has can_submit_timesheet enabled --
// role_permissions has no direct relationship PostgREST can embed
// straight into profiles, so this is two queries rather than one join.
// Excludes anyone on a fixed_weekly pay basis (Jayne) -- she never fills
// in a daily grid, so she'd otherwise double up between this table and
// FixedHoursSection.jsx's own list below it.
export async function getSubmittableProfiles() {
  const { data: rolePerms, error: rpErr } = await supabase
    .from("role_permissions")
    .select("role_id")
    .eq("permission_key", "can_submit_timesheet")
    .eq("enabled", true);
  if (rpErr) {
    console.error("getSubmittableProfiles (roles) failed", rpErr);
    throw rpErr;
  }
  const roleIds = (rolePerms || []).map((r) => r.role_id);
  if (roleIds.length === 0) return [];

  const { data, error } = await supabase
    .from("profiles")
    .select("id, display_name, role_id, roles(name), timesheet_person_order(sort_order), staff_time_profiles!profile_id(pay_basis)")
    .in("role_id", roleIds)
    .eq("is_active", true)
    .order("display_name");
  if (error) {
    console.error("getSubmittableProfiles (profiles) failed", error);
    throw error;
  }

  return (data || [])
    .filter((p) => p.staff_time_profiles?.pay_basis !== "fixed_weekly")
    .map((p) => ({
      id: p.id,
      displayName: p.display_name,
      roleName: p.roles?.name || "",
      sortOrder: p.timesheet_person_order?.[0]?.sort_order,
    }))
    .sort((a, b) => {
      if (a.sortOrder == null && b.sortOrder == null) return a.displayName.localeCompare(b.displayName);
      if (a.sortOrder == null) return 1;
      if (b.sortOrder == null) return -1;
      return a.sortOrder - b.sortOrder;
    });
}

// Persists a full reorder as one dense 0..n-1 sequence covering every
// row, rather than swapping just the two moved rows' sort_order values --
// most profiles won't have a timesheet_person_order row yet the first
// time anyone reorders (rows are created lazily), so writing the whole
// list guarantees every person ends up with one, in one call.
export async function movePersonOrder(orgId, orderedProfileIds, index, direction) {
  const next = [...orderedProfileIds];
  const target = index + direction;
  if (target < 0 || target >= next.length) return next;
  [next[index], next[target]] = [next[target], next[index]];

  const rows = next.map((profileId, i) => ({ org_id: orgId, profile_id: profileId, sort_order: i }));
  const { error } = await supabase.from("timesheet_person_order").upsert(rows, { onConflict: "org_id,profile_id" });
  if (error) {
    console.error("movePersonOrder failed", error);
    throw error;
  }
  return next;
}

export async function freezeWeek(weekStart) {
  const { error } = await supabase.rpc("freeze_timesheet_week", { p_week_start: weekStart });
  if (error) {
    console.error("freezeWeek failed", error);
    throw error;
  }
}

export async function unfreezeWeek(weekStart) {
  const { error } = await supabase.rpc("unfreeze_timesheet_week", { p_week_start: weekStart });
  if (error) {
    console.error("unfreezeWeek failed", error);
    throw error;
  }
}
