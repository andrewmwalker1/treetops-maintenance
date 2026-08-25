import { useNavigate } from "react-router-dom";
import { usePermissions } from "../lib/permissions.js";
import { useKeyForceCheckIn } from "../lib/useKeyForceCheckIn.js";
import { issuedToSummary } from "../lib/useKeyCheckin.js";
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

// Same force-check-in logic as the key-cupboard kiosk
// (useKeyForceCheckIn.js), matching CheckInKey.jsx's relationship to
// KeyStationCheckIn.jsx -- can_manage_keys-gated same as the kiosk's own
// version, not open to everyone with can_use_key_system the way ordinary
// check-in is.
export default function ForceCheckInKey() {
  const navigate = useNavigate();
  const permissions = usePermissions();
  const { view, openTags, selected, submitting, error, pickTag, backToSelect, handleConfirm } = useKeyForceCheckIn();

  if (permissions.size > 0 && !permissions.has("can_manage_keys")) {
    return (
      <div style={{ textAlign: "center", padding: "40px 20px" }}>
        <p style={{ fontFamily: fonts.body, fontSize: "15px", color: colors.inkSoft, maxWidth: "360px", margin: "0 auto" }}>
          This account doesn't have access to force a key check-in.
        </p>
      </div>
    );
  }

  if (view === "done") {
    return (
      <div style={{ maxWidth: "560px" }}>
        <h1 style={{ fontFamily: fonts.display, color: colors.mossDark, marginTop: 0 }}>Checked in</h1>
        <p style={{ fontSize: "15px" }}>{locationLabel(selected)} — force checked in.</p>
        <button style={buttonStyle.primary} onClick={() => navigate("/key-register")}>Done</button>
      </div>
    );
  }

  if (view === "confirm") {
    const c = selected.checkout;
    return (
      <div style={{ maxWidth: "560px" }}>
        <button style={{ ...buttonStyle.secondary, marginBottom: "16px" }} onClick={backToSelect}>
          ← Back
        </button>
        <h1 style={{ fontFamily: fonts.display, color: colors.mossDark, marginTop: 0 }}>{locationLabel(selected)}</h1>

        <div style={{ ...cardStyle, padding: "16px", marginBottom: "16px" }}>
          <p style={{ margin: "4px 0", fontSize: "15px" }}>Out to <strong>{issuedToSummary(c)}</strong></p>
          <p style={{ margin: "4px 0", fontSize: "15px" }}>Reason: {c.reason}</p>
          <p style={{ margin: "4px 0", fontSize: "13px", color: colors.inkSoft }}>
            Checked out {new Date(c.checked_out_at).toLocaleString("en-GB")} by {c.checked_out_by_profile?.display_name || "—"}
          </p>
        </div>

        {error && <p style={{ color: colors.immediate }}>{error}</p>}

        <button style={{ ...buttonStyle.primary, width: "100%" }} onClick={handleConfirm} disabled={submitting}>
          {submitting ? "Checking in…" : "Force check-in"}
        </button>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: "560px" }}>
      <button style={{ ...buttonStyle.secondary, marginBottom: "16px" }} onClick={() => navigate("/key-register")}>
        ← Keys
      </button>
      <h1 style={{ fontFamily: fonts.display, color: colors.mossDark, marginTop: 0 }}>Force check-in</h1>
      {error && <p style={{ color: colors.immediate }}>{error}</p>}
      <KeySelector tags={openTags} resultStyle={listButtonStyle} fieldStyle={fieldStyle} onPick={pickTag} notFoundMessage="That key isn't currently checked out." />
      {openTags.length === 0 && <p style={{ color: colors.inkSoft }}>No keys are currently checked out.</p>}
    </div>
  );
}
