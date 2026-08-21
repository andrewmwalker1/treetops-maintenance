// Shared "where's this key" state: pick a tag, show its most recent
// check-out/check-in event. Originally lived entirely inside
// KeyStationLookup.jsx (the key-cupboard kiosk); pulled out for the same
// reason as useKeyCheckout.js/useKeyCheckin.js -- an in-app Keys page runs
// the exact same logic instead of a hand-copied second version.
import { useEffect, useState } from "react";
import { useAuth } from "./AuthContext.jsx";
import { supabase } from "./supabaseClient.js";

export function summarizeKeyEvent(event) {
  if (!event) return "No activity recorded for this key yet.";
  const by = event.checked_in_at ? event.checked_in_by_profile?.display_name : event.checked_out_by_profile?.display_name;
  const when = new Date(event.checked_in_at || event.checked_out_at).toLocaleString("en-GB");
  return event.checked_in_at
    ? `Checked in ${when} by ${by || "—"} — currently in the cupboard.`
    : `Checked out ${when} by ${by || "—"} — still out.`;
}

export function useKeyLookup() {
  const { activeSite } = useAuth();
  const [keyTags, setKeyTags] = useState([]);
  const [selectedTag, setSelectedTag] = useState(null);
  const [lastEvent, setLastEvent] = useState(undefined); // undefined = loading, null = none
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!activeSite) return;
    supabase
      .from("key_tags")
      .select("id, tag_uid, pitch_id, special_location_id, status, pitches(pitch_number_or_name), key_special_locations(label)")
      .eq("site_id", activeSite.id)
      .then(({ data }) => setKeyTags((data || []).filter((t) => (t.pitch_id || t.special_location_id) && t.status !== "lost")));
  }, [activeSite]);

  function pickTag(tag) {
    setError(null);
    setSelectedTag(tag);
    setLastEvent(undefined);
    supabase
      .from("key_checkouts")
      .select(
        `checked_out_at, checked_in_at,
         checked_out_by_profile:profiles!key_checkouts_checked_out_by_fkey(display_name),
         checked_in_by_profile:profiles!key_checkouts_checked_in_by_fkey(display_name)`
      )
      .eq("key_tag_id", tag.id)
      .order("checked_out_at", { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(({ data, error: err }) => {
        if (err) setError(err.message);
        setLastEvent(data || null);
      });
  }

  function backToSelect() {
    setSelectedTag(null);
  }

  return { keyTags, selectedTag, lastEvent, error, pickTag, backToSelect };
}
