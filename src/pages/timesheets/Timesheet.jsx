import { useState } from "react";
import { colors } from "../../lib/theme.js";
import { Alert, Button, Card, Input, PageHeader, Select, SkeletonList } from "../../ui/index.js";
import { addWeeks, DAY_LABELS, formatShortDate, formatWeekLabel, isForecastEntry } from "./weekMath.js";
import { useTimesheetEntry } from "./useTimesheetEntry.js";

function CardTitle({ children }) {
  return <h2 style={{ fontSize: 16, margin: 0, color: colors.mossDark }}>{children}</h2>;
}

// Local state + onBlur commit, same pattern as CommonFaultDescriptionsTab's
// Input -- avoids a network write on every keystroke. Keyed by date from
// the parent, so switching weeks mounts a fresh instance per day rather
// than carrying stale local text into a different date's row.
function DayRow({ label, isForecast, initialMorning, initialAfternoon, initialNotes, disabled, onSave }) {
  const [morning, setMorning] = useState(initialMorning ?? "");
  const [afternoon, setAfternoon] = useState(initialAfternoon ?? "");
  const [notes, setNotes] = useState(initialNotes ?? "");
  const total = (Number(morning) || 0) + (Number(afternoon) || 0);
  const commit = () => onSave(morning, afternoon, notes);
  return (
    <div style={{ padding: "8px 0", borderBottom: `1px solid ${colors.line}` }}>
      <div style={{ display: "grid", gridTemplateColumns: "110px 90px 50px 90px 60px", gap: 10, alignItems: "center" }}>
        <span style={{ fontWeight: 600 }}>
          {label}
          {isForecast && <span style={{ display: "block", fontSize: "var(--text-xs)", fontWeight: 400, color: colors.inkSoft }}>forecast</span>}
        </span>
        <Input
          type="number" step="0.25" min="0" placeholder="0" disabled={disabled}
          value={morning}
          onChange={(e) => setMorning(e.target.value)}
          onBlur={commit}
        />
        <span style={{ textAlign: "center", fontSize: "var(--text-xs)", color: colors.inkSoft }}>lunch</span>
        <Input
          type="number" step="0.25" min="0" placeholder="0" disabled={disabled}
          value={afternoon}
          onChange={(e) => setAfternoon(e.target.value)}
          onBlur={commit}
        />
        <span style={{ textAlign: "right", fontWeight: 600 }}>{total || "—"}</span>
      </div>
      <Input
        value={notes}
        disabled={disabled}
        placeholder="Notes (optional)"
        onChange={(e) => setNotes(e.target.value)}
        onBlur={commit}
        style={{ marginTop: 6, fontSize: "var(--text-xs)" }}
      />
    </div>
  );
}

function AddCorrectionForm({ recentEntries, onSubmit, onCancel, saving }) {
  const [correctsEntryId, setCorrectsEntryId] = useState("");
  const [hours, setHours] = useState("");
  const [reason, setReason] = useState("");
  const canSubmit = correctsEntryId && hours && Number(hours) !== 0 && reason.trim();

  return (
    <div style={{ background: colors.surfaceHover, border: `1px solid ${colors.line}`, borderRadius: "var(--radius-sm)", padding: 14, marginTop: 10 }}>
      <div style={{ marginBottom: 10 }}>
        <span style={{ display: "block", fontSize: "var(--text-xs)", fontWeight: 600, color: colors.inkSoft, marginBottom: 4 }}>Which day are you correcting?</span>
        <Select value={correctsEntryId} onChange={(e) => setCorrectsEntryId(e.target.value)}>
          <option value="">Choose a day…</option>
          {recentEntries.map((e) => (
            <option key={e.id} value={e.id}>{formatShortDate(e.work_date)} — currently {e.daily_total || 0} hrs</option>
          ))}
        </Select>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "140px 1fr", gap: 10, marginBottom: 10 }}>
        <div>
          <span style={{ display: "block", fontSize: "var(--text-xs)", fontWeight: 600, color: colors.inkSoft, marginBottom: 4 }}>Hours (+/-)</span>
          <Input type="number" step="0.25" placeholder="e.g. -2.5" value={hours} onChange={(e) => setHours(e.target.value)} />
        </div>
        <div>
          <span style={{ display: "block", fontSize: "var(--text-xs)", fontWeight: 600, color: colors.inkSoft, marginBottom: 4 }}>Reason</span>
          <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Actual was less than forecast" />
        </div>
      </div>
      <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
        <Button onClick={onCancel}>Cancel</Button>
        <Button
          variant="primary"
          disabled={!canSubmit || saving}
          onClick={() => {
            const original = recentEntries.find((e) => e.id === correctsEntryId);
            onSubmit({ correctsEntryId, workDate: original?.work_date, adjustmentHours: hours, reason: reason.trim() });
          }}
        >
          Save correction
        </Button>
      </div>
    </div>
  );
}

