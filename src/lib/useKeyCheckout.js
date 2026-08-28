// Shared key check-out state machine: select -> confirm -> done. Originally
// lived entirely inside KeyStationCheckOut.jsx (the key-cupboard kiosk);
// pulled out so an in-app Keys page (reachable from staff's own phones
// without standing at the cupboard) runs the exact same logic rather than
// a hand-copied second version that drifts over time -- same split as
// useEquipmentCheckout.js/CheckoutKit.jsx. Each caller supplies its own
// JSX/styling -- this only owns state and writes.
import { useEffect, useRef, useState } from "react";
import { useAuth } from "./AuthContext.jsx";
import { supabase } from "./supabaseClient.js";

export const OTHER_CONTRACTOR = "__other__";

export function useKeyCheckout(presetTagId) {
  const { profile, org, activeSite } = useAuth();
  const [view, setView] = useState("select"); // select | confirm | done
  const [keyTags, setKeyTags] = useState([]);
  const [openTagIds, setOpenTagIds] = useState(new Set());
  const [contractors, setContractors] = useState([]);
  const [selfReasons, setSelfReasons] = useState([]);
  const [customerReasons, setCustomerReasons] = useState([]);
  const [guestReasons, setGuestReasons] = useState([]);
  const [selectedTag, setSelectedTag] = useState(null);

  const [issuedToKind, setIssuedToKind] = useState("self");
  const [contractorChoice, setContractorChoice] = useState("");
  const [contractorFreeText, setContractorFreeText] = useState("");
  const [contractorReasons, setContractorReasons] = useState([]);
  const [personName, setPersonName] = useState("");
  const [guestConfirmed, setGuestConfirmed] = useState(false);
  const [reason, setReason] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  function refresh() {
    if (!org || !activeSite) return;
    Promise.all([
      supabase
        .from("key_tags")
        .select("id, tag_uid, pitch_id, special_location_id, status, pitches(pitch_number_or_name), key_special_locations(label)")
        .eq("site_id", activeSite.id),
      supabase.from("key_checkouts").select("key_tag_id").is("checked_in_at", null),
      supabase.from("contractors").select("id, name").eq("org_id", org.id).order("name"),
    ]).then(([{ data: kt }, { data: open }, { data: c }]) => {
      setKeyTags((kt || []).filter((t) => (t.pitch_id || t.special_location_id) && t.status === "active"));
      setOpenTagIds(new Set((open || []).map((o) => o.key_tag_id)));
      setContractors(c || []);
    });
  }

  useEffect(refresh, [org, activeSite]);

  // Preset reasons for checking a key out to yourself, by your own role
  // (RoleKeyReasonsTab.jsx) -- e.g. Sam's "Caravan Prep" role might offer
  // "Clean the caravan" / "At the request of the owner" / "Dress the
  // caravan". Loaded once per role, unlike contractorReasons below which
  // reloads whenever the picked contractor changes.
  useEffect(() => {
    if (!profile?.role_id) return;
    supabase
      .from("role_key_reasons")
      .select("id, label")
      .eq("role_id", profile.role_id)
      .order("sort_order")
      .then(({ data }) => setSelfReasons(data || []));
  }, [profile?.role_id]);

  // Standard reasons for keys issued to a customer or guest (org-wide,
  // not tied to a specific person -- see 42-key-tags-lost-status-and-
  // reasons.sql). Loaded once, same as selfReasons.
  useEffect(() => {
    if (!org) return;
    supabase
      .from("key_reason_presets")
      .select("id, label, kind")
      .eq("org_id", org.id)
      .order("sort_order")
      .then(({ data }) => {
        setCustomerReasons((data || []).filter((r) => r.kind === "customer"));
        setGuestReasons((data || []).filter((r) => r.kind === "guest"));
      });
  }, [org]);

  useEffect(() => {
    if (!contractorChoice || contractorChoice === OTHER_CONTRACTOR) {
      setContractorReasons([]);
      return;
    }
    supabase
      .from("contractor_reasons")
      .select("id, label")
      .eq("contractor_id", contractorChoice)
      .order("sort_order")
      .then(({ data }) => setContractorReasons(data || []));
  }, [contractorChoice]);

  // A trusted contractor's own login (profile.contractor_id --
  // 43-contractor-linked-profiles.sql) is only ever taking a key for their
  // own company's work, so this is pre-filled and locked rather than
  // asking "who's taking it?" -- that's how Kevin and his son Ben both end
  // up correctly counted as "keys out to Kevin Parry" even though each
  // signs in under their own account.
  const myContractor = profile?.contractor_id ? contractors.find((c) => c.id === profile.contractor_id) : null;

  function pickTag(tag) {
    setError(null);
    setSelectedTag(tag);
    setIssuedToKind(myContractor ? "contractor" : "self");
    setContractorChoice(myContractor ? myContractor.id : "");
    setContractorFreeText("");
    setPersonName("");
    setGuestConfirmed(false);
    setReason("");
    setView("confirm");
  }

  function backToSelect() {
    setView("select");
    setSelectedTag(null);
    refresh();
  }

  const reasonPresets =
    { self: selfReasons, contractor: contractorReasons, customer: customerReasons, guest: guestReasons }[issuedToKind] || [];

  const canSubmit =
    reason.trim().length > 0 &&
    (issuedToKind === "self" ||
      (issuedToKind === "contractor" && (contractorChoice === OTHER_CONTRACTOR ? contractorFreeText.trim() : contractorChoice)) ||
      (issuedToKind === "customer" && personName.trim()) ||
      (issuedToKind === "guest" && personName.trim() && guestConfirmed));

  async function handleSubmit() {
    if (!canSubmit || !selectedTag) return;
    setSubmitting(true);
    setError(null);
    const { error: err } = await supabase.from("key_checkouts").insert({
      key_tag_id: selectedTag.id,
      checked_out_by: profile.id,
      issued_to_kind: issuedToKind,
      issued_to_contractor_id: issuedToKind === "contractor" && contractorChoice !== OTHER_CONTRACTOR ? contractorChoice || null : null,
      issued_to_name:
        issuedToKind === "self"
          ? null
          : issuedToKind === "contractor"
          ? contractorChoice === OTHER_CONTRACTOR
            ? contractorFreeText.trim()
            : null
          : personName.trim(),
      reason: reason.trim(),
    });
    setSubmitting(false);
    if (err) {
      setError(err.code === "23505" ? "This key was just checked out by someone else." : err.message);
      return;
    }
    setView("done");
  }

  const availableTags = keyTags.filter((t) => !openTagIds.has(t.id));

  // Lets the key-station Menu (and KeysHome) jump straight past the picker
  // when a scan already told it which tag this is and that it's available
  // -- see KeyStationMenu.jsx's handleScan. autoPickedRef stops this from
  // re-firing every time refresh() reloads keyTags (e.g. after backToSelect
  // from an unrelated flow). If the tag isn't actually in availableTags by
  // the time this list lands (someone else took it in the meantime, or it
  // has no location yet), this just silently does nothing and the ordinary
  // picker shows -- no dead-end error screen for a race that's already rare.
  const autoPickedRef = useRef(false);
  useEffect(() => {
    if (!presetTagId || autoPickedRef.current) return;
    const tag = availableTags.find((t) => t.id === presetTagId);
    if (tag) {
      autoPickedRef.current = true;
      pickTag(tag);
    }
  }, [presetTagId, availableTags]);

  return {
    view,
    availableTags,
    openTagIds,
    contractors,
    selectedTag,
    issuedToKind,
    setIssuedToKind,
    contractorChoice,
    setContractorChoice,
    contractorFreeText,
    setContractorFreeText,
    personName,
    setPersonName,
    guestConfirmed,
    setGuestConfirmed,
    reason,
    setReason,
    submitting,
    error,
    setError,
    myContractor,
    reasonPresets,
    canSubmit,
    pickTag,
    backToSelect,
    handleSubmit,
  };
}
