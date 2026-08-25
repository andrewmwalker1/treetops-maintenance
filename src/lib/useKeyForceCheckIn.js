// Shared "force check a key in" state machine: select -> confirm -> done.
// Originally lived entirely inside KeyStationForceCheckIn.jsx (the
// key-cupboard kiosk); pulled out so an in-app Keys page runs the exact
// same logic rather than a hand-copied second version that drifts over
// time -- same split as useKeyCheckin.js/CheckInKey.jsx. Each caller
// supplies its own JSX/styling and its own can_manage_keys gate -- this
// only owns state and writes.
import { useEffect, useState } from "react";
import { useAuth } from "./AuthContext.jsx";
import { supabase } from "./supabaseClient.js";

export function useKeyForceCheckIn() {
  const { activeSite } = useAuth();
  const [view, setView] = useState("select"); // select | confirm | done
  const [openTags, setOpenTags] = useState([]);
  const [selected, setSelected] = useState(null); // flattened tag + .checkout
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  function refresh() {
    if (!activeSite) return;
    supabase
      .from("key_checkouts")
      .select(
        `id, checked_out_at, reason, issued_to_kind, issued_to_name,
         issued_to_contractor:contractors(name),
         checked_out_by_profile:profiles!key_checkouts_checked_out_by_fkey(display_name),
         key_tags!inner(id, tag_uid, site_id, pitch_id, special_location_id, pitches(pitch_number_or_name), key_special_locations(label))`
      )
      .is("checked_in_at", null)
      .eq("key_tags.site_id", activeSite.id)
      .then(({ data }) => {
        setOpenTags(
          (data || []).map((c) => ({
            id: c.key_tags.id,
            tag_uid: c.key_tags.tag_uid,
            pitches: c.key_tags.pitches,
            key_special_locations: c.key_tags.key_special_locations,
            checkout: c,
          }))
        );
      });
  }

  useEffect(refresh, [activeSite]);

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
    const { error: err } = await supabase.rpc("admin_force_check_in_key", { p_checkout_id: selected.checkout.id });
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
