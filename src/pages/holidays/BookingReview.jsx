// Per-selected-day hours editing (this is where half-days happen) plus an
// optional per-day note, then submit. Defaults each day to the person's
// normal daily hours (weekly_hours / working days) when they have a fixed
// pattern; someone marked "varies week to week" gets a blank field for
// every day since there's no fixed rate to default from.
import { useState } from "react";
import { submitHolidayRequest } from "../../lib/holidayQueries.js";
import { formatShortDate } from "../timesheets/weekMath.js";
import { colors } from "../../lib/theme.js";
import { Alert, Button, Card, Input, PageHeader } from "../../ui/index.js";

const WEEKDAYS = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];

function defaultDailyHours(timeProfile) {
  if (!timeProfile.has_fixed_pattern) return "";
  const workingDays = WEEKDAYS.filter((d) => timeProfile[`works_${d}`]).length;
  if (workingDays === 0) return "";
  return (Number(timeProfile.weekly_hours) / workingDays).toFixed(2);
}

function ReviewRow({ workDate, hours, note, onChange }) {
  return (
    <div
      style={{
        display: "grid", gridTemplateColumns: "140px 100px 1fr", gap: 10, alignItems: "center",
        padding: "8px 0", borderBottom: `1px solid ${colors.line}`,
      }}
    >
      <span style={{ fontWeight: 600 }}>{formatShortDate(workDate)}</span>
      <Input type="number" step="0.25" min="0" value={hours} onChange={(e) => onChange({ hours: e.target.value })} />
      <Input placeholder="Note (optional)" value={note} onChange={(e) => onChange({ note: e.target.value })} />
    </div>
  );
}

export default function BookingReview({ profileId, timeProfile, dates, onBack, onSubmitted }) {
  const [rows, setRows] = useState(() => {
    const defaultHours = defaultDailyHours(timeProfile);
    return dates.map((workDate) => ({ workDate, hours: defaultHours, note: "" }));
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const totalHours = rows.reduce((sum, r) => sum + (Number(r.hours) || 0), 0);
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
      {!timeProfile.has_fixed_pattern && (
        <Alert tone="info" title="Enter hours for each day">
          Your hours vary week to week, so enter the hours you'd expect to be paid for each day selected.
        </Alert>
      )}
      <div style={{ marginTop: 10 }}>
        {rows.map((r, i) => (
          <ReviewRow key={r.workDate} workDate={r.workDate} hours={r.hours} note={r.note} onChange={(patch) => updateRow(i, patch)} />
        ))}
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 700, padding: "12px 0" }}>
        <span>Total</span>
        <span>{totalHours} hrs</span>
      </div>
      <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
        <Button onClick={onBack} disabled={saving}>← Back</Button>
        <Button variant="primary" disabled={!canSubmit || saving} onClick={handleSubmit}>
          {saving ? "Submitting…" : "Submit request"}
        </Button>
      </div>
    </Card>
  );
}
