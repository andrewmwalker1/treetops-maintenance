import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../lib/AuthContext.jsx";
import { usePermissions } from "../lib/permissions.js";
import { queryJobs } from "../lib/jobsQuery.js";
import { exportJobsCsv } from "../lib/csvExport.js";
import { colors, fonts, cardStyle, buttonStyle, priorityColor } from "../lib/theme.js";

export default function Dashboard() {
  const { org, profile, activeSite } = useAuth();
  const permissions = usePermissions();
  const navigate = useNavigate();
  const [jobs, setJobs] = useState([]);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!activeSite) return;
    queryJobs(activeSite.id, {}).then(setJobs).catch((err) => setError(err.message));
  }, [activeSite]);

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
        <StatTile label="Open jobs" value={openJobs.length} onClick={() => navigate("/?open=1")} />
        <StatTile
          label="Overdue"
          value={overdue.length}
          color={overdue.length ? colors.immediate : colors.moss}
          onClick={() => navigate("/?overdue=1")}
        />
        {byPriority.map((p) => (
          <StatTile
            key={p.priority}
            label={p.priority}
            value={p.count}
            color={priorityColor[p.priority]}
            onClick={() => navigate(`/?priority=${p.priority}`)}
          />
        ))}
      </div>
    </div>
  );
}

function StatTile({ label, value, color = colors.mossDark, onClick }) {
  const clickable = value > 0 && !!onClick;
  return (
    <div
      onClick={clickable ? onClick : undefined}
      style={{
        ...cardStyle,
        padding: "16px",
        cursor: clickable ? "pointer" : "default",
      }}
    >
      <div style={{ fontFamily: fonts.mono, fontSize: "28px", fontWeight: 700, color }}>{value}</div>
      <div style={{ fontSize: "13px", color: colors.inkSoft, textTransform: "capitalize" }}>{label}</div>
    </div>
  );
}
