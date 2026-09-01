import { useState } from "react";
import RfidScanListener from "../components/RfidScanListener.jsx";
import { colors, fonts } from "../lib/theme.js";
import { kioskCardStyle } from "../kiosk/kioskTheme.js";

// A key's home pitch and its current special location (if any) are now
// independent columns (47-key-tags-pitch-persists-through-special-location.sql)
// -- a key can be "for OP-B06" and "currently at Caravan Prep" at once, so
// the label shows both rather than one hiding the other. Exported so
// KeyTagsTab.jsx and the checkout-log helpers (which look these up from
// plain id/array lookups rather than a Supabase join) render identically
// instead of drifting into their own formatting.
export function formatKeyLocation(pitchLabel, specialLabel, fallback = "Unallocated tag") {
  if (specialLabel && pitchLabel) return `${specialLabel} (${pitchLabel})`;
  if (specialLabel) return specialLabel;
  if (pitchLabel) return pitchLabel;
  return fallback;
}

export function locationLabel(tag) {
  return formatKeyLocation(tag.pitches?.pitch_number_or_name, tag.key_special_locations?.label);
}

const searchFieldStyle = {
  width: "100%",
  boxSizing: "border-box",
  padding: "14px 16px",
  borderRadius: "12px",
  border: `2px solid ${colors.lineStrong}`,
  fontFamily: fonts.body,
  fontSize: "18px",
  marginBottom: "16px",
};

// Shared "scan the key, or search for it" picker used by check-out,
// check-in, and find-a-key -- each passes a `tags` list already filtered
// to what's relevant for that action (available / currently out / all)
// and gets back whichever one was picked, scanned or tapped. `resultStyle`
// and `fieldStyle` default to the kiosk's big touch-target look; the in-app
// Keys pages (KeysHome.jsx and friends) pass the normal theme's smaller
// card/field styling instead, same as CheckoutKit.jsx restyling
// useEquipmentCheckout's units list without touching its logic.
export default function KeySelector({ tags, onPick, notFoundMessage, resultStyle, fieldStyle }) {
  const [query, setQuery] = useState("");
  const [scanError, setScanError] = useState(null);

  function handleScan(uid) {
    setScanError(null);
    const tag = tags.find((t) => t.tag_uid === uid);
    if (!tag) {
      setScanError(notFoundMessage || "That tag isn't available for this right now.");
      return;
    }
    onPick(tag);
  }

  const filtered = query.trim()
    ? tags.filter((t) => locationLabel(t).toLowerCase().includes(query.trim().toLowerCase()))
    : tags;

  return (
    <div>
      <RfidScanListener onScan={handleScan} />
      {scanError && <p style={{ color: colors.immediate, fontSize: "16px" }}>{scanError}</p>}
      <p style={{ color: colors.inkSoft, fontSize: "16px" }}>Scan a key, or search for a pitch below.</p>
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search by pitch or location…"
        style={fieldStyle || searchFieldStyle}
      />
      <div style={{ display: "flex", flexDirection: "column", gap: "10px", maxHeight: "50vh", overflowY: "auto" }}>
        {filtered.map((t) => (
          <button
            key={t.id}
            onClick={() => onPick(t)}
            style={{
              ...(resultStyle || kioskCardStyle),
              textAlign: "left",
              fontSize: "17px",
              fontFamily: fonts.body,
              cursor: "pointer",
              border: `1px solid ${colors.line}`,
              width: "100%",
              ...(t.isHistorical ? { opacity: 0.7 } : null),
            }}
          >
            <div>{locationLabel(t)}</div>
            {/* A pitch can have more than one active tag (a spare/duplicate
                key), and now also a handed-over history entry alongside
                them -- all sharing the same pitch label. Andy hit this
                directly: checked OP-E10, saw "handed over" and "still in
                the cupboard" together and read it as one key contradicting
                itself, when they're two different physical keys. This
                subline makes that explicit on every row rather than only
                when it happens to matter. */}
            <div style={{ fontSize: "13px", fontWeight: 400, color: colors.inkSoft, marginTop: "2px" }}>
              {t.isHistorical
                ? `A different key for this pitch was handed over to ${t.handed_over_to || "—"} on ${new Date(t.created_at).toLocaleDateString("en-GB")} — it's gone, no tag on file for it anymore.`
                : `Tag ${t.tag_uid}`}
            </div>
          </button>
        ))}
        {filtered.length === 0 && <p style={{ color: colors.inkSoft }}>Nothing matches.</p>}
      </div>
    </div>
  );
}
