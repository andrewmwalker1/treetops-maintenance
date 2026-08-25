import { useNavigate } from "react-router-dom";
import { usePermissions } from "../lib/permissions.js";
import { useKeyRelocate } from "../lib/useKeyRelocate.js";
import KeySelector, { locationLabel } from "./KeySelector.jsx";
import PitchPicker from "../components/PitchPicker.jsx";
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
  const permissions = usePermissions();
  const {
    view,
    keyTags,
    pitches,
    specialLocations,
    openTagIds,
    selectedTag,
    kind,
    setKind,
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
  } = useKeyRelocate();

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
            <PitchPicker pitches={pitches} value={pitchId} onChange={setPitchId} style={fieldStyle} />
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
