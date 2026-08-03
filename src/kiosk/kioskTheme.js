// Shared style tokens for the workshop kiosk screens -- reuses the main
// app's colour/font tokens (src/lib/theme.js) but with full-screen layout
// and much larger touch targets, since this is a walk-up touchscreen, not
// a desktop/phone view. Deliberately not using Layout.jsx -- the kiosk has
// no nav, DND toggle, or other normal-user chrome.

import { colors, fonts } from "../lib/theme.js";

export const kioskPageStyle = {
  minHeight: "100vh",
  width: "100%",
  boxSizing: "border-box",
  background: colors.bg,
  color: colors.ink,
  fontFamily: fonts.body,
};

export const kioskButtonStyle = {
  background: colors.moss,
  color: "#FFFFFF",
  border: "none",
  borderRadius: "20px",
  padding: "28px 20px",
  fontFamily: fonts.body,
  fontWeight: 700,
  fontSize: "22px",
  cursor: "pointer",
  width: "100%",
};

export const kioskSecondaryButtonStyle = {
  ...kioskButtonStyle,
  background: "transparent",
  color: colors.mossDark,
  border: `2px solid ${colors.lineStrong}`,
};

export const kioskDangerButtonStyle = {
  ...kioskButtonStyle,
  background: colors.immediate,
};

export const kioskCardStyle = {
  background: colors.paper,
  border: `1px solid ${colors.line}`,
  borderRadius: "20px",
  padding: "20px",
};
