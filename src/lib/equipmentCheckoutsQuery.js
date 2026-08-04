// Single source of truth for "which equipment_checkouts rows match the
// current admin log filters" -- reused by the admin log tab and its CSV
// export, same reasoning as queryJobs in jobsQuery.js. RLS (can_see_equipment,
// widened for can_manage_equipment_status holders in
// 16-rfid-kiosk-and-equipment-checkout.sql) is what actually restricts this
// to the caller's org; the filters here are UI-level narrowing on top.

import { supabase } from "./supabaseClient.js";

const CHECKOUT_SELECT = `
  id, checked_out_at, checked_in_at, checkin_fault_report_id,
  equipment:equipment!inner(id, name, equipment_type_id, equipment_type:equipment_types(id, name)),
  checked_out_by:profiles!equipment_checkouts_profile_id_fkey(id, display_name),
  checked_in_by_profile:profiles!equipment_checkouts_checked_in_by_fkey(id, display_name),
  fault:fault_reports(id, description, created_at)
`;

export async function queryEquipmentCheckouts(filters = {}) {
  let query = supabase.from("equipment_checkouts").select(CHECKOUT_SELECT);

  if (filters.equipmentId) query = query.eq("equipment_id", filters.equipmentId);
  if (filters.equipmentTypeId) query = query.eq("equipment.equipment_type_id", filters.equipmentTypeId);
  if (filters.profileId) query = query.eq("profile_id", filters.profileId);
  if (filters.from) query = query.gte("checked_out_at", filters.from);
  if (filters.to) query = query.lte("checked_out_at", filters.to);
  if (filters.status === "open") query = query.is("checked_in_at", null);
  if (filters.status === "closed") query = query.not("checked_in_at", "is", null);
  if (filters.faultsOnly) query = query.not("checkin_fault_report_id", "is", null);

  query = query.order("checked_out_at", { ascending: false });

  const { data, error } = await query;
  if (error) {
    console.error("queryEquipmentCheckouts failed", error);
    throw error;
  }
  return data;
}
