// Shared "move a key tag to a different pitch or special location" state
// machine: select -> confirm -> done. Originally lived entirely inside
// KeyStationRelocate.jsx (the key-cupboard kiosk); pulled out so an in-app
// Keys page runs the exact same logic rather than a hand-copied second
// version that drifts over time -- same split as useKeyCheckin.js/
// CheckInKey.jsx. Each caller supplies its own JSX/styling and its own
// can_manage_keys gate -- this only owns state and writes.
import { useEffect, useState } from "react";
import { useAuth } from "./AuthContext.jsx";
import { supabase } from "./supabaseClient.js";

export function useKeyRelocate() {
  const { activeSite } = useAuth();
  const [view, setView] = useState("select"); // select | confirm | done
  const [keyTags, setKeyTags] = useState([]);
  const [pitches, setPitches] = useState([]);
  const [specialLocations, setSpecialLocations] = useState([]);
  const [openTagIds, setOpenTagIds] = useState(new Set());
  const [selectedTag, setSelectedTag] = useState(null);

  // pitch_id and special_location_id are independent now (47-key-tags-
  // pitch-persists-through-special-location.sql) -- no more "kind" to
  // switch between, both fields are just edited directly.
  const [pitchId, setPitchId] = useState("");
  const [specialLocationId, setSpecialLocationId] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  function refresh() {
    if (!activeSite) return;
    Promise.all([
      supabase
        .from("key_tags")
        .select("id, tag_uid, pitch_id, special_location_id, status, pitches(pitch_number_or_name), key_special_locations(label)")
        .eq("site_id", activeSite.id),
      supabase.from("pitches").select("id, pitch_number_or_name").eq("site_id", activeSite.id).order("pitch_number_or_name"),
      supabase.from("key_special_locations").select("id, label").eq("site_id", activeSite.id).order("label"),
      supabase.from("key_checkouts").select("key_tag_id").is("checked_in_at", null),
    ]).then(([{ data: kt }, { data: p }, { data: s }, { data: open }]) => {
      setKeyTags((kt || []).filter((t) => (t.pitch_id || t.special_location_id) && t.status === "active"));
      setPitches(p || []);
      setSpecialLocations(s || []);
      setOpenTagIds(new Set((open || []).map((o) => o.key_tag_id)));
    });
  }

  useEffect(refresh, [activeSite]);

  function pickTag(tag) {
    setError(null);
    setSelectedTag(tag);
    setPitchId(tag.pitch_id || "");
    setSpecialLocationId(tag.special_location_id || "");
    setView("confirm");
  }

  function backToSelect() {
    setView("select");
    setSelectedTag(null);
    refresh();
  }

  // At least one of the two must stay set from this screen -- dropping a
  // key to no location at all is what KeyTagsTab's dedicated "Remove"
  // action is for, not a side effect of relocating.
  const canSubmit = Boolean(pitchId || specialLocationId);

  async function handleSubmit() {
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    const { error: err } = await supabase
      .from("key_tags")
      .update({
        pitch_id: pitchId || null,
        special_location_id: specialLocationId || null,
      })
      .eq("id", selectedTag.id);
    setSubmitting(false);
    if (err) {
      setError(err.message);
      return;
    }
    setView("done");
  }

  return {
    view,
    keyTags,
    pitches,
    specialLocations,
    openTagIds,
    selectedTag,
    pitchId,
    setPitchId,
    specialLocationId,
    setSpecialLocationId,
    submitting,
    error,
    canSubmit,
    pickTag,
    backToSelect,
    handleSubmit,
  };
}
