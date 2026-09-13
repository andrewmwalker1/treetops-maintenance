// Single shared read/write path for holiday accrual and booking --
// mirrors src/lib/timesheetQueries.js's shape and error-handling style.
// RLS does most of the scoping work for reads (e.g. a pending request
// list only ever contains rows the caller is allowed to see -- their
// own, everyone's with can_manage_timesheets, or ones that resolve to
// them as approver), so several of these are thin passthroughs.

import { supabase } from "./supabaseClient.js";

export async function getStaffTimeProfile(profileId) {
  const { data, error } = await supabase
    .from("staff_time_profiles")
    .select("*")
    .eq("profile_id", profileId)
    .maybeSingle();
  if (error) {
    console.error("getStaffTimeProfile failed", error);
    throw error;
  }
  return data; // null if never configured yet
}

// Starts from every active, non-contractor profile -- not from
// staff_time_profiles -- so someone never yet configured still shows up
// with sensible defaults to fill in, rather than being invisible until
// a row happens to exist for them.
export async function getProfilesForTimeProfileAdmin(orgId) {
  const { data, error } = await supabase
    .from("profiles")
    .select("id, display_name, is_active, is_contractor, staff_time_profiles(*)")
    .eq("org_id", orgId)
    .eq("is_active", true)
    .eq("is_contractor", false)
    .order("display_name");
  if (error) {
    console.error("getProfilesForTimeProfileAdmin failed", error);
    throw error;
  }
  return (data || []).map((p) => ({
    profileId: p.id,
    displayName: p.display_name,
    timeProfile: p.staff_time_profiles?.[0] || null,
  }));
}

// Everyone on a fixed_weekly pay basis (Jayne) -- independent of
// can_submit_timesheet entirely, since she never gets that permission.
// Populates FixedHoursSection.jsx's own list on TimesheetsGrid.jsx.
export async function getFixedHoursProfiles() {
  const { data, error } = await supabase
    .from("staff_time_profiles")
    .select("profile_id, weekly_hours, profile:profiles!inner(id, display_name, is_active, is_contractor)")
    .eq("pay_basis", "fixed_weekly")
    .eq("profile.is_active", true)
    .eq("profile.is_contractor", false);
  if (error) {
    console.error("getFixedHoursProfiles failed", error);
    throw error;
  }
  return (data || [])
    .map((row) => ({ id: row.profile_id, displayName: row.profile.display_name, weeklyHours: row.weekly_hours }))
    .sort((a, b) => a.displayName.localeCompare(b.displayName));
}

export async function upsertStaffTimeProfile(profileId, orgId, fields) {
  const { error } = await supabase
    .from("staff_time_profiles")
    .upsert({ profile_id: profileId, org_id: orgId, updated_by: profileId, ...fields }, { onConflict: "profile_id" });
  if (error) {
    console.error("upsertStaffTimeProfile failed", error);
    throw error;
  }
}

export async function getHolidaySettings() {
  const { data, error } = await supabase.from("holiday_settings").select("*").maybeSingle();
  if (error) {
    console.error("getHolidaySettings failed", error);
    throw error;
  }
  return data;
}

export async function upsertHolidaySettings(orgId, fields) {
  const { error } = await supabase.from("holiday_settings").upsert({ org_id: orgId, ...fields }, { onConflict: "org_id" });
  if (error) {
    console.error("upsertHolidaySettings failed", error);
    throw error;
  }
}

export async function getBankHolidays() {
  const { data, error } = await supabase.from("holiday_bank_holidays").select("*").order("holiday_date");
  if (error) {
    console.error("getBankHolidays failed", error);
    throw error;
  }
  return data || [];
}

export async function addBankHoliday(orgId, holidayDate, label) {
  const { error } = await supabase.from("holiday_bank_holidays").insert({ org_id: orgId, holiday_date: holidayDate, label });
  if (error) {
    console.error("addBankHoliday failed", error);
    throw error;
  }
}

