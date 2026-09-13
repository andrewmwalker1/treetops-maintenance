// Own holiday requests -- pending/approved/declined -- with withdraw on
// still-pending ones. RLS's own delete policy (profile_id = auth.uid()
// and status = 'pending') is what actually enforces this; the UI just
// hides the button once it wouldn't work anyway.
import { useEffect, useState } from "react";
import { useAuth } from "../../lib/AuthContext.jsx";
import { getMyHolidayRequests, withdrawHolidayRequest } from "../../lib/holidayQueries.js";
import { formatShortDate } from "../timesheets/weekMath.js";
import { colors } from "../../lib/theme.js";
import { Alert, Button, Card, EmptyState, PageHeader, SkeletonList } from "../../ui/index.js";

const STATUS_COLOR = { pending: colors.warnInk, approved: colors.okInk, declined: colors.dangerInk };

function RequestCard({ request, onWithdraw, withdrawing }) {
  const days = [...request.days].sort((a, b) => a.work_date.localeCompare(b.work_date));
  const totalHours = days.reduce((sum, d) => sum + Number(d.requested_hours || 0), 0);
  const dateRange = days.length
    ? days.length === 1
      ? formatShortDate(days[0].work_date)
      : `${formatShortDate(days[0].work_date)} – ${formatShortDate(days[days.length - 1].work_date)}`
    : "";

  return (
    <Card pad="sm" style={{ marginBottom: "var(--space-2)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "var(--space-2)" }}>
        <div>
          <div style={{ fontWeight: 600 }}>{dateRange}</div>
          <div style={{ fontSize: "var(--text-xs)", color: colors.inkSoft }}>
            {days.length} day{days.length === 1 ? "" : "s"} — {totalHours} hrs
          </div>
          {request.status === "declined" && request.decline_reason && (
            <div style={{ fontSize: "var(--text-xs)", color: colors.dangerInk, marginTop: 4 }}>{request.decline_reason}</div>
          )}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", flexShrink: 0 }}>
          <span style={{ fontSize: "var(--text-xs)", fontWeight: 600, textTransform: "capitalize", color: STATUS_COLOR[request.status] }}>
            {request.status}
          </span>
          {request.status === "pending" && (
            <Button variant="danger" disabled={withdrawing} onClick={() => onWithdraw(request.id)}>
              Withdraw
            </Button>
          )}
        </div>
      </div>
    </Card>
  );
}

export default function MyRequests() {
  const { profile } = useAuth();
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [withdrawingId, setWithdrawingId] = useState(null);

  function refresh() {
    if (!profile) return;
    getMyHolidayRequests(profile.id)
      .then(setRequests)
      .catch((err) => setError(err.message || String(err)))
      .finally(() => setLoading(false));
  }

  useEffect(refresh, [profile]);

  async function handleWithdraw(id) {
    if (!window.confirm("Withdraw this holiday request?")) return;
    setWithdrawingId(id);
    setError("");
    try {
      await withdrawHolidayRequest(id);
      refresh();
    } catch (err) {
      setError(err.message || String(err));
    } finally {
      setWithdrawingId(null);
    }
  }

  if (loading) return <SkeletonList rows={2} height={60} />;

  return (
    <div>
      <PageHeader title="My requests" level={2} />
      {error && <Alert tone="danger" title="Something went wrong">{error}</Alert>}
      {requests.length === 0 ? (
        <EmptyState title="No holiday requests yet" />
      ) : (
        requests.map((r) => (
          <RequestCard key={r.id} request={r} onWithdraw={handleWithdraw} withdrawing={withdrawingId === r.id} />
        ))
      )}
    </div>
  );
}
