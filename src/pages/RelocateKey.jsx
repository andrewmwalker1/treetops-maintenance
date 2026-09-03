import { useNavigate } from "react-router-dom";
import { usePermissions } from "../lib/permissions.js";
import { useKeyRelocate } from "../lib/useKeyRelocate.js";
import KeySelector, { locationLabel, formatKeyLocation } from "../keys/KeySelector.jsx";
import PitchPicker from "../components/PitchPicker.jsx";
import { colors, fonts, cardStyle, buttonStyle } from "../lib/theme.js";

const listButtonStyle = {
  ...buttonStyle.secondary,
  width: "100%",
  textAlign: "left",
  padding: "14px 16px",
  fontSize: "15px",
};

const fieldStyle = {
  width: "100%",
  boxSizing: "border-box",
  padding: "10px 14px",
  borderRadius: "10px",
  border: `1px solid ${colors.lineStrong}`,
  fontFamily: fonts.body,
  fontSize: "15px",
  marginBottom: "12px",
};

// Same key-relocate logic as the key-cupboard kiosk (useKeyRelocate.js),
// matching CheckInKey.jsx's relationship to KeyStationCheckIn.jsx --
// can_manage_keys-gated same as the kiosk's own version, not open to
// everyone with can_use_key_system.
export default function RelocateKey() {
  const navigate = useNavigate();
  const permissions = usePermissions();
  const {
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
  } = useKeyRelocate();

  if (permissions.size > 0 && !permissions.has("can_manage_keys")) {
    return (
      <div style={{ textAlign: "center", padding: "40px 20px" }}>
        <p style={{ fontFamily: fonts.body, fontSize: "15px", color: colors.inkSoft, maxWidth: "360px", margin: "0 auto" }}>
          This account doesn't have access to relocate keys.
        </p>
      </div>
    );
  }

  if (view === "done") {
    const newLabel = formatKeyLocation(
      pitches.find((p) => p.id === pitchId)?.pitch_number_or_name,
      specialLocations.find((s) => s.id === specialLocationId)?.label
    );
    return (
      <div style={{ maxWidth: "560px" }}>
        <h1 style={{ fontFamily: fonts.display, color: colors.mossDark, marginTop: 0 }}>Relocated</h1>
        <p style={{ fontSize: "15px" }}>Moved to {newLabel}.</p>
        <button style={buttonStyle.primary} onClick={() => navigate("/key-register")}>Done</button>
      </div>
    );
  }

  if (view === "confirm") {
    return (
      <div style={{ maxWidth: "560px" }}>
        <button style={{ ...buttonStyle.secondary, marginBottom: "16px" }} onClick={backToSelect}>
          ← Back
        </button>
        <h1 style={{ fontFamily: fonts.display, color: colors.mossDark, marginTop: 0 }}>{locationLabel(selectedTag)}</h1>

        {openTagIds.has(selectedTag.id) && (
          <div style={{ ...cardStyle, padding: "16px", marginBottom: "16px", borderColor: colors.gold }}>
            <p style={{ margin: 0, fontSize: "14px" }}>
              This key is currently checked out — it could just be out being used to get the caravan ready. Moving it only changes where it normally
              lives; it won't check it in.
            </p>
          </div>
        )}

        <div style={{ ...cardStyle, padding: "16px", marginBottom: "16px" }}>
          <p style={{ fontWeight: 600, marginTop: 0, marginBottom: "4px", fontSize: "14px" }}>Home pitch</p>
          <PitchPicker pitches={pitches} value={pitchId} onChange={setPitchId} style={fieldStyle} />
          <p style={{ fontWeight: 600, marginTop: 0, marginBottom: "4px", fontSize: "14px" }}>Currently at a special location</p>
          <select value={specialLocationId} onChange={(e) => setSpecialLocationId(e.target.value)} style={fieldStyle}>
            <option value="">— in the cupboard at its pitch —</option>
            {specialLocations.map((s) => (
              <option key={s.id} value={s.id}>{s.label}</option>
            ))}
          </select>
        </div>

        {error && (
          <Alert tone="danger" title="Something went wrong">
            {error}
          </Alert>
        )}

        <button style={{ ...buttonStyle.primary, width: "100%", opacity: canSubmit ? 1 : 0.5 }} onClick={handleSubmit} disabled={!canSubmit || submitting}>
          {submitting ? "Saving…" : "Save"}
        </button>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: "560px" }}>
      <button style={{ ...buttonStyle.secondary, marginBottom: "16px" }} onClick={() => navigate("/key-register")}>
        ← Keys
      </button>
      <h1 style={{ fontFamily: fonts.display, color: colors.mossDark, marginTop: 0 }}>Relocate a key</h1>
      <KeySelector size="normal" tags={keyTags} onPick={pickTag} notFoundMessage="That tag isn't recognised." />
    </div>
  );
}
