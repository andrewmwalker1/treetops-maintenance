// Shared key check-in state machine: select -> confirm -> done. Originally
// lived entirely inside KeyStationCheckIn.jsx (the key-cupboard kiosk);
// pulled out so an in-app Keys page (reachable from staff's own phones
// without standing at the cupboard) runs the exact same logic rather than
// a hand-copied second version that drifts over time -- same split as
// useEquipmentCheckin.js/CheckinKit.jsx. Each caller supplies its own
// JSX/styling -- this only owns state and writes.
import { useEffect, useState } from "react";
import { useAuth } from "./AuthContext.jsx";
import { supabase } from "./supabaseClient.js";

export function issuedToSummary(checkout) {
  if (checkout.issued_to_kind === "self") return checkout.checked_out_by_profile?.display_name || "the person who took it";
  if (checkout.issued_to_kind === "contractor") return checkout.issued_to_contractor?.name || checkout.issued_to_name || "a contractor";
  return checkout.issued_to_name || (checkout.issued_to_kind === "guest" ? "a guest" : "a customer");
}

export function useKeyCheckin() {
  const { profile, activeSite } = useAuth();
  const [view, setView] = useState("select"); // select | confirm | done
  const [openTags, setOpenTags] = useState([]);
  const [selected, setSelected] = useState(null); // flattened tag + .checkout
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  function refresh() {
    if (!activeSite || !profile) return;
    supabase
      .from("key_checkouts")
      .select(
        `id, checked_out_at, reason, issued_to_kind, issued_to_name,
         issued_to_contractor:contractors(name),
         checked_out_by_profile:profiles!key_checkouts_checked_out_by_fkey(id, display_name),
         key_tags!inner(id, tag_uid, site_id, pitch_id, special_location_id, pitches(pitch_number_or_name), key_special_locations(label))`
      )
      .is("checked_in_at", null)
      .eq("key_tags.site_id", activeSite.id)
      .then(({ data }) => {
        // Contractors can only check their own keys back in (RLS enforces
        // this regardless -- see current_is_contractor() in 40-key-
        // checkin-delegates.sql -- this just keeps a contractor from
        // seeing, then failing to act on, someone else's open key).
        const rows = profile.is_contractor ? (data || []).filter((c) => c.checked_out_by_profile?.id === profile.id) : data || [];
        setOpenTags(
          rows.map((c) => ({
            id: c.key_tags.id,
            tag_uid: c.key_tags.tag_uid,
            pitches: c.key_tags.pitches,
            key_special_locations: c.key_tags.key_special_locations,
            checkout: c,
          }))
        );
      });
  }

  useEffect(refresh, [activeSite, profile]);

  function pickTag(tag) {
    setError(null);
    setSelected(tag);
    setView("confirm");
  }

  function backToSelect() {
    setView("select");
    setSelected(null);
    refresh();
  }

  async function handleConfirm() {
    setSubmitting(true);
    setError(null);
    const { error: err } = await supabase
      .from("key_checkouts")
      .update({ checked_in_at: new Date().toISOString(), checked_in_by: profile.id })
      .eq("id", selected.checkout.id);
    setSubmitting(false);
    if (err) {
      setError(err.message);
      return;
    }
    setView("done");
  }

  return {
    view,
    openTags,
    selected,
    submitting,
    error,
    pickTag,
    backToSelect,
    handleConfirm,
  };
}
