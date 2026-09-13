// Pending requests awaiting the current user's decision -- RLS on
// holiday_requests already scopes the select to rows this caller may act
// on (can_manage_timesheets sees everyone's; a can_approve_holiday holder
// sees only the ones that resolve to them via group or override), so no
// extra filtering happens here beyond status = 'pending'. Mounted in two
// places (HolidayHome.jsx's own tab, and Office Hub) -- this same
// component, unchanged, both times.
import { useEffect, useState } from "react";
import { approveHolidayRequest, declineHolidayRequest, getPendingApprovals } from "../../lib/holidayQueries.js";
import { formatShortDate } from "../timesheets/weekMath.js";
import { colors } from "../../lib/theme.js";
import { Alert, Button, Card, EmptyState, Input, PageHeader, SkeletonList } from "../../ui/index.js";

function ApprovalCard({ request, onApprove, onDecline, busy }) {
  const [declining, setDeclining] = useState(false);
  const [reason, setReason] = useState("");
  const days = [...request.days].sort((a, b) => a.work_date.localeCompare(b.work_date));
  const totalHours = days.reduce((sum, d) => sum + Number(d.requested_hours || 0), 0);

  return (
    <Card pad="sm" style={{ marginBottom: "var(--space-2)" }}>
      <div style={{ fontWeight: 600 }}>{request.requester?.display_name}</div>
      <div style={{ fontSize: "var(--text-xs)", color: colors.inkSoft, marginBottom: 8 }}>
        {days.length} day{days.length === 1 ? "" : "s"} — {totalHours} hrs
      </div>
      {days.map((d) => (
        <div key={d.id} style={{ fontSize: "var(--text-sm)", padding: "2px 0" }}>
          {formatShortDate(d.work_date)} — {d.requested_hours} hrs{d.note ? ` — ${d.note}` : ""}
        </div>
      ))}
      {declining ? (
        <div style={{ marginTop: 10 }}>
          <Input placeholder="Reason (optional)" value={reason} onChange={(e) => setReason(e.target.value)} style={{ marginBottom: 8 }} />
          <div style={{ display: "flex", gap: 8 }}>
            <Button onClick={() => setDeclining(false)} disabled={busy}>Cancel</Button>
            <Button variant="danger" disabled={busy} onClick={() => onDecline(request.id, reason)}>Confirm decline</Button>
          </div>
        </div>
      ) : (
        <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
          <Button variant="danger" disabled={busy} onClick={() => setDeclining(true)}>Decline</Button>
          <Button variant="primary" disabled={busy} onClick={() => onApprove(request.id)}>Approve</Button>
        </div>
      )}
    </Card>
  );
}

export default function ApprovalsInbox() {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState(null);

  function refresh() {
    getPendingApprovals()
      .then(setRequests)
      .catch((err) => setError(err.message || String(err)))
      .finally(() => setLoading(false));
  }

  useEffect(refresh, []);

  async function handleApprove(id) {
    setBusyId(id);
    setError("");
    try {
      await approveHolidayRequest(id);
      refresh();
    } catch (err) {
      setError(err.message || String(err));
    } finally {
      setBusyId(null);
    }
  }

  async function handleDecline(id, reason) {
    setBusyId(id);
    setError("");
    try {
      await declineHolidayRequest(id, reason);
      refresh();
    } catch (err) {
      setError(err.message || String(err));
    } finally {
      setBusyId(null);
    }
  }

  if (loading) return <SkeletonList rows={2} height={80} />;

  return (
    <div>
      <PageHeader title="Approvals" level={2} />
      {error && <Alert tone="danger" title="Something went wrong">{error}</Alert>}
      {requests.length === 0 ? (
        <EmptyState title="No pending requests" />
      ) : (
        requests.map((r) => (
          <ApprovalCard key={r.id} request={r} onApprove={handleApprove} onDecline={handleDecline} busy={busyId === r.id} />
        ))
      )}
    </div>
  );
}
