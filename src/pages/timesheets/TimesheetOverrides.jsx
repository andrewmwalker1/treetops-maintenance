// Lives under Office Hub alongside TimesheetsGrid.jsx, not Admin -- the
// override log is something office checks day-to-day (did that
// correction land?), not a settings screen.
import { useCallback, useEffect, useState } from "react";
import { useAuth } from "../../lib/AuthContext.jsx";
import { supabase } from "../../lib/supabaseClient.js";
import { queryTimesheetAuditLog } from "../../lib/timesheetAuditQuery.js";
import { colors } from "../../lib/theme.js";
import { Alert, Card, Chip, EmptyState, Input, PageHeader, Select, SkeletonList, Table } from "../../ui/index.js";

const ACTION_CHIPS = [
  { key: "", label: "All" },
  { key: "insert", label: "Added" },
  { key: "update", label: "Edited" },
  { key: "delete", label: "Deleted" },
  { key: "freeze", label: "Frozen" },
  { key: "unfreeze", label: "Unfrozen" },
];

function formatDateTime(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  return `${d.toLocaleDateString("en-GB")} ${d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}`;
}

// 'update' rows store a {field: {old, new}} diff; 'insert'/'delete' rows
// store the whole affected row instead (there's no "before" to diff
// against for an insert, or "after" for a delete) -- rendered as a short
// summary instead of a field-by-field list.
function formatDetails(action, changes) {
  if (!changes) return null;
  if (action === "update") {
    const entries = Object.entries(changes);
    if (entries.length === 0) return null;
    return entries.map(([field, { old, new: next }]) => `${field}: ${old ?? "—"} → ${next ?? "—"}`).join(", ");
  }
  if (action === "insert" || action === "delete") {
    if (changes.entry_kind === "adjustment") {
      return `Adjustment ${changes.adjustment_hours ?? "—"} hrs for ${changes.work_date} — ${changes.adjustment_reason || ""}`;
    }
    const base = `Morning ${changes.morning_hours ?? "—"}, afternoon ${changes.afternoon_hours ?? "—"} (${changes.work_date})`;
    return changes.notes ? `${base} — ${changes.notes}` : base;
  }
  return null;
}

export default function TimesheetOverrides() {
  const { org } = useAuth();
  const [people, setPeople] = useState([]);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [action, setAction] = useState("");
  const [profileId, setProfileId] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  useEffect(() => {
    if (!org) return;
    supabase.from("profiles").select("id, display_name").eq("org_id", org.id).order("display_name").then(({ data }) => setPeople(data || []));
  }, [org]);

  const refresh = useCallback(() => {
    setLoading(true);
    setError(null);
    queryTimesheetAuditLog({
      action: action || undefined,
      profileId: profileId || undefined,
      from: from ? new Date(from).toISOString() : undefined,
      to: to ? new Date(`${to}T23:59:59.999`).toISOString() : undefined,
    })
      .then(setRows)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [action, profileId, from, to]);

  useEffect(refresh, [refresh]);

  return (
    <div>
      <PageHeader title="Timesheet overrides" level={2} />
      <p style={{ fontSize: "var(--text-sm)", color: colors.inkSoft, marginTop: 0 }}>
        Every change made to a timesheet after its week was frozen, plus every freeze and unfreeze.
      </p>

      <div style={{ display: "flex", gap: "var(--space-2)", flexWrap: "wrap", marginBottom: "var(--space-3)" }}>
        {ACTION_CHIPS.map((a) => (
          <Chip key={a.key} active={action === a.key} onClick={() => setAction(a.key)}>{a.label}</Chip>
        ))}
      </div>

      <div style={{ display: "flex", gap: "var(--space-2)", flexWrap: "wrap", marginBottom: "var(--space-3)" }}>
        <Select value={profileId} onChange={(e) => setProfileId(e.target.value)}>
          <option value="">Everyone</option>
          {people.map((p) => (
            <option key={p.id} value={p.id}>{p.display_name}</option>
          ))}
        </Select>
        <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} title="From date" />
        <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} title="To date" />
      </div>

      {error && <Alert tone="danger" title="Something went wrong">{error}</Alert>}
      {loading && <SkeletonList rows={3} />}
      {!loading && rows.length === 0 && <EmptyState title="No overrides recorded" />}

      {!loading && rows.length > 0 && (
        <Card pad="md" style={{ overflowX: "auto" }}>
          <Table>
            <thead>
              <tr>
                <th>When</th>
                <th>Action</th>
                <th>Week</th>
                <th>Whose timesheet</th>
                <th>Changed by</th>
                <th>Details</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td>{formatDateTime(r.occurred_at)}</td>
                  <td style={{ textTransform: "capitalize" }}>{r.action}</td>
                  <td>{r.week_start}</td>
                  <td>{r.profile?.display_name || "—"}</td>
                  <td>{r.actor?.display_name || "—"}</td>
                  <td style={{ fontSize: "var(--text-xs)", color: colors.inkSoft }}>{formatDetails(r.action, r.field_changes) || "—"}</td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Card>
      )}
    </div>
  );
}
