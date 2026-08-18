import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../lib/AuthContext.jsx";
import { supabase } from "../lib/supabaseClient.js";
import KeySelector, { locationLabel } from "./KeySelector.jsx";
import { colors, fonts } from "../lib/theme.js";
import { kioskSecondaryButtonStyle, kioskCardStyle } from "../kiosk/kioskTheme.js";

function summarize(event) {
  if (!event) return "No activity recorded for this key yet.";
  const by = event.checked_in_at ? event.checked_in_by_profile?.display_name : event.checked_out_by_profile?.display_name;
  const when = new Date(event.checked_in_at || event.checked_out_at).toLocaleString("en-GB");
  return event.checked_in_at
    ? `Checked in ${when} by ${by || "—"} — currently in the cupboard.`
    : `Checked out ${when} by ${by || "—"} — still out.`;
}

// The non-admin "where's this key" view Andy asked for: shows only the
// single most recent event, not the full history (that's the admin
// activity log, gated can_manage_keys, elsewhere).
export default function KeyStationLookup() {
  const navigate = useNavigate();
  const { activeSite } = useAuth();
  const [keyTags, setKeyTags] = useState([]);
  const [selectedTag, setSelectedTag] = useState(null);
  const [lastEvent, setLastEvent] = useState(undefined); // undefined = loading, null = none
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!activeSite) return;
    supabase
      .from("key_tags")
      .select("id, tag_uid, pitch_id, special_location_id, pitches(pitch_number_or_name), key_special_locations(label)")
      .eq("site_id", activeSite.id)
      .then(({ data }) => setKeyTags((data || []).filter((t) => t.pitch_id || t.special_location_id)));
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

  if (selectedTag) {
    return (
      <div style={{ padding: "24px", maxWidth: "640px", margin: "0 auto" }}>
        <button
          style={{ ...kioskSecondaryButtonStyle, width: "auto", padding: "10px 20px", fontSize: "16px", marginBottom: "20px" }}
          onClick={() => setSelectedTag(null)}
        >
          ← Back
        </button>
        <h1 style={{ fontFamily: fonts.display, color: colors.mossDark, fontSize: "26px", marginTop: 0 }}>{locationLabel(selectedTag)}</h1>
        <div style={kioskCardStyle}>
          {error && <p style={{ color: colors.immediate }}>{error}</p>}
          {lastEvent === undefined && !error && <p style={{ color: colors.inkSoft }}>Loading…</p>}
          {lastEvent !== undefined && <p style={{ fontSize: "17px", margin: 0 }}>{summarize(lastEvent)}</p>}
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: "24px", maxWidth: "640px", margin: "0 auto" }}>
      <button style={{ ...kioskSecondaryButtonStyle, width: "auto", padding: "10px 20px", fontSize: "16px", marginBottom: "20px" }} onClick={() => navigate("/keys")}>
        ← Menu
      </button>
      <h1 style={{ fontFamily: fonts.display, color: colors.mossDark, fontSize: "26px", marginTop: 0 }}>Find a key</h1>
      <KeySelector tags={keyTags} onPick={pickTag} notFoundMessage="That tag isn't recognised." />
    </div>
  );
}
