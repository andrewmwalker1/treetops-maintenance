// Design tokens, as JS values for inline `style={{}}` objects.
//
// Every value below is a `var(--…)` reference into src/styles/tokens.css,
// which is now the single source of truth (BUILD-BRIEF.md section 8). The
// export names and shapes are unchanged from before that stylesheet
// existed, deliberately: the app carries ~1,400 inline style objects that
// spread `cardStyle`/`buttonStyle` or read `colors.x`, and all of them keep
// working untouched. New code should prefer the components in src/ui/,
// which style themselves with real CSS classes and so can express hover,
// focus and active states -- something an inline style cannot do at all.
//
// Two callers need literal values rather than `var()`:
//   - anything setting an SVG *presentation attribute* (stroke="…",
//     fill="…"), which does not resolve custom properties -- set those via
//     `style={{ stroke: … }}` instead, as StatDial.jsx does.
//   - the print window (printJobCards.jsx), a separate document these
//     custom properties never reach.
// `rawColors` below exists for those cases.

export const rawColors = {
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

export const colors = {
  bg: "var(--c-bg)",
  paper: "var(--c-paper)",
  ink: "var(--c-ink)",
  inkSoft: "var(--c-ink-soft)",
  moss: "var(--c-moss)",
  mossDark: "var(--c-moss-dark)",
  clay: "var(--c-clay)",
  gold: "var(--c-gold)",
  immediate: "var(--c-immediate)",
  line: "var(--c-line)",
  lineStrong: "var(--c-line-strong)",
  // Added with the token layer -- these were hardcoded per-file before
  // (a leftover moss-green scrim, and two warm-palette alert panels that
  // predate the Admiralty recolour).
  onDark: "var(--c-on-dark)",
  onDarkMuted: "var(--c-on-dark-muted)",
  scrim: "var(--c-scrim)",
  scrimStrong: "var(--c-scrim-strong)",
  surfaceHover: "var(--c-surface-hover)",
  surfaceSunken: "var(--c-surface-sunken)",
  warnSurface: "var(--c-warn-surface)",
  warnBorder: "var(--c-warn-border)",
  warnInk: "var(--c-warn-ink)",
  dangerSurface: "var(--c-danger-surface)",
  dangerBorder: "var(--c-danger-border)",
  dangerInk: "var(--c-danger-ink)",
  okSurface: "var(--c-ok-surface)",
  okBorder: "var(--c-ok-border)",
  okInk: "var(--c-ok-ink)",
};

export const fonts = {
  display: "var(--font-display)",
  body: "var(--font-body)",
  mono: "var(--font-mono)",
};

// The type scale, for inline styles that still need a size directly.
export const text = {
  xs: "var(--text-xs)",
  sm: "var(--text-sm)",
  base: "var(--text-base)",
  md: "var(--text-md)",
  lg: "var(--text-lg)",
  xl: "var(--text-xl)",
  xxl: "var(--text-2xl)",
};

export const space = {
  1: "var(--space-1)",
  2: "var(--space-2)",
  3: "var(--space-3)",
  4: "var(--space-4)",
  5: "var(--space-5)",
  6: "var(--space-6)",
  7: "var(--space-7)",
  8: "var(--space-8)",
};

export const shadow = {
  card: "var(--shadow-card)",
  overlay: "var(--shadow-overlay)",
};

export const radius = {
  sm: "var(--radius-sm)",
  md: "var(--radius-md)",
  full: "var(--radius-full)",
};

// Priority indicator: a solid rounded colour bar, not an icon badge
// (explicitly rejected an earlier icon-based version -- see BUILD-BRIEF.md
// section 8). Deliberately its own palette, not aliased to
// colors.moss/gold/clay/immediate above -- those are shared brand/status/
// danger tokens, and reusing them here is what made the bar hard to read
// (grey read as "muted", navy as "the important one", rather than
// escalating low -> immediate). Andy confirmed this recolour (2026-08-21)
// after comparing it against the muted original in a mockup.
export const priorityColor = {
  low: "var(--c-priority-low)",
  medium: "var(--c-priority-medium)",
  high: "var(--c-priority-high)",
  immediate: "var(--c-priority-immediate)",
};

export const statusColor = {
  Open: colors.gold,
  "In Progress": colors.clay,
  Completed: colors.moss,
};

export function priorityBarStyle(priority) {
  const base = {
    width: "6px",
    borderRadius: radius.full,
    alignSelf: "stretch",
    flexShrink: 0,
  };
  if (priority === "immediate") {
    return {
      ...base,
      backgroundImage:
        "repeating-linear-gradient(45deg, var(--c-priority-immediate), var(--c-priority-immediate) 4px, var(--c-priority-immediate-alt) 4px, var(--c-priority-immediate-alt) 8px)",
    };
  }
  return { ...base, background: priorityColor[priority] || priorityColor.low };
}

export function statusPillStyle(statusName) {
  return {
    display: "inline-block",
    padding: "3px 12px",
    borderRadius: radius.full,
    background: statusColor[statusName] || colors.inkSoft,
    color: colors.onDark,
    fontFamily: fonts.body,
    fontSize: text.xs,
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
  borderRadius: radius.md,
};

export const buttonStyle = {
  primary: {
    background: colors.moss,
    color: colors.onDark,
    border: "none",
    borderRadius: radius.full,
    padding: "10px 20px",
    fontFamily: fonts.body,
    fontWeight: 600,
    cursor: "pointer",
  },
  secondary: {
    background: "transparent",
    color: colors.mossDark,
    border: `1px solid ${colors.lineStrong}`,
    borderRadius: radius.full,
    padding: "10px 20px",
    fontFamily: fonts.body,
    fontWeight: 600,
    cursor: "pointer",
  },
};
