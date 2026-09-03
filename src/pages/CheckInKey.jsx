import { useNavigate, useLocation } from "react-router-dom";
import { useKeyCheckin, issuedToSummary } from "../lib/useKeyCheckin.js";
import KeySelector, { locationLabel } from "../keys/KeySelector.jsx";
import { colors, fonts, cardStyle, buttonStyle } from "../lib/theme.js";

// Same key check-in logic as the key-cupboard kiosk (useKeyCheckin.js),
// matching CheckinKit.jsx's relationship to KioskCheckIn.jsx.
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

export default function CheckInKey() {
  const navigate = useNavigate();
  const location = useLocation();
  const { view, openTags, selected, submitting, error, pickTag, backToSelect, handleConfirm } = useKeyCheckin(location.state?.presetTagId);

  if (view === "done") {
    return (
      <div style={{ maxWidth: "560px" }}>
        <h1 style={{ fontFamily: fonts.display, color: colors.mossDark, marginTop: 0 }}>Checked in</h1>
        <p style={{ fontSize: "15px" }}>{locationLabel(selected)} — logged.</p>
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

        {error && (
          <Alert tone="danger" title="Something went wrong">
            {error}
          </Alert>
        )}

        <button style={{ ...buttonStyle.primary, width: "100%" }} onClick={handleConfirm} disabled={submitting}>
          {submitting ? "Checking in…" : "Confirm check-in"}
        </button>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: "560px" }}>
      <button style={{ ...buttonStyle.secondary, marginBottom: "16px" }} onClick={() => navigate("/key-register")}>
        ← Keys
      </button>
      <h1 style={{ fontFamily: fonts.display, color: colors.mossDark, marginTop: 0 }}>Check in a key</h1>
      {error && (
          <Alert tone="danger" title="Something went wrong">
            {error}
          </Alert>
        )}
      <KeySelector size="normal" tags={openTags} onPick={pickTag} notFoundMessage="That key isn't currently checked out." />
      {openTags.length === 0 && <p style={{ color: colors.inkSoft }}>No keys are currently checked out.</p>}
    </div>
  );
}
