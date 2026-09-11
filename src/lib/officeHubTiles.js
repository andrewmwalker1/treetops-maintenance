// The curated palette and icon set an admin picks from when creating an
// Office Hub link/document tile (see 66-office-hub-tile-style.sql) --
// shared between the admin form (OfficeHubTab.jsx) and the personal
// dashboard's tile grid (OfficeHub.jsx) so both read the same keys the
// same way. A row's `color` column stores the `key` below, never a raw
// hex value -- the actual colour lives once, in tokens.css.

export const TILE_COLORS = [
  { key: "navy", label: "Navy", value: "var(--c-moss)" },
  { key: "gold", label: "Gold", value: "var(--c-gold)" },
  { key: "teal", label: "Teal", value: "var(--c-tile-teal)" },
  { key: "plum", label: "Plum", value: "var(--c-tile-plum)" },
  { key: "rust", label: "Rust", value: "var(--c-tile-rust)" },
  { key: "slate", label: "Slate", value: "var(--c-tile-slate)" },
  { key: "olive", label: "Olive", value: "var(--c-tile-olive)" },
  { key: "violet", label: "Violet", value: "var(--c-tile-violet)" },
];

export function tileColorValue(key) {
  return TILE_COLORS.find((c) => c.key === key)?.value || TILE_COLORS[0].value;
}

// A fixed set, not a free-text emoji field or upload -- keeps every
// tile visually consistent instead of whatever an admin happens to
// paste in. 🔗/📄 are the schema defaults for links/documents.
export const TILE_ICONS = ["🔗", "📄", "🏠", "🔧", "📅", "👥", "🗺", "🛡", "📋", "🔥", "📞", "✉️", "💷", "🗂", "🚗", "🧰", "🌿", "⚙️"];
