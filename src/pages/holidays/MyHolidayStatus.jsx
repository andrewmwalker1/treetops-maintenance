// Entitlement/accrued/taken/remaining, in hours -- plus a days-equivalent
// line whenever has_fixed_entitlement is set (not narrowed to a standard
// 5-day pattern only -- Jayne's own "25.6 days" figure is exactly the
// kind of thing this should show her too). Days-equivalent divides by the
// ORG baseline daily hours, not the person's own -- that's what makes
// Jayne's 32/35 * 28 = 25.6 days work out, not a per-person conversion.
import { useEffect, useState } from "react";
import { useAuth } from "../../lib/AuthContext.jsx";
import { getHolidaySettings, getHolidayStatus, getStaffTimeProfile } from "../../lib/holidayQueries.js";
import { colors } from "../../lib/theme.js";
import { Alert, Card, PageHeader, SkeletonList } from "../../ui/index.js";

function StatBlock({ label, value }) {
  return (
    <div style={{ textAlign: "center" }}>
      <div style={{ fontSize: "var(--text-2xl)", fontWeight: 700, color: colors.mossDark }}>{value}</div>
      <div style={{ fontSize: "var(--text-xs)", color: colors.inkSoft }}>{label}</div>
    </div>
  );
}

export default function MyHolidayStatus() {
  const { profile } = useAuth();
  const [status, setStatus] = useState(null);
  const [timeProfile, setTimeProfile] = useState(null);
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!profile) return;
    Promise.all([getHolidayStatus(profile.id), getStaffTimeProfile(profile.id), getHolidaySettings()])
      .then(([s, tp, hs]) => {
        setStatus(s);
        setTimeProfile(tp);
        setSettings(hs);
      })
      .catch((err) => setError(err.message || String(err)))
      .finally(() => setLoading(false));
  }, [profile]);

  if (loading) return <SkeletonList rows={1} height={90} />;
  if (error) return <Alert tone="danger" title="Something went wrong">{error}</Alert>;

  if (!timeProfile) {
    return (
      <Alert tone="info" title="Not set up yet">
        Your work pattern hasn't been configured yet — ask the office to set this up before you can book holiday.
      </Alert>
    );
  }

  const toDays = (hours) => (Number(hours) / Number(settings.baseline_daily_hours)).toFixed(1);
  const showDays = timeProfile.has_fixed_entitlement && settings;

  return (
    <Card pad="md" style={{ marginBottom: "var(--space-4)" }}>
      <PageHeader title="My holiday" level={2} />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "var(--space-3)" }}>
        <StatBlock label="Entitlement (hrs)" value={Number(status.entitlement_hours).toFixed(1)} />
        <StatBlock label="Accrued so far" value={Number(status.accrued_hours).toFixed(1)} />
        <StatBlock label="Taken" value={Number(status.taken_hours).toFixed(1)} />
        <StatBlock label="Remaining" value={Number(status.remaining_hours).toFixed(1)} />
      </div>
      {showDays && (
        <p style={{ textAlign: "center", fontSize: "var(--text-xs)", color: colors.inkSoft, marginTop: "var(--space-3)", marginBottom: 0 }}>
          Equivalent to {toDays(status.entitlement_hours)} days entitlement, {toDays(status.remaining_hours)} days remaining.
        </p>
      )}
    </Card>
  );
}
