// Availability for the kiosk check-out flow: an in_service unit with no
// currently-open equipment_checkouts row. Deliberately does not use
// equipment.held_by_profile_id (a separate, longer-term "permanently
// issued to" concept) -- equipment_checkouts is the sole source of truth
// for short-term checkout state (see 16-rfid-kiosk-and-equipment-
// checkout.sql).
import { supabase } from "./supabaseClient.js";

export async function getEquipmentTypeAvailabilityCounts(orgId) {
  const [{ data: types }, { data: equipment }, { data: openCheckouts }, { data: docLinks }] = await Promise.all([
    supabase.from("equipment_types").select("id, name, pre_use_checklist, allow_multi_checkout").eq("org_id", orgId).order("sort_order"),
    supabase.from("equipment").select("id, equipment_type_id, status").eq("org_id", orgId),
    supabase.from("equipment_checkouts").select("equipment_id").is("checked_in_at", null),
    // Kiosk checkout surfaces these via a "Health & Safety" button once
    // an equipment type has any linked -- fetched here, not on demand,
    // so the button's own visibility (has documents or not) doesn't need
    // a second round trip per type.
    supabase.from("equipment_type_documents").select("equipment_type_id, document:ra_ms_documents(id, type, title, description, pdf_storage_path)"),
  ]);

  const checkedOutIds = new Set((openCheckouts || []).map((c) => c.equipment_id));
  const counts = {};
  for (const e of equipment || []) {
    if (!e.equipment_type_id) continue;
    const bucket = (counts[e.equipment_type_id] ||= { available: 0, total: 0 });
    bucket.total += 1;
    // "monitor" is checkout-eligible too -- the whole point of that status
    // is the machine goes back into use, just flagged, unlike faulty/
    // in_repair/scrapped/decommissioned which all genuinely block it.
    if ((e.status === "in_service" || e.status === "monitor") && !checkedOutIds.has(e.id)) bucket.available += 1;
  }

  const documentsByType = {};
  for (const link of docLinks || []) {
    documentsByType[link.equipment_type_id] = [...(documentsByType[link.equipment_type_id] || []), link.document];
  }
  for (const docs of Object.values(documentsByType)) {
    docs.sort((a, b) => a.title.localeCompare(b.title));
  }

  return (types || []).map((t) => ({
    id: t.id,
    name: t.name,
    preUseChecklist: t.pre_use_checklist || [],
    allowMultiCheckout: t.allow_multi_checkout || false,
    availableCount: counts[t.id]?.available || 0,
    totalCount: counts[t.id]?.total || 0,
    documents: documentsByType[t.id] || [],
  }));
}

export async function getAvailableUnits(equipmentTypeId) {
  const [{ data: equipment }, { data: openCheckouts }] = await Promise.all([
    supabase
      .from("equipment")
      .select(
        `id, name, status, monitor_note, tracks_hours, hours_required, last_hours_reading, last_hours_reading_at,
         equipment_type:equipment_types(tracks_hours_default, hours_required_default)`
      )
      .eq("equipment_type_id", equipmentTypeId)
      .in("status", ["in_service", "monitor"])
      .order("name"),
    supabase.from("equipment_checkouts").select("equipment_id").is("checked_in_at", null),
  ]);
  const checkedOutIds = new Set((openCheckouts || []).map((c) => c.equipment_id));
  return (equipment || [])
    .filter((e) => !checkedOutIds.has(e.id))
    .map((e) => ({
      ...e,
      // null on the item itself means "use the type's default" -- same
      // fall-through convention as the repair-assignee default/override
      // chain (equipment_type_repair_assignees).
      tracksHours: e.tracks_hours ?? e.equipment_type?.tracks_hours_default ?? false,
      hoursRequired: e.hours_required ?? e.equipment_type?.hours_required_default ?? false,
    }));
}
