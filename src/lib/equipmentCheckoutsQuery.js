// Single source of truth for "which equipment history events match the
// current admin log filters" -- reused by the admin log tab and its CSV
// export, same reasoning as queryJobs in jobsQuery.js. RLS (can_see_equipment,
// widened for can_manage_equipment_status holders in
// 16-rfid-kiosk-and-equipment-checkout.sql; the same for fault_reports and
// repair_records in 02-rls-policies.sql) is what actually restricts this to
// the caller's org; the filters here are UI-level narrowing on top.
//
// A machine's full history spans three tables with no FK chaining a repair
// to the fault it fixed or a fault to the checkout it was reported against
// (EquipmentDetail.jsx merges the same three for one machine already) --
// queryEquipmentHistory merges them into one chronological, taggable event
// list here too, but across every machine, for the admin log. Every
// fault_reports row is included as its own "fault" event regardless of
// whether it also closed a checkout, rather than folding it into the
// checkout row -- the two naturally end up adjacent once sorted by date,
// without the same fault being described twice in different words.

import { supabase } from "./supabaseClient.js";

const CHECKOUT_SELECT = `
  id, checked_out_at, checked_in_at,
  equipment:equipment!inner(id, name, equipment_type_id, equipment_type:equipment_types(id, name)),
  checked_out_by:profiles!equipment_checkouts_profile_id_fkey(id, display_name),
  checked_in_by_profile:profiles!equipment_checkouts_checked_in_by_fkey(id, display_name)
`;

const FAULT_SELECT = `
  id, description, created_at,
  equipment:equipment!inner(id, name, equipment_type_id, equipment_type:equipment_types(id, name)),
  reported_by:profiles!fault_reports_reported_by_fkey(id, display_name)
`;

const REPAIR_SELECT = `
  id, note, cost, vendor, repaired_at,
  equipment:equipment!inner(id, name, equipment_type_id, equipment_type:equipment_types(id, name)),
  repaired_by:profiles(id, display_name)
`;

function applyCommonFilters(query, filters, { equipmentTypeColumn = "equipment.equipment_type_id" } = {}) {
  if (filters.equipmentId) query = query.eq("equipment_id", filters.equipmentId);
  if (filters.equipmentTypeId) query = query.eq(equipmentTypeColumn, filters.equipmentTypeId);
  return query;
}

async function queryCheckoutEvents(filters) {
  let query = supabase.from("equipment_checkouts").select(CHECKOUT_SELECT);
  query = applyCommonFilters(query, filters);
  if (filters.from) query = query.gte("checked_out_at", filters.from);
  if (filters.to) query = query.lte("checked_out_at", filters.to);
  if (filters.status === "open") query = query.is("checked_in_at", null);
  if (filters.status === "closed") query = query.not("checked_in_at", "is", null);
  // A person filter on a checkout means "checked it out or checked it
  // back in" -- can't express an OR across two columns server-side without
  // an .or() string, so this one filter is applied client-side below
  // alongside the other two event types for consistency.

  const { data, error } = await query;
  if (error) {
    console.error("queryEquipmentCheckouts (checkouts) failed", error);
    throw error;
  }
  return (data || [])
    .filter((c) => !filters.profileId || c.checked_out_by?.id === filters.profileId || c.checked_in_by_profile?.id === filters.profileId)
    .map((c) => ({
      id: `checkout-${c.id}`,
      type: "checkout",
      equipment: c.equipment,
      person: c.checked_out_by?.display_name,
      date: c.checked_out_at,
      raw: c,
      details: c.checked_in_at
        ? `Checked out by ${c.checked_out_by?.display_name || "—"}, returned by ${c.checked_in_by_profile?.display_name || "—"}`
        : `Checked out by ${c.checked_out_by?.display_name || "—"} — still out`,
    }));
}

async function queryFaultEvents(filters) {
  // Status (open/closed checkout) has no meaning for a fault report --
  // narrowing to it hides fault/repair events entirely rather than
  // guessing which checkout they belong to.
  if (filters.status === "open" || filters.status === "closed") return [];
  let query = supabase.from("fault_reports").select(FAULT_SELECT);
  query = applyCommonFilters(query, filters);
  if (filters.from) query = query.gte("created_at", filters.from);
  if (filters.to) query = query.lte("created_at", filters.to);
  if (filters.profileId) query = query.eq("reported_by", filters.profileId);

  const { data, error } = await query;
  if (error) {
    console.error("queryEquipmentCheckouts (faults) failed", error);
    throw error;
  }
  return (data || []).map((f) => ({
    id: `fault-${f.id}`,
    type: "fault",
    equipment: f.equipment,
    person: f.reported_by?.display_name,
    date: f.created_at,
    raw: f,
    details: f.description,
  }));
}

async function queryRepairEvents(filters) {
  if (filters.status === "open" || filters.status === "closed") return [];
  let query = supabase.from("repair_records").select(REPAIR_SELECT);
  query = applyCommonFilters(query, filters);
  if (filters.from) query = query.gte("repaired_at", filters.from);
  if (filters.to) query = query.lte("repaired_at", filters.to);
  if (filters.profileId) query = query.eq("repaired_by", filters.profileId);

  const { data, error } = await query;
  if (error) {
    console.error("queryEquipmentCheckouts (repairs) failed", error);
    throw error;
  }
  return (data || []).map((r) => ({
    id: `repair-${r.id}`,
    type: "repair",
    equipment: r.equipment,
    person: r.repaired_by?.display_name,
    date: r.repaired_at,
    raw: r,
    details: [r.note, r.vendor && `via ${r.vendor}`, r.cost != null && `£${r.cost}`].filter(Boolean).join(" · "),
  }));
}

export async function queryEquipmentHistory(filters = {}) {
  const wantFaultsRepairsOnly = !!filters.faultsOnly;
  const [checkouts, faults, repairs] = await Promise.all([
    wantFaultsRepairsOnly ? [] : queryCheckoutEvents(filters),
    queryFaultEvents(filters),
    queryRepairEvents(filters),
  ]);
  return [...checkouts, ...faults, ...repairs].sort((a, b) => new Date(b.date) - new Date(a.date));
}
