import { useNavigate } from "react-router-dom";
import { usePermissions } from "../lib/permissions.js";
import { useKeyHandover } from "../lib/useKeyHandover.js";
import KeySelector, { locationLabel } from "../keys/KeySelector.jsx";
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

// Same key-handover logic as the key-cupboard kiosk (useKeyHandover.js),
// matching RelocateKey.jsx's relationship to KeyStationRelocate.jsx --
// can_manage_keys-gated same as the kiosk's own version, not open to
// everyone with can_use_key_system.
export default function HandoverKey() {
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
      <div style={{ textAlign: "center", padding: "40px 20px" }}>
        <p style={{ fontFamily: fonts.body, fontSize: "15px", color: colors.inkSoft, maxWidth: "360px", margin: "0 auto" }}>
          This account doesn't have access to hand over keys.
        </p>
      </div>
    );
  }

  if (view === "done") {
    return (
      <div style={{ maxWidth: "560px" }}>
        <h1 style={{ fontFamily: fonts.display, color: colors.mossDark, marginTop: 0 }}>Handed over</h1>
        <p style={{ fontSize: "15px" }}>{locationLabel(selectedTag)} — handed over to {handoverTo.trim()}.</p>
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

        <div style={{ ...cardStyle, padding: "16px", marginBottom: "16px" }}>
          <p style={{ margin: 0, fontSize: "14px" }}>
            This key is leaving for good, to the new owner — it'll drop off every checkout/relocate screen and won't come back into the cupboard.
          </p>
          {openTagIds.has(selectedTag.id) && (
            <p style={{ margin: "8px 0 0", fontSize: "14px" }}>
              This key is currently checked out — completing the handover will automatically check it back in, since it's not coming back.
            </p>
          )}
        </div>

        <label style={{ fontWeight: 600, display: "block", marginBottom: "4px", fontSize: "14px" }}>Handed over to</label>
        <input
          type="text"
          required
          autoFocus
          value={handoverTo}
          onChange={(e) => setHandoverTo(e.target.value)}
          placeholder="Customer name"
          style={fieldStyle}
        />
        <label style={{ fontWeight: 600, display: "block", marginBottom: "4px", fontSize: "14px" }}>Notes (optional)</label>
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} style={{ ...fieldStyle, resize: "vertical" }} />

        <label
          style={{
            display: "flex",
            alignItems: "flex-start",
            gap: "8px",
            fontSize: "13px",
            padding: "10px 12px",
            marginBottom: "14px",
            borderRadius: "8px",
            border: `1px solid ${colors.gold}`,
            background: colors.paper,
          }}
        >
          <input
            type="checkbox"
            checked={fobConfirmed}
            onChange={(e) => setFobConfirmed(e.target.checked)}
            style={{ width: "18px", height: "18px", marginTop: "1px" }}
          />
          I've removed the RFID fob from this key — only the physical key goes to the customer, the fob stays with us.
        </label>

        {error && (
          <Alert tone="danger" title="Something went wrong">
            {error}
          </Alert>
        )}

        <button style={{ ...buttonStyle.primary, width: "100%", opacity: canSubmit ? 1 : 0.5 }} onClick={handleSubmit} disabled={!canSubmit || submitting}>
          {submitting ? "Handing over…" : "Complete handover"}
        </button>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: "560px" }}>
      <button style={{ ...buttonStyle.secondary, marginBottom: "16px" }} onClick={() => navigate("/key-register")}>
        ← Keys
      </button>
      <h1 style={{ fontFamily: fonts.display, color: colors.mossDark, marginTop: 0 }}>Handover a key</h1>
      <KeySelector size="normal" tags={keyTags} onPick={pickTag} notFoundMessage="That tag isn't recognised, or has no home pitch yet." />
      {keyTags.length === 0 && <p style={{ color: colors.inkSoft }}>No keys are currently eligible for handover.</p>}
    </div>
  );
}
