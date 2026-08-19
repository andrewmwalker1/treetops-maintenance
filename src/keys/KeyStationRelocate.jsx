import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../lib/AuthContext.jsx";
import { usePermissions } from "../lib/permissions.js";
import { supabase } from "../lib/supabaseClient.js";
import KeySelector, { locationLabel } from "./KeySelector.jsx";
import { colors, fonts } from "../lib/theme.js";
import { kioskButtonStyle, kioskSecondaryButtonStyle, kioskCardStyle } from "../kiosk/kioskTheme.js";

const fieldStyle = {
  width: "100%",
  boxSizing: "border-box",
  padding: "12px 16px",
  borderRadius: "12px",
  border: `2px solid ${colors.lineStrong}`,
  fontFamily: fonts.body,
  fontSize: "17px",
  marginBottom: "14px",
};

// can_manage_keys-gated (Andy: "selected users only") -- lets someone like
// Sam move a key to a different pitch or special location from the key
// station itself, not just from the desktop Admin > Key Tags "Move"
// button. Writes through the same key_tags table and log_key_tag_event
// trigger, so it shows up in the admin activity log exactly like a
// desktop-initiated move would.
export default function KeyStationRelocate() {
  const navigate = useNavigate();
  const { org, activeSite } = useAuth();
  const permissions = usePermissions();
  const [view, setView] = useState("select"); // select | confirm | done
  const [keyTags, setKeyTags] = useState([]);
  const [pitches, setPitches] = useState([]);
  const [specialLocations, setSpecialLocations] = useState([]);
  const [openTagIds, setOpenTagIds] = useState(new Set());
  const [selectedTag, setSelectedTag] = useState(null);

  const [kind, setKind] = useState("pitch");
  const [pitchId, setPitchId] = useState("");
  const [specialLocationId, setSpecialLocationId] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  function refresh() {
    if (!org || !activeSite) return;
    Promise.all([
      supabase
        .from("key_tags")
        .select("id, tag_uid, pitch_id, special_location_id, status, pitches(pitch_number_or_name), key_special_locations(label)")
        .eq("site_id", activeSite.id),
      supabase.from("pitches").select("id, pitch_number_or_name").eq("site_id", activeSite.id).order("pitch_number_or_name"),
      supabase.from("key_special_locations").select("id, label").eq("site_id", activeSite.id).order("label"),
      supabase.from("key_checkouts").select("key_tag_id").is("checked_in_at", null),
    ]).then(([{ data: kt }, { data: p }, { data: s }, { data: open }]) => {
      setKeyTags((kt || []).filter((t) => (t.pitch_id || t.special_location_id) && t.status !== "lost"));
      setPitches(p || []);
      setSpecialLocations(s || []);
      setOpenTagIds(new Set((open || []).map((o) => o.key_tag_id)));
    });
  }

  useEffect(refresh, [org, activeSite]);

  function pickTag(tag) {
    setError(null);
    setSelectedTag(tag);
    setKind(tag.special_location_id ? "special" : "pitch");
    setPitchId(tag.pitch_id || "");
    setSpecialLocationId(tag.special_location_id || "");
    setView("confirm");
  }

  function backToSelect() {
    setView("select");
    setSelectedTag(null);
    refresh();
  }

  const canSubmit = kind === "pitch" ? Boolean(pitchId) : Boolean(specialLocationId);

  async function handleSubmit() {
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    const { error: err } = await supabase
      .from("key_tags")
      .update({
        pitch_id: kind === "pitch" ? pitchId : null,
        special_location_id: kind === "special" ? specialLocationId : null,
      })
      .eq("id", selectedTag.id);
    setSubmitting(false);
    if (err) {
      setError(err.message);
      return;
    }
    setView("done");
  }

  if (permissions.size > 0 && !permissions.has("can_manage_keys")) {
    return (
      <div style={{ padding: "24px", maxWidth: "640px", margin: "0 auto" }}>
        <p style={{ color: colors.inkSoft, fontSize: "17px" }}>This account doesn't have access to relocate keys.</p>
        <button style={kioskSecondaryButtonStyle} onClick={() => navigate("/keys")}>← Menu</button>
      </div>
    );
  }

  if (view === "done") {
    const newLabel = kind === "pitch" ? pitches.find((p) => p.id === pitchId)?.pitch_number_or_name : specialLocations.find((s) => s.id === specialLocationId)?.label;
    return (
      <div style={{ padding: "24px", maxWidth: "640px", margin: "0 auto" }}>
        <h1 style={{ fontFamily: fonts.display, color: colors.mossDark, fontSize: "26px", marginTop: 0 }}>Relocated</h1>
        <p style={{ fontSize: "18px" }}>Moved to {newLabel}.</p>
        <button style={kioskButtonStyle} onClick={() => navigate("/keys")}>Done</button>
      </div>
    );
  }

  if (view === "confirm") {
    return (
      <div style={{ padding: "24px", maxWidth: "640px", margin: "0 auto" }}>
        <button style={{ ...kioskSecondaryButtonStyle, width: "auto", padding: "10px 20px", fontSize: "16px", marginBottom: "20px" }} onClick={backToSelect}>
          ← Back
        </button>
        <h1 style={{ fontFamily: fonts.display, color: colors.mossDark, fontSize: "26px", marginTop: 0 }}>{locationLabel(selectedTag)}</h1>

        {openTagIds.has(selectedTag.id) && (
          <div style={{ ...kioskCardStyle, marginBottom: "16px", borderColor: colors.gold }}>
            <p style={{ margin: 0, fontSize: "15px" }}>
              This key is currently checked out — it could just be out being used to get the caravan ready. Moving it only changes where it normally
              lives; it won't check it in.
            </p>
          </div>
        )}

        <div style={{ ...kioskCardStyle, marginBottom: "16px" }}>
          <p style={{ fontWeight: 600, marginTop: 0, marginBottom: "10px" }}>Move to…</p>
          <div style={{ display: "flex", gap: "16px", marginBottom: "10px" }}>
            <label style={{ fontSize: "16px", display: "flex", alignItems: "center", gap: "8px" }}>
              <input type="radio" checked={kind === "pitch"} onChange={() => setKind("pitch")} style={{ width: "20px", height: "20px" }} /> Pitch
            </label>
            <label style={{ fontSize: "16px", display: "flex", alignItems: "center", gap: "8px" }}>
              <input type="radio" checked={kind === "special"} onChange={() => setKind("special")} style={{ width: "20px", height: "20px" }} /> Special location
            </label>
          </div>
          {kind === "pitch" ? (
            <select value={pitchId} onChange={(e) => setPitchId(e.target.value)} style={fieldStyle}>
              <option value="">—</option>
              {pitches.map((p) => (
                <option key={p.id} value={p.id}>{p.pitch_number_or_name}</option>
              ))}
            </select>
          ) : (
            <select value={specialLocationId} onChange={(e) => setSpecialLocationId(e.target.value)} style={fieldStyle}>
              <option value="">—</option>
              {specialLocations.map((s) => (
                <option key={s.id} value={s.id}>{s.label}</option>
              ))}
            </select>
          )}
        </div>

        {error && <p style={{ color: colors.immediate }}>{error}</p>}

        <button style={{ ...kioskButtonStyle, opacity: canSubmit ? 1 : 0.5 }} onClick={handleSubmit} disabled={!canSubmit || submitting}>
          {submitting ? "Saving…" : "Save"}
        </button>
      </div>
    );
  }

  return (
    <div style={{ padding: "24px", maxWidth: "640px", margin: "0 auto" }}>
      <button style={{ ...kioskSecondaryButtonStyle, width: "auto", padding: "10px 20px", fontSize: "16px", marginBottom: "20px" }} onClick={() => navigate("/keys")}>
        ← Menu
      </button>
      <h1 style={{ fontFamily: fonts.display, color: colors.mossDark, fontSize: "26px", marginTop: 0 }}>Relocate a key</h1>
      <KeySelector tags={keyTags} onPick={pickTag} notFoundMessage="That tag isn't recognised." />
    </div>
  );
}
