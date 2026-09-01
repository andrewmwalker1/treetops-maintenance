import { useNavigate } from "react-router-dom";
import { useKeyLookup, summarizeKeyEvent } from "../lib/useKeyLookup.js";
import KeySelector, { locationLabel } from "./KeySelector.jsx";
import { colors, fonts } from "../lib/theme.js";
import { kioskSecondaryButtonStyle, kioskCardStyle } from "../kiosk/kioskTheme.js";

// The non-admin "where's this key" view Andy asked for: shows only the
// single most recent event, not the full history (that's the admin
// activity log, gated can_manage_keys, elsewhere).
export default function KeyStationLookup() {
  const navigate = useNavigate();
  const { keyTags, selectedTag, lastEvent, error, pickTag, backToSelect } = useKeyLookup();

  if (selectedTag) {
    return (
      <div style={{ padding: "24px", maxWidth: "640px", margin: "0 auto" }}>
        <button
          style={{ ...kioskSecondaryButtonStyle, width: "auto", padding: "10px 20px", fontSize: "16px", marginBottom: "20px" }}
          onClick={backToSelect}
        >
          ← Back
        </button>
        <h1 style={{ fontFamily: fonts.display, color: colors.mossDark, fontSize: "26px", marginTop: 0 }}>{locationLabel(selectedTag)}</h1>
        <div style={kioskCardStyle}>
          {error && <p style={{ color: colors.immediate }}>{error}</p>}
          {selectedTag.isHistorical ? (
            <p style={{ fontSize: "17px", margin: 0 }}>
              Handed over to {selectedTag.handed_over_to || "—"} on {new Date(selectedTag.created_at).toLocaleDateString("en-GB")}.
              {selectedTag.handed_over_notes && <> {selectedTag.handed_over_notes}</>}
              <br />
              <span style={{ color: colors.inkSoft, fontSize: "14px" }}>No RFID tag is currently allocated to this pitch.</span>
            </p>
          ) : (
            <>
              {lastEvent === undefined && !error && <p style={{ color: colors.inkSoft }}>Loading…</p>}
              {lastEvent !== undefined && <p style={{ fontSize: "17px", margin: 0 }}>{summarizeKeyEvent(lastEvent)}</p>}
            </>
          )}
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
