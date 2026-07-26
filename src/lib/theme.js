// Field Journal design tokens — Section 8 of BUILD-BRIEF.md. Reproduced
// exactly; don't hardcode these hex values anywhere else.

export const colors = {
  bg: "#E7E2CC",
  paper: "#FBF9F1",
  ink: "#31382D",
  inkSoft: "#78806E",
  moss: "#5C7A4E",
  mossDark: "#3F5837",
  clay: "#A65A34",
  gold: "#C9962F",
  immediate: "#8C3A22",
  line: "#DDD6BC",
  lineStrong: "#CBC2A0",
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
      backgroundImage: `repeating-linear-gradient(45deg, ${colors.immediate}, ${colors.immediate} 4px, #6b2a18 4px, #6b2a18 8px)`,
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
