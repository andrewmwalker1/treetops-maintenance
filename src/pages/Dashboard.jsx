import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../lib/AuthContext.jsx";
import { usePermissions } from "../lib/permissions.js";
import { supabase } from "../lib/supabaseClient.js";
import { queryJobs } from "../lib/jobsQuery.js";
import { exportJobsCsv } from "../lib/csvExport.js";
import { queryOpenKeyCheckouts, keyLocationLabel, keyIssuedToLabel, timeAgo, KEY_GROUPS } from "../lib/keysOutSummary.js";
import { colors, fonts, cardStyle, buttonStyle, priorityColor } from "../lib/theme.js";

export default function Dashboard() {
  const { org, profile, activeSite } = useAuth();
  const permissions = usePermissions();
  const navigate = useNavigate();
  const [jobs, setJobs] = useState([]);
  const [faultyCount, setFaultyCount] = useState(0);
  const [openKeyCheckouts, setOpenKeyCheckouts] = useState([]);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!activeSite) return;
    queryJobs(activeSite.id, {}).then(setJobs).catch((err) => setError(err.message));
  }, [activeSite]);

  useEffect(() => {
    if (!org) return;
    supabase
      .from("equipment")
      .select("id", { count: "exact", head: true })
      .eq("org_id", org.id)
      .eq("status", "faulty")
      .then(({ count }) => setFaultyCount(count || 0));
  }, [org]);

  useEffect(() => {
    if (!activeSite || !permissions.has("can_use_key_system")) return;
    queryOpenKeyCheckouts(activeSite.id).then(setOpenKeyCheckouts);
  }, [activeSite, permissions]);

  const openJobs = jobs.filter((j) => !j.job_status?.is_completed);
  const byPriority = ["immediate", "high", "medium", "low"].map((p) => ({
    priority: p,
    count: openJobs.filter((j) => j.priority === p).length,
  }));
  const overdue = openJobs.filter((j) => j.due_date && new Date(j.due_date) < new Date());

  async function handleExport() {
    setExporting(true);
    setError(null);
    try {
      await exportJobsCsv({ orgId: org.id, siteId: activeSite.id, profileId: profile.id, filters: {} });
    } catch (err) {
      setError(err.message);
    } finally {
      setExporting(false);
    }
  }

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
        <h1 style={{ fontFamily: fonts.display, color: colors.mossDark, margin: 0 }}>Dashboard</h1>
        {permissions.has("can_export_jobs") && (
          <button onClick={handleExport} disabled={exporting} style={buttonStyle.secondary}>
            {exporting ? "Exporting…" : "Export CSV"}
          </button>
        )}
      </div>

      {error && <p style={{ color: colors.immediate }}>{error}</p>}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: "12px", marginBottom: "20px" }}>
        <StatDial label="Open jobs" value={openJobs.length} onClick={() => navigate("/?open=1")} />
        <StatDial
          label="Overdue"
          value={overdue.length}
          color={overdue.length ? colors.immediate : colors.moss}
          onClick={() => navigate("/?overdue=1")}
        />
        {byPriority.map((p) => (
          <StatDial
            key={p.priority}
            label={p.priority}
            value={p.count}
            color={priorityColor[p.priority]}
            onClick={() => navigate(`/?priority=${p.priority}`)}
          />
        ))}
        <StatDial
          label="Faulty equipment"
          value={faultyCount}
          color={faultyCount ? colors.immediate : colors.moss}
          onClick={() => navigate("/equipment?status=faulty")}
        />
      </div>

      {permissions.has("can_use_key_system") && <KeysOutStrip checkouts={openKeyCheckouts} />}
    </div>
  );
}

// Andy's ask: a strip across the bottom of the Dashboard so staff can see
// at a glance who currently has a key out, without digging into the
// admin-only Key Activity Log. Grouping/label helpers live in
// keysOutSummary.js, shared with the key station's own menu screen.
function KeysOutStrip({ checkouts }) {
  return (
    <div style={{ marginTop: "24px" }}>
      <h2 style={{ fontFamily: fonts.display, color: colors.mossDark, fontSize: "16px", marginBottom: "10px" }}>Keys currently out</h2>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "12px" }}>
        {KEY_GROUPS.map((g) => {
          const rows = checkouts.filter(g.match);
          return (
            <div key={g.key} style={{ ...cardStyle, padding: "14px 16px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: "8px" }}>
                <span style={{ fontWeight: 600, fontSize: "14px" }}>{g.label}</span>
                <span style={{ fontFamily: fonts.mono, fontSize: "13px", color: colors.inkSoft }}>{rows.length}</span>
              </div>
              {rows.length === 0 && <p style={{ margin: 0, fontSize: "13px", color: colors.inkSoft }}>None out.</p>}
              {rows.map((c) => (
                <div key={c.id} style={{ fontSize: "13px", padding: "4px 0", borderTop: `1px solid ${colors.line}` }}>
                  <span style={{ fontWeight: 600 }}>{keyLocationLabel(c)}</span> — {keyIssuedToLabel(c)}
                  <span style={{ color: colors.inkSoft }}> · {timeAgo(c.checked_out_at)}</span>
                </div>
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Gauge geometry: 270° sweep with a 90° gap centred at the bottom, drawn
// clockwise starting at 135° (lower-left) through 12 o'clock to 405°/45°
// (lower-right) -- the standard instrument-dial layout. cx/cy/r are tuned
// so every point on the sweep (including the low corners at 135°/45°,
// which sit lower than the top of the arc) stays inside the viewBox.
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

function StatDial({ label, value, color = colors.mossDark, onClick }) {
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
