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
export const priorityColor = {
  low: colors.moss,
  medium: colors.gold,
  high: colors.clay,
  immediate: colors.immediate,
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
      backgroundImage: `repeating-linear-gradient(45deg, ${colors.immediate}, ${colors.immediate} 4px, #4E1B17 4px, #4E1B17 8px)`,
    };
  }
  return { ...base, background: priorityColor[priority] || colors.moss };
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
