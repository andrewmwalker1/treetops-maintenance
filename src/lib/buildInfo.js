// The one "which build is this?" line, shown in the account menu (phone),
// the desktop footer and the kiosk corner -- e.g. "v1.1.0 · 24 Sep 2026,
// 16:32". __APP_VERSION__ is package.json's version (bumped on every
// deploy -- see CLAUDE.md) and __BUILD_TIME__ is when CI built it, shown in
// the device's own timezone. The git hash used to be here too, but it
// meant nothing to the people reading it.
export const BUILD_LABEL = `v${__APP_VERSION__} · ${new Date(__BUILD_TIME__).toLocaleString("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
})}`;
