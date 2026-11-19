// Entitlement/accrued/taken/remaining. Leads with days of the person's
// own working day (src/lib/dayLength.js -- Peter 7 hrs, Jayne 8), to the
// nearest half day, with the exact hours underneath; everything is still
// counted in hours. Falls back to hours alone when no day length can be
// worked out (hours vary and the office hasn't set a typical day).
import { useEffect, useState } from "react";
import { useAuth } from "../../lib/AuthContext.jsx";
import { getHolidaySettings, getHolidayStatus, getMyYearBalance, getStaffTimeProfile, holidayYearStart } from "../../lib/holidayQueries.js";
import { todayIso } from "../timesheets/weekMath.js";
import { formatDays, formatHours, workingDayHours } from "../../lib/dayLength.js";
import { useIsMobile } from "../../lib/useIsMobile.js";
import { colors } from "../../lib/theme.js";
import { Alert, Card, PageHeader, SkeletonList } from "../../ui/index.js";

function StatBlock({ label, hours, dayHours }) {
  const days = formatDays(hours, dayHours);
  return (
    <div style={{ textAlign: "center" }}>
      <div style={{ fontSize: days ? "var(--text-xl)" : "var(--text-2xl)", fontWeight: 700, color: colors.mossDark }}>
        {days || formatHours(hours)}
      </div>
      <div style={{ fontSize: "var(--text-xs)", color: colors.inkSoft }}>{days ? `${formatHours(hours)} hrs` : "hrs"}</div>
      <div style={{ fontSize: "var(--text-xs)", color: colors.inkSoft, fontWeight: 600 }}>{label}</div>
    </div>
  );
}

export default function MyHolidayStatus() {
  const { profile } = useAuth();
  const isMobile = useIsMobile();
  const [status, setStatus] = useState(null);
  const [timeProfile, setTimeProfile] = useState(null);
  const [balance, setBalance] = useState(null); // this year's agreed start: carried/owed
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!profile) return;
    Promise.all([getHolidayStatus(profile.id), getStaffTimeProfile(profile.id), getHolidaySettings()])
      .then(async ([s, tp, hs]) => {
        setStatus(s);
        setTimeProfile(tp);
        setBalance(await getMyYearBalance(profile.id, holidayYearStart(todayIso(), hs?.holiday_year_start_month || 4)));
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

  const dayHours = workingDayHours(timeProfile);

  return (
    <Card pad="md" style={{ marginBottom: "var(--space-4)" }}>
      <PageHeader title="My holiday" level={2} />
      <div style={{ display: "grid", gridTemplateColumns: `repeat(${isMobile ? 2 : 4}, minmax(0, 1fr))`, gap: "var(--space-4) var(--space-3)" }}>
        <StatBlock label="Allowance" hours={status.entitlement_hours} dayHours={dayHours} />
        <StatBlock label="Earned so far" hours={status.accrued_hours} dayHours={dayHours} />
        <StatBlock label="Taken / booked" hours={status.taken_hours} dayHours={dayHours} />
        <StatBlock label="Left" hours={status.remaining_hours} dayHours={dayHours} />
      </div>
      {Number(balance?.carried_hours) !== 0 && balance && (
        <p style={{ textAlign: "center", fontSize: "var(--text-sm)", marginTop: "var(--space-3)", marginBottom: 0, color: Number(balance.carried_hours) > 0 ? colors.okInk : colors.warnInk }}>
          Allowance includes {formatDays(Math.abs(balance.carried_hours), dayHours) || `${formatHours(Math.abs(balance.carried_hours))} hrs`}{" "}
          {Number(balance.carried_hours) > 0 ? "carried over from last year" : "owed from last year (taken off)"}.
        </p>
      )}
      <p style={{ textAlign: "center", fontSize: "var(--text-xs)", color: colors.inkSoft, marginTop: "var(--space-3)", marginBottom: 0 }}>
        {dayHours
          ? `Days are your ${formatHours(dayHours)}-hour working day, to the nearest half day. Unpaid leave doesn't use your allowance.`
          : "Shown in hours — ask the office to set your typical working day to see days. Unpaid leave doesn't use your allowance."}
      </p>
    </Card>
  );
}
