// Per-selected-day hours editing (this is where half-days happen), an
// "Unpaid" tick and an optional note per day, then submit. Defaults each
// day to the person's working day (src/lib/dayLength.js: typical day if
// the office set one, else weekly_hours / working days); blank when
// neither works out. Totals split paid holiday from unpaid leave, in days
// and hours.
import { useState } from "react";
import { submitHolidayRequest } from "../../lib/holidayQueries.js";
import { formatShortDate } from "../timesheets/weekMath.js";
import { formatDays, formatHours, workingDayHours } from "../../lib/dayLength.js";
import { useIsMobile } from "../../lib/useIsMobile.js";
import { colors } from "../../lib/theme.js";
import { Alert, Button, Card, Input, PageHeader } from "../../ui/index.js";

function ReviewRow({ workDate, hours, unpaid, note, onChange, isMobile }) {
  const unpaidBox = (
    <label style={{ display: "flex", alignItems: "center", gap: "var(--space-1)", fontSize: "var(--text-sm)", cursor: "pointer", whiteSpace: "nowrap" }}>
      <input type="checkbox" checked={unpaid} onChange={(e) => onChange({ unpaid: e.target.checked })} />
      Unpaid
    </label>
  );
  const hoursInput = (
    <Input type="number" step="0.25" min="0" value={hours} onChange={(e) => onChange({ hours: e.target.value })} aria-label={`Hours off on ${formatShortDate(workDate)}`} />
  );
  const noteInput = <Input placeholder="Note (optional)" value={note} onChange={(e) => onChange({ note: e.target.value })} />;
  return (
    <div style={{ padding: "var(--space-2) 0", borderBottom: `1px solid ${colors.line}` }}>
      {isMobile ? (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1.4fr) minmax(0, 1fr) auto", gap: "var(--space-2)", alignItems: "center", marginBottom: "var(--space-2)" }}>
            <span style={{ fontWeight: 600 }}>{formatShortDate(workDate)}</span>
            {hoursInput}
            {unpaidBox}
          </div>
          {noteInput}
        </>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "140px 100px auto 1fr", gap: "var(--space-3)", alignItems: "center" }}>
          <span style={{ fontWeight: 600 }}>{formatShortDate(workDate)}</span>
          {hoursInput}
          {unpaidBox}
          {noteInput}
        </div>
      )}
    </div>
  );
}

export default function BookingReview({ profileId, timeProfile, dates, onBack, onSubmitted }) {
  const isMobile = useIsMobile();
  // Pre-filled with the person's own working day (dayLength.js); blank
  // when that can't be worked out, so they enter it per day.
  const dayHours = workingDayHours(timeProfile);
  const [rows, setRows] = useState(() =>
    dates.map((workDate) => ({ workDate, hours: dayHours ? formatHours(dayHours) : "", unpaid: false, note: "" }))
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const paidHours = rows.filter((r) => !r.unpaid).reduce((sum, r) => sum + (Number(r.hours) || 0), 0);
  const unpaidHours = rows.filter((r) => r.unpaid).reduce((sum, r) => sum + (Number(r.hours) || 0), 0);
  const describe = (h) => {
    const days = formatDays(h, dayHours);
    return days ? `${days} (${formatHours(h)} hrs)` : `${formatHours(h)} hrs`;
  };
  const canSubmit = rows.every((r) => Number(r.hours) > 0);

  function updateRow(index, patch) {
    setRows((prev) => prev.map((r, i) => (i === index ? { ...r, ...patch } : r)));
  }

  async function handleSubmit() {
    setSaving(true);
    setError("");
    try {
      await submitHolidayRequest(profileId, rows);
      onSubmitted();
    } catch (err) {
      setError(err.message || String(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card pad="md">
      <PageHeader title="Review your booking" level={2} />
      {error && <Alert tone="danger" title="Something went wrong">{error}</Alert>}
      {!dayHours && (
        <Alert tone="info" title="Enter hours for each day">
          Your hours vary week to week, so enter the hours you'd normally work on each day selected.
        </Alert>
      )}
      <p style={{ fontSize: "var(--text-sm)", color: colors.inkSoft, margin: "var(--space-1) 0 0" }}>
        Tick <strong>Unpaid</strong> for any day you're taking as unpaid leave — it won't use your holiday allowance or be paid.
      </p>
      <div style={{ marginTop: 10 }}>
        {rows.map((r, i) => (
          <ReviewRow key={r.workDate} workDate={r.workDate} hours={r.hours} unpaid={r.unpaid} note={r.note} isMobile={isMobile} onChange={(patch) => updateRow(i, patch)} />
        ))}
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 700, padding: "var(--space-3) 0 var(--space-1)" }}>
        <span>Paid holiday</span>
        <span>{describe(paidHours)}</span>
      </div>
      {unpaidHours > 0 && (
        <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 600, color: colors.warnInk, paddingBottom: "var(--space-1)" }}>
          <span>Unpaid leave</span>
          <span>{describe(unpaidHours)}</span>
        </div>
      )}
      <div style={{ height: "var(--space-2)" }} />
      <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
        <Button onClick={onBack} disabled={saving}>← Back</Button>
        <Button variant="primary" disabled={!canSubmit || saving} onClick={handleSubmit}>
          {saving ? "Submitting…" : "Submit request"}
        </Button>
      </div>
    </Card>
  );
}
