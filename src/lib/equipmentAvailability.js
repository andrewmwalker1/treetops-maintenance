// Availability for the kiosk check-out flow: an in_service unit with no
// currently-open equipment_checkouts row. Deliberately does not use
// equipment.held_by_profile_id (a separate, longer-term "permanently
// issued to" concept) -- equipment_checkouts is the sole source of truth
// for short-term checkout state (see 16-rfid-kiosk-and-equipment-
// checkout.sql).
import { supabase } from "./supabaseClient.js";

// The "Kit out" dial on the Dashboard and Office Hub. Machines, not
// checkout rows: counted by distinct equipment_id so it matches the list
// the dial opens (EquipmentList's ?out=1).
export async function countMachinesCheckedOut(orgId) {
  const { data } = await supabase
    .from("equipment_checkouts")
    .select("equipment_id, equipment!inner(org_id)")
    .is("checked_in_at", null)
    .eq("equipment.org_id", orgId);
  return new Set((data || []).map((c) => c.equipment_id)).size;
}

// The same two equipment signals as whole lists, for the key station's
// dials: it can't link through to /equipment like the Dashboard does (the
// terminal is confined to /keys), so tapping a dial lists the machines in
// place instead. `out` has one row per machine (earliest open checkout),
// matching countMachinesCheckedOut.
export async function queryEquipmentSignals(orgId) {
  const [{ data: checkouts }, { data: faulty }] = await Promise.all([
    supabase
      .from("equipment_checkouts")
      .select(
        `id, equipment_id, checked_out_at,
         equipment!inner(org_id, name, equipment_type:equipment_types(name)),
         checked_out_by:profiles!equipment_checkouts_profile_id_fkey(display_name)`
      )
      .is("checked_in_at", null)
      .eq("equipment.org_id", orgId)
      .order("checked_out_at"),
    supabase
      .from("equipment")
      .select("id, name, make, model, equipment_type:equipment_types(name)")
      .eq("org_id", orgId)
      .eq("status", "faulty")
      .order("name"),
  ]);
  const out = [];
  const seen = new Set();
  for (const c of checkouts || []) {
    if (seen.has(c.equipment_id)) continue;
    seen.add(c.equipment_id);
    out.push(c);
  }
  return { out, faulty: faulty || [] };
}

export async function getEquipmentTypeAvailabilityCounts(orgId) {
  const [{ data: types }, { data: equipment }, { data: openCheckouts }, { data: docLinks }] = await Promise.all([
    supabase.from("equipment_types").select("id, name, pre_use_checklist, allow_multi_checkout").eq("org_id", orgId).order("sort_order"),
    supabase.from("equipment").select("id, equipment_type_id, status, no_checkout").eq("org_id", orgId),
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
        `id, name, make, model, status, monitor_note, tracks_hours, hours_required, last_hours_reading, last_hours_reading_at,
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
