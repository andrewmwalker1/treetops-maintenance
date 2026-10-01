// Versioned pre-use checklists (81-equipment-checklist-versions.sql): every
// change to an equipment type's checklist is kept as a numbered version, and
// each checkout records the version it was taken against.
//
// Every helper here returns an empty result rather than throwing when the
// query fails, so the screens that use them keep working on a database the
// migration hasn't reached yet -- they just show no versions.
import { supabase } from "./supabaseClient.js";

const VERSION_SELECT =
  "id, equipment_type_id, equipment_type_name, version_number, items, created_at, created_by_profile:profiles(display_name)";

// equipment_type_id -> its latest version, for the checkout pickers.
export async function getLatestChecklistVersions() {
  const { data, error } = await supabase
    .from("equipment_type_checklist_versions")
    .select("id, equipment_type_id, version_number")
    .order("version_number", { ascending: false });
  if (error) return {};
  const latest = {};
  for (const v of data || []) if (v.equipment_type_id && !latest[v.equipment_type_id]) latest[v.equipment_type_id] = v;
  return latest;
}

// version id -> full version, for the checkouts listed in Equipment history.
export async function getChecklistVersionsByIds(ids) {
  const unique = [...new Set(ids.filter(Boolean))];
  if (unique.length === 0) return {};
  const { data, error } = await supabase.from("equipment_type_checklist_versions").select(VERSION_SELECT).in("id", unique);
  if (error) return {};
  return Object.fromEntries((data || []).map((v) => [v.id, v]));
}

// Every version of one type's checklist, newest first.
export async function getChecklistVersionsForType(equipmentTypeId) {
  const { data, error } = await supabase
    .from("equipment_type_checklist_versions")
    .select(VERSION_SELECT)
    .eq("equipment_type_id", equipmentTypeId)
    .order("version_number", { ascending: false });
  if (error) return [];
  return data || [];
}
