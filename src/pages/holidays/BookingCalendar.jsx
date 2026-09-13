// Month-grid picker -- greys out non-working days and bank holidays with
// the same visual treatment (different underlying reason), and greys out
// days already covered by a pending/approved request so the same day
// can't be double-booked client-side (the database's own partial unique
// index is the real guarantee; this is just not inviting the attempt).
// Cells are <Button> with style overrides, same pattern as
// StaffTimeProfilesTab.jsx's day-toggle chips -- never a raw button
// element carrying its own style prop, which scripts/check-styles.mjs
// blocks.
import { useState } from "react";
import { colors } from "../../lib/theme.js";
import { Button, Card, PageHeader } from "../../ui/index.js";
import { addMonths, formatMonthLabel, monthGridDates, todayIso, weekdayKey } from "./monthMath.js";

const DAY_HEADERS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export default function BookingCalendar({ timeProfile, bankHolidayDates, disabledDates, selectedDates, onToggleDate, onContinue }) {
  const [monthCursor, setMonthCursor] = useState(() => todayIso());
  const today = todayIso();
  const selected = new Set(selectedDates);

  function isNonWorkingDay(iso) {
    if (!timeProfile.has_fixed_pattern) return false;
    return !timeProfile[`works_${weekdayKey(iso)}`];
  }

  function isSelectable(iso) {
    return iso >= today && !isNonWorkingDay(iso) && !bankHolidayDates.has(iso) && !disabledDates.has(iso);
  }

  return (
    <Card pad="md">
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "var(--space-3)" }}>
        <Button onClick={() => setMonthCursor((m) => addMonths(m, -1))}>← Previous</Button>
        <PageHeader title={formatMonthLabel(monthCursor)} level={2} />
        <Button onClick={() => setMonthCursor((m) => addMonths(m, 1))}>Next →</Button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 4, marginBottom: 4 }}>
        {DAY_HEADERS.map((d) => (
          <div key={d} style={{ textAlign: "center", fontSize: "var(--text-xs)", fontWeight: 600, color: colors.inkSoft }}>
            {d}
          </div>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 4 }}>
        {monthGridDates(monthCursor).map((iso, i) => {
          if (!iso) return <div key={`blank-${i}`} />;
          const isPast = iso < today;
          const nonWorking = isNonWorkingDay(iso);
          const bankHoliday = bankHolidayDates.has(iso);
          const alreadyBooked = disabledDates.has(iso);
          const isSelected = selected.has(iso);
          const selectable = isSelectable(iso);
          const dayNum = Number(iso.slice(-2));

          let background = colors.paper;
          let textColor = colors.ink;
          let note = null;
          if (isSelected) {
            background = colors.moss;
            textColor = colors.onDark;
          } else if (isPast || nonWorking) {
            background = colors.surfaceSunken;
            textColor = colors.inkSoft;
          } else if (bankHoliday) {
            background = colors.warnSurface;
            textColor = colors.warnInk;
            note = "Bank hol.";
          } else if (alreadyBooked) {
            background = colors.okSurface;
            textColor = colors.okInk;
            note = "Booked";
          }

          return (
            <Button
              key={iso}
              disabled={!selectable}
              onClick={() => onToggleDate(iso)}
              style={{
                aspectRatio: "1",
                flexDirection: "column",
                gap: 0,
                padding: 2,
                fontSize: "var(--text-sm)",
                fontWeight: isSelected ? 700 : 400,
                background,
                color: textColor,
                borderColor: isSelected ? colors.moss : undefined,
              }}
            >
              <span>{dayNum}</span>
              {note && <span style={{ fontSize: 9 }}>{note}</span>}
            </Button>
          );
        })}
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "var(--space-4)" }}>
        <span style={{ fontSize: "var(--text-sm)", color: colors.inkSoft }}>
          {selectedDates.length} day{selectedDates.length === 1 ? "" : "s"} selected
        </span>
        <Button variant="primary" disabled={selectedDates.length === 0} onClick={onContinue}>
          Continue →
        </Button>
      </div>
    </Card>
  );
}
