// Single source of truth for "which key checkouts match the current admin
// log filters" -- same reasoning as queryEquipmentHistory in
// equipmentCheckoutsQuery.js, but key_checkouts needs no merge across
// multiple tables (unlike equipment's checkouts/faults/repairs), so this
// is just one filtered, joined select.

import { supabase } from "./supabaseClient.js";

const SELECT = `
  id, checked_out_at, checked_in_at, reason, issued_to_kind, issued_to_name,
  issued_to_contractor:contractors(id, name),
  checked_out_by_profile:profiles!key_checkouts_checked_out_by_fkey(id, display_name),
  checked_in_by_profile:profiles!key_checkouts_checked_in_by_fkey(id, display_name),
  key_tags!inner(id, tag_uid, site_id, pitch_id, special_location_id, pitches(id, pitch_number_or_name), key_special_locations(id, label))
`;

export async function queryKeyCheckouts(filters = {}) {
  let query = supabase.from("key_checkouts").select(SELECT);
  if (filters.siteId) query = query.eq("key_tags.site_id", filters.siteId);
  if (filters.pitchId) query = query.eq("key_tags.pitch_id", filters.pitchId);
  if (filters.specialLocationId) query = query.eq("key_tags.special_location_id", filters.specialLocationId);
  if (filters.status === "open") query = query.is("checked_in_at", null);
  if (filters.status === "closed") query = query.not("checked_in_at", "is", null);
  if (filters.from) query = query.gte("checked_out_at", filters.from);
  if (filters.to) query = query.lte("checked_out_at", filters.to);

  const { data, error } = await query.order("checked_out_at", { ascending: false });
  if (error) {
    console.error("queryKeyCheckouts failed", error);
    throw error;
  }

  // A person filter means "checked it out or checked it back in" -- same
  // OR-across-two-columns reasoning as queryEquipmentHistory, applied
  // client-side since it can't be expressed server-side without an
  // .or() string against two related-table columns.
  return (data || []).filter(
    (c) => !filters.profileId || c.checked_out_by_profile?.id === filters.profileId || c.checked_in_by_profile?.id === filters.profileId
  );
}
