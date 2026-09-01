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

// A pitch whose only key was handed over now has no key_tags row at all
// (handover_key_tag frees the tag immediately -- see
// 54-key-tag-handover-frees-tag.sql) -- searching "OP-E10" would otherwise
// go from showing a handed-over key to showing nothing, which reads as
// "this pitch never had a key" rather than "it was handed over". Reading
// key_tag_events (event_type='handed_over') for the site's pitches instead
// finds this history regardless of what's since happened to the physical
// tag -- each event carries its own handed_over_to/notes copy
// (55-key-tag-events-handover-detail.sql) specifically so a later reuse of
// the same tag on a different pitch can't overwrite this pitch's record.
// Keeps only the most recent handover per pitch.
async function fetchHandoverHistory(siteId) {
  const { data, error } = await supabase
    .from("key_tag_events")
    .select("id, created_at, handed_over_to, handed_over_notes, from_pitch_id, pitches:from_pitch_id(pitch_number_or_name)")
    .eq("event_type", "handed_over")
    .eq("pitches.site_id", siteId)
    .not("from_pitch_id", "is", null)
    .order("created_at", { ascending: false });
  if (error) {
    console.error("Failed to load handover history", error);
    return [];
  }
  const seenPitch = new Set();
  const latestPerPitch = [];
  for (const row of data || []) {
    if (!row.pitches || seenPitch.has(row.from_pitch_id)) continue; // inner-join miss (wrong site) or an older handover for a pitch already covered
    seenPitch.add(row.from_pitch_id);
    latestPerPitch.push({
      id: `handover-${row.id}`,
      isHistorical: true,
      pitches: row.pitches,
      handed_over_to: row.handed_over_to,
      handed_over_notes: row.handed_over_notes,
      created_at: row.created_at,
    });
  }
  return latestPerPitch;
}

export function useKeyLookup() {
  const { activeSite } = useAuth();
  const [keyTags, setKeyTags] = useState([]);
  const [selectedTag, setSelectedTag] = useState(null);
  const [lastEvent, setLastEvent] = useState(undefined); // undefined = loading, null = none
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!activeSite) return;
    // Both fetched together and combined once -- setting each independently
    // (even with a functional update) would race: whichever resolved second
    // would only ever have "the other list as of when THIS one started",
    // silently dropping results if the two responses arrived out of order.
    // Handover history is appended after the active tags (not merged/sorted
    // in) so a search's ordinary results always come first, matching
    // Andy's "show it as the last result", and stays visually distinct in
    // KeySelector rather than mixed in with keys you can actually act on.
    Promise.all([
      supabase
        .from("key_tags")
        .select("id, tag_uid, pitch_id, special_location_id, status, pitches(pitch_number_or_name), key_special_locations(label)")
        .eq("site_id", activeSite.id)
        .then(({ data }) => (data || []).filter((t) => (t.pitch_id || t.special_location_id) && t.status === "active")),
      fetchHandoverHistory(activeSite.id),
    ]).then(([active, history]) => setKeyTags([...active, ...history]));
  }, [activeSite]);

  function pickTag(tag) {
    setError(null);
    setSelectedTag(tag);
    if (tag.isHistorical) {
      setLastEvent(null);
      return;
    }
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
