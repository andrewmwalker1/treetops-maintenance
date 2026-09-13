import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { colors } from "../lib/theme.js";
import { Alert, Button, IconArrowLeft, Input, PageHeader } from "../ui/index.js";
import { useTimesheetEntry } from "../pages/timesheets/useTimesheetEntry.js";
import { DAY_LABELS, isForecastEntry } from "../pages/timesheets/weekMath.js";

// Kiosk-sized version of Timesheet.jsx, sharing the same
// useTimesheetEntry() hook -- same relationship KioskCheckOut.jsx has to
// useEquipmentCheckout.js. Deliberately shows only the current week (no
// prev/next-week switcher) and skips the "add a correction" flow -- a
// shared walk-up terminal with a 3-minute idle timeout isn't the place
// for a considered "which day, how many hours, why" correction; that
// stays a desktop/PWA action.
function DayRow({ label, isForecast, initialMorning, initialAfternoon, initialNotes, disabled, onSave }) {
  const [morning, setMorning] = useState(initialMorning ?? "");
  const [afternoon, setAfternoon] = useState(initialAfternoon ?? "");
  const [notes, setNotes] = useState(initialNotes ?? "");
  const total = (Number(morning) || 0) + (Number(afternoon) || 0);
  const commit = () => onSave(morning, afternoon, notes);
  return (
    <div style={{ padding: "14px 0", borderBottom: `1px solid ${colors.line}` }}>
      <div style={{ display: "grid", gridTemplateColumns: "130px 1fr 60px 1fr 80px", gap: 14, alignItems: "center" }}>
        <span style={{ fontWeight: 600, fontSize: "var(--text-lg)" }}>
          {label}
          {isForecast && <span style={{ display: "block", fontSize: "var(--text-xs)", fontWeight: 400, color: colors.inkSoft }}>forecast</span>}
        </span>
        <Input
          type="number" step="0.25" min="0" placeholder="0" disabled={disabled}
          value={morning}
          onChange={(e) => setMorning(e.target.value)}
          onBlur={commit}
          style={{ height: 52, fontSize: "var(--text-lg)", textAlign: "center" }}
        />
        <span style={{ textAlign: "center", fontSize: "var(--text-xs)", color: colors.inkSoft }}>lunch</span>
        <Input
          type="number" step="0.25" min="0" placeholder="0" disabled={disabled}
          value={afternoon}
          onChange={(e) => setAfternoon(e.target.value)}
          onBlur={commit}
          style={{ height: 52, fontSize: "var(--text-lg)", textAlign: "center" }}
        />
        <span style={{ textAlign: "right", fontWeight: 700, fontSize: "var(--text-lg)" }}>{total || "—"}</span>
      </div>
      <Input
        value={notes}
        disabled={disabled}
        placeholder="Notes (optional)"
        onChange={(e) => setNotes(e.target.value)}
        onBlur={commit}
        style={{ marginTop: 8, height: 40 }}
      />
    </div>
  );
}

export default function KioskTimesheet() {
  const navigate = useNavigate();
  const t = useTimesheetEntry();

  return (
    <div style={{ padding: "var(--space-6)", maxWidth: "var(--width-2xl)", margin: "0 auto" }}>
      <Button onClick={() => navigate("/kiosk")} icon={<IconArrowLeft size={16} />} style={{ marginBottom: "var(--space-5)" }}>
        Back
      </Button>
      <PageHeader title="This week's timesheet" />

      {t.isFrozen && (
        <Alert tone="warn" title="This week is frozen">
          {t.frozenByName ? `Frozen by ${t.frozenByName}.` : "Frozen."} See the office if something needs correcting.
        </Alert>
      )}
      {t.error && <Alert tone="danger" title="Something went wrong">{t.error}</Alert>}

      {!t.initialLoading &&
        t.days.map((date, i) => {
          const entry = t.dailyByDate[date];
          return (
            <DayRow
              key={date}
              label={DAY_LABELS[i]}
              isForecast={entry ? isForecastEntry(entry) : false}
              initialMorning={entry?.morning_hours}
              initialAfternoon={entry?.afternoon_hours}
              disabled={t.isFrozen || t.saving}
              onSave={(morning, afternoon) => t.saveDay(date, morning, afternoon)}
            />
          );
        })}

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontWeight: 700, fontSize: "var(--text-lg)", padding: "16px 0" }}>
        <span>Week total</span>
        <span>{t.weekTotal} hrs</span>
      </div>

      <Button variant="primary" size="kiosk" block onClick={() => navigate("/kiosk")}>
        Done
      </Button>
    </div>
  );
}
