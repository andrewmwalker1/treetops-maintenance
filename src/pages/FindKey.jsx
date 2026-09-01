import { useNavigate } from "react-router-dom";
import { useKeyLookup, summarizeKeyEvent } from "../lib/useKeyLookup.js";
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

export default function FindKey() {
  const navigate = useNavigate();
  const { keyTags, selectedTag, lastEvent, error, pickTag, backToSelect } = useKeyLookup();

  if (selectedTag) {
    return (
      <div style={{ maxWidth: "560px" }}>
        <button style={{ ...buttonStyle.secondary, marginBottom: "16px" }} onClick={backToSelect}>
          ← Back
        </button>
        <h1 style={{ fontFamily: fonts.display, color: colors.mossDark, marginTop: 0 }}>{locationLabel(selectedTag)}</h1>
        <div style={{ ...cardStyle, padding: "16px" }}>
          {error && <p style={{ color: colors.immediate }}>{error}</p>}
          {selectedTag.isHistorical ? (
            <p style={{ fontSize: "15px", margin: 0 }}>
              Handed over to {selectedTag.handed_over_to || "—"} on {new Date(selectedTag.created_at).toLocaleDateString("en-GB")}.
              {selectedTag.handed_over_notes && <> {selectedTag.handed_over_notes}</>}
              <br />
              <span style={{ color: colors.inkSoft, fontSize: "13px" }}>No RFID tag is currently allocated to this pitch.</span>
            </p>
          ) : (
            <>
              {lastEvent === undefined && !error && <p style={{ color: colors.inkSoft }}>Loading…</p>}
              {lastEvent !== undefined && <p style={{ fontSize: "15px", margin: 0 }}>{summarizeKeyEvent(lastEvent)}</p>}
            </>
          )}
        </div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: "560px" }}>
      <button style={{ ...buttonStyle.secondary, marginBottom: "16px" }} onClick={() => navigate("/key-register")}>
        ← Keys
      </button>
      <h1 style={{ fontFamily: fonts.display, color: colors.mossDark, marginTop: 0 }}>Find a key</h1>
      <KeySelector tags={keyTags} resultStyle={listButtonStyle} fieldStyle={fieldStyle} onPick={pickTag} notFoundMessage="That tag isn't recognised." />
    </div>
  );
}
