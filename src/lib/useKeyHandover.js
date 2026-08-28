// Shared "hand a key over to its new owner for good" state machine:
// select -> confirm -> done. Same split as useKeyRelocate.js/
// KeyStationRelocate.jsx -- pulled out of KeyTagsTab.jsx (2026-08-28) since
// handover was admin-only there and Andy found that didn't hold up in real
// use: staff need to do this from the key station or their own phone, not
// walk it to a desktop. Goes through handover_key_tag
// (48-key-tags-handover.sql) rather than a plain update -- it force-closes
// any open checkout on this tag in the same transaction, which a
// client-side update can't do, and already enforces can_manage_keys
// server-side, so that's the same permission this UI gates on -- no new
// permission for Andy to configure separately.
import { useEffect, useState } from "react";
import { useAuth } from "./AuthContext.jsx";
import { supabase } from "./supabaseClient.js";

export function useKeyHandover() {
  const { activeSite } = useAuth();
  const [view, setView] = useState("select"); // select | confirm | done
  const [keyTags, setKeyTags] = useState([]);
  const [openTagIds, setOpenTagIds] = useState(new Set());
  const [selectedTag, setSelectedTag] = useState(null);

  const [handoverTo, setHandoverTo] = useState("");
  const [notes, setNotes] = useState("");
  const [fobConfirmed, setFobConfirmed] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  function refresh() {
    if (!activeSite) return;
    Promise.all([
      // Only active tags with a home pitch qualify -- handover_key_tag
      // itself rejects anything else ("no home pitch to hand over"), so
      // this keeps the picker from offering a tag that'll just error on
      // submit.
      supabase
        .from("key_tags")
        .select("id, tag_uid, pitch_id, special_location_id, status, pitches(pitch_number_or_name), key_special_locations(label)")
        .eq("site_id", activeSite.id)
        .eq("status", "active")
        .not("pitch_id", "is", null),
      supabase.from("key_checkouts").select("key_tag_id").is("checked_in_at", null),
    ]).then(([{ data: kt }, { data: open }]) => {
      setKeyTags(kt || []);
      setOpenTagIds(new Set((open || []).map((o) => o.key_tag_id)));
    });
  }

  useEffect(refresh, [activeSite]);

  function pickTag(tag) {
    setError(null);
    setSelectedTag(tag);
    setHandoverTo("");
    setNotes("");
    setFobConfirmed(false);
    setView("confirm");
  }

  function backToSelect() {
    setView("select");
    setSelectedTag(null);
    refresh();
  }

  const canSubmit = Boolean(handoverTo.trim() && fobConfirmed);

  async function handleSubmit() {
    if (!canSubmit || !selectedTag) return;
    setSubmitting(true);
    setError(null);
    const { error: err } = await supabase.rpc("handover_key_tag", {
      p_key_tag_id: selectedTag.id,
      p_handed_over_to: handoverTo.trim(),
      p_notes: notes.trim() || null,
    });
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
    openTagIds,
    selectedTag,
    handoverTo,
    setHandoverTo,
    notes,
    setNotes,
    fobConfirmed,
    setFobConfirmed,
    submitting,
    error,
    canSubmit,
    pickTag,
    backToSelect,
    handleSubmit,
  };
}
