import { useNavigate } from "react-router-dom";
import { usePermissions } from "../lib/permissions.js";
import { useKeyForceCheckIn } from "../lib/useKeyForceCheckIn.js";
import { issuedToSummary } from "../lib/useKeyCheckin.js";
import KeySelector, { locationLabel } from "./KeySelector.jsx";
import { colors, fonts } from "../lib/theme.js";
import { kioskButtonStyle, kioskSecondaryButtonStyle, kioskCardStyle } from "../kiosk/kioskTheme.js";

// A separate, can_manage_keys-gated path from ordinary check-in
// (KeyStationCheckIn.jsx, open to anyone with can_use_key_system) --
// calls admin_force_check_in_key directly, the same RPC the desktop Key
// Activity Log's "Force check-in" button uses, so someone like Sam has
// the same override at the key station itself, not just from the office.
export default function KeyStationForceCheckIn() {
  const navigate = useNavigate();
  const permissions = usePermissions();
  const { view, openTags, selected, submitting, error, pickTag, backToSelect, handleConfirm } = useKeyForceCheckIn();

  if (permissions.size > 0 && !permissions.has("can_manage_keys")) {
    return (
      <div style={{ padding: "24px", maxWidth: "640px", margin: "0 auto" }}>
        <p style={{ color: colors.inkSoft, fontSize: "17px" }}>This account doesn't have access to force a key check-in.</p>
        <button style={kioskSecondaryButtonStyle} onClick={() => navigate("/keys")}>← Menu</button>
      </div>
    );
  }

  if (view === "done") {
    return (
      <div style={{ padding: "24px", maxWidth: "640px", margin: "0 auto" }}>
        <h1 style={{ fontFamily: fonts.display, color: colors.mossDark, fontSize: "26px", marginTop: 0 }}>Checked in</h1>
        <p style={{ fontSize: "18px" }}>{locationLabel(selected)} — force checked in.</p>
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
          {submitting ? "Checking in…" : "Force check-in"}
        </button>
      </div>
    );
  }

  return (
    <div style={{ padding: "24px", maxWidth: "640px", margin: "0 auto" }}>
      <button style={{ ...kioskSecondaryButtonStyle, width: "auto", padding: "10px 20px", fontSize: "16px", marginBottom: "20px" }} onClick={() => navigate("/keys")}>
        ← Menu
      </button>
      <h1 style={{ fontFamily: fonts.display, color: colors.mossDark, fontSize: "26px", marginTop: 0 }}>Force check-in</h1>
      {error && <p style={{ color: colors.immediate }}>{error}</p>}
      <KeySelector tags={openTags} onPick={pickTag} notFoundMessage="That key isn't currently checked out." />
      {openTags.length === 0 && <p style={{ color: colors.inkSoft }}>No keys are currently checked out.</p>}
    </div>
  );
}
