import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../lib/AuthContext.jsx";
import { usePermissions } from "../lib/permissions.js";
import { supabase } from "../lib/supabaseClient.js";
import { queryJobs } from "../lib/jobsQuery.js";
import { exportJobsCsv } from "../lib/csvExport.js";
import { queryOpenKeyCheckouts, keyLocationLabel, keyIssuedToLabel, timeAgo, KEY_GROUPS } from "../lib/keysOutSummary.js";
import StatDial from "../components/StatDial.jsx";
import { colors, fonts, priorityColor } from "../lib/theme.js";
import { Alert, Button, Card, PageHeader } from "../ui/index.js";

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
      <PageHeader
        title="Dashboard"
        actions={
          permissions.has("can_export_jobs") ? (
            <Button onClick={handleExport} loading={exporting}>
              {exporting ? "Exporting…" : "Export CSV"}
            </Button>
          ) : null
        }
      />

      {error && (
        <Alert tone="danger" title="Something went wrong">
          {error}
        </Alert>
      )}

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
          gap: "var(--space-3)",
          marginBottom: "var(--space-5)",
        }}
      >
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
    <div style={{ marginTop: "var(--space-6)" }}>
      <PageHeader title="Keys currently out" level={2} />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "var(--space-3)" }}>
        {KEY_GROUPS.map((g) => {
          const rows = checkouts.filter(g.match);
          return (
            <Card key={g.key} pad="sm">
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "baseline",
                  marginBottom: "var(--space-2)",
                }}
              >
                <span style={{ fontWeight: 600, fontSize: "var(--text-base)" }}>{g.label}</span>
                <span style={{ fontFamily: fonts.mono, fontSize: "var(--text-sm)", color: colors.inkSoft }}>{rows.length}</span>
              </div>
              {rows.length === 0 && <p style={{ margin: 0, fontSize: "var(--text-sm)", color: colors.inkSoft }}>None out.</p>}
              {rows.map((c) => (
                <div
                  key={c.id}
                  style={{ fontSize: "var(--text-sm)", padding: "var(--space-1) 0", borderTop: `1px solid ${colors.line}` }}
                >
                  <span style={{ fontWeight: 600 }}>{keyLocationLabel(c)}</span> — {keyIssuedToLabel(c)}
                  <span style={{ color: colors.inkSoft }}> · {timeAgo(c.checked_out_at)}</span>
                </div>
              ))}
            </Card>
          );
        })}
      </div>
    </div>
  );
}
