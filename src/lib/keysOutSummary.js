// Shared "which keys are currently out, and who has them" query + display
// helpers -- used by the main Dashboard (Dashboard.jsx) and the key
// station's own menu (KeyStationMenu.jsx), so both read the same shape
// instead of drifting into two slightly different queries over time.

import { supabase } from "./supabaseClient.js";
import { formatKeyLocation } from "../keys/KeySelector.jsx";

export async function queryOpenKeyCheckouts(siteId) {
  const { data } = await supabase
    .from("key_checkouts")
    .select(
      `id, checked_out_at, issued_to_kind, issued_to_name, reason,
       issued_to_contractor:contractors(id, name),
       checked_out_by_profile:profiles!key_checkouts_checked_out_by_fkey(id, display_name),
       key_tags!inner(site_id, pitches(pitch_number_or_name), key_special_locations(label))`
    )
    .is("checked_in_at", null)
    .eq("key_tags.site_id", siteId)
    .order("checked_out_at");
  return data || [];
}

export function keyLocationLabel(checkout) {
  return formatKeyLocation(checkout.key_tags?.pitches?.pitch_number_or_name, checkout.key_tags?.key_special_locations?.label, "Unknown location");
}

export function keyIssuedToLabel(checkout) {
  if (checkout.issued_to_kind === "self") return checkout.checked_out_by_profile?.display_name || "—";
  if (checkout.issued_to_kind === "contractor") return checkout.issued_to_contractor?.name || checkout.issued_to_name || "Contractor";
  return checkout.issued_to_name || (checkout.issued_to_kind === "guest" ? "Guest" : "Customer");
}

export function timeAgo(iso) {
  const ms = Date.now() - new Date(iso).getTime();
  const hours = Math.floor(ms / 3600000);
  if (hours < 1) return "under an hour ago";
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

// Grouped by who it's out to rather than a flat list -- keys held by
// staff themselves are a different kind of "who do I chase" than ones out
// with a contractor or a customer/guest. Customer and guest share a group
// since both are "someone outside the business has it" from a staff
// member's point of view.
export const KEY_GROUPS = [
  { key: "staff", label: "Staff", match: (c) => c.issued_to_kind === "self" },
  { key: "contractors", label: "Contractors", match: (c) => c.issued_to_kind === "contractor" },
  { key: "customers", label: "Customers & guests", match: (c) => c.issued_to_kind === "customer" || c.issued_to_kind === "guest" },
];
