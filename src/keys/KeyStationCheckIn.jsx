import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../lib/AuthContext.jsx";
import { supabase } from "../lib/supabaseClient.js";
import KeySelector, { locationLabel } from "./KeySelector.jsx";
import { colors, fonts } from "../lib/theme.js";
import { kioskButtonStyle, kioskSecondaryButtonStyle, kioskCardStyle } from "../kiosk/kioskTheme.js";

function issuedToSummary(checkout) {
  if (checkout.issued_to_kind === "self") return checkout.checked_out_by_profile?.display_name || "the person who took it";
  if (checkout.issued_to_kind === "contractor") return checkout.issued_to_contractor?.name || checkout.issued_to_name || "a contractor";
  return checkout.issued_to_name || (checkout.issued_to_kind === "guest" ? "a guest" : "a customer");
}

export default function KeyStationCheckIn() {
  const navigate = useNavigate();
  const { profile, activeSite } = useAuth();
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

  if (view === "done") {
    return (
      <div style={{ padding: "24px", maxWidth: "640px", margin: "0 auto" }}>
        <h1 style={{ fontFamily: fonts.display, color: colors.mossDark, fontSize: "26px", marginTop: 0 }}>Checked in</h1>
        <p style={{ fontSize: "18px" }}>{locationLabel(selected)} — logged.</p>
        <button style={kioskButtonStyle} onClick={() => navigate("/keys")}>Done</button>
      </div>
    );
  }

  if (view === "confirm") {
    const c = selected.checkout;
    return (
      <div style={{ padding: "24px", maxWidth: "640px", margin: "0 auto" }}>
        <button style={{ ...kioskSecondaryButtonStyle, width: "auto", padding: "10px 20px", fontSize: "16px", marginBottom: "20px" }} onClick={backToSelect}>
          ← Back
        </button>
        <h1 style={{ fontFamily: fonts.display, color: colors.mossDark, fontSize: "26px", marginTop: 0 }}>{locationLabel(selected)}</h1>

        <div style={{ ...kioskCardStyle, marginBottom: "20px" }}>
          <p style={{ margin: "4px 0", fontSize: "17px" }}>Out to <strong>{issuedToSummary(c)}</strong></p>
          <p style={{ margin: "4px 0", fontSize: "17px" }}>Reason: {c.reason}</p>
          <p style={{ margin: "4px 0", fontSize: "15px", color: colors.inkSoft }}>
            Checked out {new Date(c.checked_out_at).toLocaleString("en-GB")} by {c.checked_out_by_profile?.display_name || "—"}
          </p>
        </div>

        {error && <p style={{ color: colors.immediate }}>{error}</p>}

        <button style={kioskButtonStyle} onClick={handleConfirm} disabled={submitting}>
          {submitting ? "Checking in…" : "Confirm check-in"}
        </button>
      </div>
    );
  }

  return (
    <div style={{ padding: "24px", maxWidth: "640px", margin: "0 auto" }}>
      <button style={{ ...kioskSecondaryButtonStyle, width: "auto", padding: "10px 20px", fontSize: "16px", marginBottom: "20px" }} onClick={() => navigate("/keys")}>
        ← Menu
      </button>
      <h1 style={{ fontFamily: fonts.display, color: colors.mossDark, fontSize: "26px", marginTop: 0 }}>Check in a key</h1>
      {error && <p style={{ color: colors.immediate }}>{error}</p>}
      <KeySelector tags={openTags} onPick={pickTag} notFoundMessage="That key isn't currently checked out." />
      {openTags.length === 0 && <p style={{ color: colors.inkSoft }}>No keys are currently checked out.</p>}
    </div>
  );
}
