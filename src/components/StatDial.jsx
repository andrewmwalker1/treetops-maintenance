import { colors, fonts, cardStyle } from "../lib/theme.js";

// Gauge geometry: 270° sweep with a 90° gap centred at the bottom, drawn
// clockwise starting at 135° (lower-left) through 12 o'clock to 405°/45°
// (lower-right) -- the standard instrument-dial layout. cx/cy/r are tuned
// so every point on the sweep (including the low corners at 135°/45°,
// which sit lower than the top of the arc) stays inside the viewBox.
//
// Shared by the main Dashboard's stat row and the key station menu's --
// same component, so both read as the same visual language rather than
// two dials that happen to look similar.
const DIAL_CX = 45;
const DIAL_CY = 34;
const DIAL_R = 30;
const DIAL_SWEEP_START = 135;
const DIAL_SWEEP_END = 405;

function polarPoint(cx, cy, r, angleDeg) {
  const rad = (angleDeg * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function dialArcPath(cx, cy, r, startDeg, endDeg) {
  const start = polarPoint(cx, cy, r, startDeg);
  const end = polarPoint(cx, cy, r, endDeg);
  const largeArc = endDeg - startDeg <= 180 ? 0 : 1;
  return `M ${start.x} ${start.y} A ${r} ${r} 0 ${largeArc} 1 ${end.x} ${end.y}`;
}

export default function StatDial({ label, value, color = colors.mossDark, onClick }) {
  const clickable = value > 0 && !!onClick;
  // No fixed ceiling: a typical count reads clearly against a 10-point
  // scale, and anything bigger just scales the gauge to itself so the
  // needle still lands at "full" instead of pinning past the dial.
  const max = Math.max(10, value);
  const fraction = max > 0 ? Math.min(value / max, 1) : 0;
  const valueAngle = DIAL_SWEEP_START + 270 * fraction;
  const needle = polarPoint(DIAL_CX, DIAL_CY, DIAL_R - 6, valueAngle);

  return (
    <div
      onClick={clickable ? onClick : undefined}
      style={{
        ...cardStyle,
        padding: "12px 12px 14px",
        textAlign: "center",
        cursor: clickable ? "pointer" : "default",
      }}
    >
      <svg width="90" height="64" viewBox="0 0 90 64" style={{ display: "block", margin: "0 auto" }}>
        <path
          d={dialArcPath(DIAL_CX, DIAL_CY, DIAL_R, DIAL_SWEEP_START, DIAL_SWEEP_END)}
          fill="none"
          stroke={colors.lineStrong}
          strokeWidth="7"
          strokeLinecap="round"
        />
        {fraction > 0 && (
          <path
            d={dialArcPath(DIAL_CX, DIAL_CY, DIAL_R, DIAL_SWEEP_START, valueAngle)}
            fill="none"
            stroke={color}
            strokeWidth="7"
            strokeLinecap="round"
          />
        )}
        <line x1={DIAL_CX} y1={DIAL_CY} x2={needle.x} y2={needle.y} stroke={colors.ink} strokeWidth="2" strokeLinecap="round" />
        <circle cx={DIAL_CX} cy={DIAL_CY} r="3" fill={colors.ink} />
      </svg>
      <div style={{ fontFamily: fonts.mono, fontSize: "20px", fontWeight: 700, color, marginTop: "-10px" }}>{value}</div>
      <div style={{ fontSize: "12.5px", color: colors.inkSoft, textTransform: "capitalize", marginTop: "1px" }}>{label}</div>
    </div>
  );
}