export default function Timesheet() {
  const t = useTimesheetEntry();
  const [addingCorrection, setAddingCorrection] = useState(false);

  if (t.initialLoading) return <SkeletonList rows={3} height={60} />;

  return (
    <div>
      <PageHeader title="Timesheet" level={2} />
      <Card pad="md">
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4, gap: 8, flexWrap: "wrap" }}>
          <Button onClick={() => t.setWeekStart((w) => addWeeks(w, -1))}>← Previous week</Button>
          <CardTitle>{formatWeekLabel(t.weekStart)}</CardTitle>
          <Button onClick={() => t.setWeekStart((w) => addWeeks(w, 1))}>Next week →</Button>
        </div>

        {t.isFrozen && (
          <Alert tone="warn" title="This week is frozen">
            {t.frozenByName ? `Frozen by ${t.frozenByName}.` : "Frozen."} Ask the office if something needs correcting.
          </Alert>
        )}
        {t.error && <Alert tone="danger" title="Something went wrong">{t.error}</Alert>}
        {t.copiedFromLastWeek && !t.isFrozen && (
          <Alert tone="info" title="Copied from last week">
            Nothing was entered yet, so this week started from last week's hours — review and adjust anything that's different.
          </Alert>
        )}

        <div style={{ marginTop: 14 }}>
          {t.days.map((date, i) => {
            const entry = t.dailyByDate[date];
            return (
              <DayRow
                key={`${t.weekStart}-${date}`}
                label={DAY_LABELS[i]}
                isForecast={entry ? isForecastEntry(entry) : false}
                initialMorning={entry?.morning_hours}
                initialAfternoon={entry?.afternoon_hours}
                initialNotes={entry?.notes}
                disabled={t.isFrozen || t.saving}
                onSave={(morning, afternoon, notes) => t.saveDay(date, morning, afternoon, notes)}
              />
            );
          })}
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontWeight: 700, padding: "12px 0 4px" }}>
          <span>Week total</span>
          <span>{t.weekTotal} hrs</span>
        </div>

        <div style={{ marginTop: 20, borderTop: `1px solid ${colors.line}`, paddingTop: 14 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: "var(--text-sm)", fontWeight: 600, color: colors.inkSoft }}>Corrections</span>
            {!addingCorrection && (
              <Button disabled={t.isFrozen} onClick={() => setAddingCorrection(true)}>+ Add a correction</Button>
            )}
          </div>
          {t.adjustments.map((a) => (
            <div key={a.id} style={{ fontSize: "var(--text-sm)", padding: "8px 12px", background: colors.warnSurface, border: `1px solid ${colors.warnBorder}`, color: colors.warnInk, borderRadius: "var(--radius-sm)", marginTop: 8 }}>
              Correction — {formatShortDate(a.work_date)}: {a.adjustment_hours > 0 ? "+" : ""}{a.adjustment_hours} hrs — {a.adjustment_reason}
            </div>
          ))}
          {addingCorrection && (
            <AddCorrectionForm
              recentEntries={t.recentEntries}
              saving={t.saving}
              onCancel={() => setAddingCorrection(false)}
              onSubmit={(payload) => {
                t.addCorrection(payload);
                setAddingCorrection(false);
              }}
            />
          )}
        </div>
      </Card>
    </div>
  );
}
