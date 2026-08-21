// Field Journal design tokens — Section 8 of BUILD-BRIEF.md. Reproduced
// exactly; don't hardcode these hex values anywhere else.

// Admiralty colourway — chart-paper navy, swapped in in place of the
// original Field Journal moss/clay/gold palette. Same token names so
// every consumer (priorityColor, statusColor, cardStyle, etc. below)
// keeps working unchanged; only the hex values moved.
export const colors = {
  bg: "#E4E7EC",
  paper: "#FAFBFC",
  ink: "#1B2430",
  inkSoft: "#64707D",
  moss: "#1F3B5C",
  mossDark: "#142840",
  clay: "#5C6670",
  gold: "#A9862F",
  immediate: "#7A2E28",
  line: "#D4D9DF",
  lineStrong: "#B9C1CA",
};

export const fonts = {
  display: "'Lora', serif",
  body: "'Work Sans', sans-serif",
  mono: "'IBM Plex Mono', monospace",
};

// Priority indicator: a solid rounded colour bar, not an icon badge
// (explicitly rejected an earlier icon-based version — see Section 8).
// Deliberately its own palette, not aliased to colors.moss/gold/clay/immediate
// above -- those are shared brand/status/danger tokens, and reusing them here
// is what made the bar hard to read (grey read as "muted", navy as "the
// important one", rather than escalating low -> immediate). Andy confirmed
// this recolour (2026-08-21) after comparing it against the muted original
// in a mockup.
export const priorityColor = {
  low: "#1B7A4D",
  medium: "#C68A00",
  high: "#C2571A",
  immediate: "#C62828",
};

export const statusColor = {
  Open: colors.gold,
  "In Progress": colors.clay,
  Completed: colors.moss,
};

export function priorityBarStyle(priority) {
  const base = {
    width: "6px",
    borderRadius: "999px",
    alignSelf: "stretch",
    flexShrink: 0,
  };
  if (priority === "immediate") {
    return {
      ...base,
      backgroundImage: `repeating-linear-gradient(45deg, ${priorityColor.immediate}, ${priorityColor.immediate} 4px, #7A1710 4px, #7A1710 8px)`,
    };
  }
  return { ...base, background: priorityColor[priority] || priorityColor.low };
}

export function statusPillStyle(statusName) {
  return {
    display: "inline-block",
    padding: "3px 12px",
    borderRadius: "999px",
    background: statusColor[statusName] || colors.inkSoft,
    color: "#FFFFFF",
    fontFamily: fonts.body,
    fontSize: "12px",
    fontWeight: 600,
    whiteSpace: "nowrap",
  };
}

export const pageStyle = {
  minHeight: "100vh",
  background: colors.bg,
  color: colors.ink,
  fontFamily: fonts.body,
};

export const cardStyle = {
  background: colors.paper,
  border: `1px solid ${colors.line}`,
  borderRadius: "16px",
};

export const buttonStyle = {
  primary: {
    background: colors.moss,
    color: "#FFFFFF",
    border: "none",
    borderRadius: "999px",
    padding: "10px 20px",
    fontFamily: fonts.body,
    fontWeight: 600,
    cursor: "pointer",
  },
  secondary: {
    background: "transparent",
    color: colors.mossDark,
    border: `1px solid ${colors.lineStrong}`,
    borderRadius: "999px",
    padding: "10px 20px",
    fontFamily: fonts.body,
    fontWeight: 600,
    cursor: "pointer",
  },
};
