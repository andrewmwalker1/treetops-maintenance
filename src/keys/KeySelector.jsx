import { useState } from "react";
import RfidScanListener from "../components/RfidScanListener.jsx";
import { colors } from "../lib/theme.js";
import { Alert, Card, EmptyState, Input } from "../ui/index.js";

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

// Shared "scan the key, or search for it" picker used by check-out,
// check-in, and find-a-key -- each passes a `tags` list already filtered
// to what's relevant for that action (available / currently out / all)
// and gets back whichever one was picked, scanned or tapped.
//
// `size` used to be two style-object props (`resultStyle`/`fieldStyle`)
// that every caller had to fill in, which is how the key station and the
// in-app Keys pages ended up with differently-shaped rows for the same
// list. It is one word now: "kiosk" (the default, walk-up touchscreen) or
// "normal" (the phone/desktop pages).
export default function KeySelector({ tags, onPick, notFoundMessage, size = "kiosk" }) {
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
      {scanError && (
        <Alert tone="warn" style={{ marginBottom: "var(--space-3)" }}>
          {scanError}
        </Alert>
      )}
      <p style={{ color: colors.inkSoft }}>Scan a key, or search for a pitch below.</p>
      <Input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search by pitch or location…"
        aria-label="Search by pitch or location"
        className={size === "kiosk" ? "tt-input--kiosk" : undefined}
        style={{ marginBottom: "var(--space-4)" }}
      />
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)", maxHeight: "50vh", overflowY: "auto" }}>
        {filtered.map((t) => (
          <Card
            key={t.id}
            as="button"
            type="button"
            interactive
            pad={size === "kiosk" ? "lg" : "sm"}
            onClick={() => onPick(t)}
            style={{
              textAlign: "left",
              width: "100%",
              font: "inherit",
              fontSize: size === "kiosk" ? "var(--text-md)" : "var(--text-base)",
              color: "inherit",
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
            <div style={{ fontSize: "var(--text-sm)", fontWeight: 400, color: colors.inkSoft, marginTop: "2px" }}>
              {t.isHistorical
                ? `A different key for this pitch was handed over to ${t.handed_over_to || "—"} on ${new Date(t.created_at).toLocaleDateString("en-GB")} — it's gone, no tag on file for it anymore.`
                : `Tag ${t.tag_uid}`}
            </div>
          </Card>
        ))}
        {filtered.length === 0 && <EmptyState title="Nothing matches">Try a different pitch number, or scan the key itself.</EmptyState>}
      </div>
    </div>
  );
}
