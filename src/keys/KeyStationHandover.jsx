import { useNavigate } from "react-router-dom";
import { usePermissions } from "../lib/permissions.js";
import { useKeyHandover } from "../lib/useKeyHandover.js";
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

// can_manage_keys-gated, same as Relocate/Force check-in -- lets someone
// like Sam complete a handover from the key station itself instead of
// walking it to Admin ▸ Key Tags on a desktop (Andy, 2026-08-28: that
// wasn't holding up in real use).
export default function KeyStationHandover() {
  const navigate = useNavigate();
  const permissions = usePermissions();
  const {
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
  } = useKeyHandover();

  if (permissions.size > 0 && !permissions.has("can_manage_keys")) {
    return (
      <div style={{ padding: "24px", maxWidth: "640px", margin: "0 auto" }}>
        <p style={{ color: colors.inkSoft, fontSize: "17px" }}>This account doesn't have access to hand over keys.</p>
        <button style={kioskSecondaryButtonStyle} onClick={() => navigate("/keys")}>← Menu</button>
      </div>
    );
  }

  if (view === "done") {
    return (
      <div style={{ padding: "24px", maxWidth: "640px", margin: "0 auto" }}>
        <h1 style={{ fontFamily: fonts.display, color: colors.mossDark, fontSize: "26px", marginTop: 0 }}>Handed over</h1>
        <p style={{ fontSize: "18px" }}>{locationLabel(selectedTag)} — handed over to {handoverTo.trim()}.</p>
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

        <div style={{ ...kioskCardStyle, marginBottom: "16px" }}>
          <p style={{ margin: 0, fontSize: "15px" }}>
            This key is leaving for good, to the new owner — it'll drop off every checkout/relocate screen and won't come back into the cupboard.
          </p>
          {openTagIds.has(selectedTag.id) && (
            <p style={{ margin: "10px 0 0", fontSize: "15px" }}>
              This key is currently checked out — completing the handover will automatically check it back in, since it's not coming back.
            </p>
          )}
        </div>

        <label style={{ fontWeight: 600, display: "block", marginBottom: "6px" }}>Handed over to</label>
        <input
          type="text"
          required
          autoFocus
          value={handoverTo}
          onChange={(e) => setHandoverTo(e.target.value)}
          placeholder="Customer name"
          style={fieldStyle}
        />
        <label style={{ fontWeight: 600, display: "block", marginBottom: "6px" }}>Notes (optional)</label>
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} style={{ ...fieldStyle, resize: "vertical" }} />

        <label
          style={{
            display: "flex",
            alignItems: "flex-start",
            gap: "10px",
            fontSize: "15px",
            padding: "12px 14px",
            marginBottom: "16px",
            borderRadius: "10px",
            border: `1px solid ${colors.gold}`,
            background: colors.paper,
          }}
        >
          <input
            type="checkbox"
            checked={fobConfirmed}
            onChange={(e) => setFobConfirmed(e.target.checked)}
            style={{ width: "22px", height: "22px", marginTop: "1px" }}
          />
          I've removed the RFID fob from this key — only the physical key goes to the customer, the fob stays with us.
        </label>

        {error && <p style={{ color: colors.immediate }}>{error}</p>}

        <button style={{ ...kioskButtonStyle, opacity: canSubmit ? 1 : 0.5 }} onClick={handleSubmit} disabled={!canSubmit || submitting}>
          {submitting ? "Handing over…" : "Complete handover"}
        </button>
      </div>
    );
  }

  return (
    <div style={{ padding: "24px", maxWidth: "640px", margin: "0 auto" }}>
      <button style={{ ...kioskSecondaryButtonStyle, width: "auto", padding: "10px 20px", fontSize: "16px", marginBottom: "20px" }} onClick={() => navigate("/keys")}>
        ← Menu
      </button>
      <h1 style={{ fontFamily: fonts.display, color: colors.mossDark, fontSize: "26px", marginTop: 0 }}>Handover a key</h1>
      <KeySelector tags={keyTags} onPick={pickTag} notFoundMessage="That tag isn't recognised, or has no home pitch yet." />
      {keyTags.length === 0 && <p style={{ color: colors.inkSoft }}>No keys are currently eligible for handover.</p>}
    </div>
  );
}