export async function deleteBankHoliday(id) {
  const { error } = await supabase.from("holiday_bank_holidays").delete().eq("id", id);
  if (error) {
    console.error("deleteBankHoliday failed", error);
    throw error;
  }
}

export async function getBankHolidayOverrides(bankHolidayId) {
  const { data, error } = await supabase
    .from("holiday_bank_holiday_overrides")
    .select("*, profile:profiles(id, display_name)")
    .eq("bank_holiday_id", bankHolidayId);
  if (error) {
    console.error("getBankHolidayOverrides failed", error);
    throw error;
  }
  return data || [];
}

export async function addBankHolidayOverride(orgId, bankHolidayId, profileId) {
  const { error } = await supabase
    .from("holiday_bank_holiday_overrides")
    .insert({ org_id: orgId, bank_holiday_id: bankHolidayId, profile_id: profileId });
  if (error) {
    console.error("addBankHolidayOverride failed", error);
    throw error;
  }
}

export async function removeBankHolidayOverride(id) {
  const { error } = await supabase.from("holiday_bank_holiday_overrides").delete().eq("id", id);
  if (error) {
    console.error("removeBankHolidayOverride failed", error);
    throw error;
  }
}

export async function getHolidayStatus(profileId) {
  const { data, error } = await supabase.rpc("holiday_status", { p_profile_id: profileId });
  if (error) {
    console.error("getHolidayStatus failed", error);
    throw error;
  }
  return (Array.isArray(data) ? data[0] : data) || null;
}

// days: [{ work_date, hours, note }]
export async function submitHolidayRequest(profileId, days) {
  const { data, error } = await supabase.rpc("submit_holiday_request", {
    p_profile_id: profileId,
    p_days: days.map((d) => ({ work_date: d.workDate, hours: Number(d.hours), note: d.note || null })),
  });
  if (error) {
    console.error("submitHolidayRequest failed", error);
    throw error;
  }
  return data;
}

export async function getMyHolidayRequests(profileId) {
  const { data, error } = await supabase
    .from("holiday_requests")
    .select("*, days:holiday_request_days(*)")
    .eq("profile_id", profileId)
    .order("submitted_at", { ascending: false });
  if (error) {
    console.error("getMyHolidayRequests failed", error);
    throw error;
  }
  return data || [];
}

export async function withdrawHolidayRequest(requestId) {
  const { error } = await supabase.from("holiday_requests").delete().eq("id", requestId);
  if (error) {
    console.error("withdrawHolidayRequest failed", error);
    throw error;
  }
}

// RLS already scopes this to requests the caller may act on or see --
// their own, everyone's with can_manage_timesheets, or ones that resolve
// to them as approver -- so no extra filtering is needed client-side
// beyond status.
export async function getPendingApprovals() {
  const { data, error } = await supabase
    .from("holiday_requests")
    .select("*, days:holiday_request_days(*), requester:profiles!holiday_requests_profile_id_fkey(id, display_name)")
    .eq("status", "pending")
    .order("submitted_at");
  if (error) {
    console.error("getPendingApprovals failed", error);
    throw error;
  }
  return data || [];
}

export async function approveHolidayRequest(requestId) {
  const { error } = await supabase.rpc("approve_holiday_request", { p_request_id: requestId });
  if (error) {
    console.error("approveHolidayRequest failed", error);
    throw error;
  }
}

export async function declineHolidayRequest(requestId, reason) {
  const { error } = await supabase.rpc("decline_holiday_request", { p_request_id: requestId, p_reason: reason || null });
  if (error) {
    console.error("declineHolidayRequest failed", error);
    throw error;
  }
}

export async function getTeamHolidayCalendar(monthStart, monthEnd) {
  const { data, error } = await supabase.rpc("team_holiday_calendar", { p_month_start: monthStart, p_month_end: monthEnd });
  if (error) {
    console.error("getTeamHolidayCalendar failed", error);
    throw error;
  }
  return data || [];
}
