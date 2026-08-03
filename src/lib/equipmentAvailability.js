// Availability for the kiosk check-out flow: an in_service unit with no
// currently-open equipment_checkouts row. Deliberately does not use
// equipment.held_by_profile_id (a separate, longer-term "permanently
// issued to" concept) -- equipment_checkouts is the sole source of truth
// for short-term checkout state (see 16-rfid-kiosk-and-equipment-
// checkout.sql).
import { supabase } from "./supabaseClient.js";

export async function getEquipmentTypeAvailabilityCounts(orgId) {
  const [{ data: types }, { data: equipment }, { data: openCheckouts }] = await Promise.all([
    supabase.from("equipment_types").select("id, name, pre_use_checklist").eq("org_id", orgId).order("sort_order"),
    supabase.from("equipment").select("id, equipment_type_id, status").eq("org_id", orgId),
    supabase.from("equipment_checkouts").select("equipment_id").is("checked_in_at", null),
  ]);

  const checkedOutIds = new Set((openCheckouts || []).map((c) => c.equipment_id));
  const counts = {};
  for (const e of equipment || []) {
    if (!e.equipment_type_id) continue;
    const bucket = (counts[e.equipment_type_id] ||= { available: 0, total: 0 });
    bucket.total += 1;
    if (e.status === "in_service" && !checkedOutIds.has(e.id)) bucket.available += 1;
  }

  return (types || []).map((t) => ({
    id: t.id,
    name: t.name,
    preUseChecklist: t.pre_use_checklist || [],
    availableCount: counts[t.id]?.available || 0,
    totalCount: counts[t.id]?.total || 0,
  }));
}

export async function getAvailableUnits(equipmentTypeId) {
  const [{ data: equipment }, { data: openCheckouts }] = await Promise.all([
    supabase
      .from("equipment")
      .select("id, name")
      .eq("equipment_type_id", equipmentTypeId)
      .eq("status", "in_service")
      .order("name"),
    supabase.from("equipment_checkouts").select("equipment_id").is("checked_in_at", null),
  ]);
  const checkedOutIds = new Set((openCheckouts || []).map((c) => c.equipment_id));
  return (equipment || []).filter((e) => !checkedOutIds.has(e.id));
}
