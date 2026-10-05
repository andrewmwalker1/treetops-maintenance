// Machine competencies (83-machine-competencies.sql): which equipment types
// each person is competent to operate. One row per tick; unticking sets
// revoked_at rather than deleting, so the history stays. A person is
// competent on a type while they have a row for it with revoked_at null.
//
// Reads return null rather than throwing when the query fails, so the
// check-out screens keep working (with no warning) on a database the
// migration hasn't reached yet.
import { supabase } from "./supabaseClient.js";

// The equipment type ids this person is currently competent on, or null if
// that couldn't be loaded.
export async function getCompetentTypeIds(profileId) {
  const { data, error } = await supabase
    .from("profile_machine_competencies")
    .select("equipment_type_id")
    .eq("profile_id", profileId)
    .is("revoked_at", null);
  if (error) return null;
  return new Set((data || []).map((r) => r.equipment_type_id));
}

// Every current tick in the org, with who ticked it -- for the admin screen.
export async function getCurrentCompetencies(orgId) {
  const { data, error } = await supabase
    .from("profile_machine_competencies")
    .select("id, profile_id, equipment_type_id, granted_at, granted_by_profile:profiles!profile_machine_competencies_granted_by_fkey(display_name)")
    .eq("org_id", orgId)
    .is("revoked_at", null);
  if (error) return null;
  return data || [];
}

// Brings one person's ticks into line with `wantedTypeIds`: adds a row for
// each newly ticked type, revokes the row for each unticked one.
export async function saveCompetencies({ orgId, profileId, actorId, currentRows, wantedTypeIds }) {
  const now = new Date().toISOString();
  const currentTypeIds = new Set(currentRows.map((r) => r.equipment_type_id));
  const toAdd = [...wantedTypeIds].filter((id) => !currentTypeIds.has(id));
  const toRevoke = currentRows.filter((r) => !wantedTypeIds.has(r.equipment_type_id));

  if (toAdd.length > 0) {
    const { error } = await supabase.from("profile_machine_competencies").insert(
      toAdd.map((equipment_type_id) => ({ org_id: orgId, profile_id: profileId, equipment_type_id, granted_by: actorId }))
    );
    if (error) return error;
  }
  if (toRevoke.length > 0) {
    const { error } = await supabase
      .from("profile_machine_competencies")
      .update({ revoked_at: now, revoked_by: actorId })
      .in("id", toRevoke.map((r) => r.id));
    if (error) return error;
  }
  return null;
}
