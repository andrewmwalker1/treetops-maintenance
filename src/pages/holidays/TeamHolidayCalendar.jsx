// Org-wide "who's off" month view, approved holiday only (never pending --
// team_holiday_calendar() only ever returns entry_kind = 'holiday' rows,
// which by construction only exist once a request is approved or a bank
// holiday is auto-booked). Every day gets the identical treatment
// regardless of headcount -- up to 3 avatars then a "+N" chip, tap for the
// full list -- deliberately no special-cased "whole team off" banner for
// a day like Christmas, per Andy's explicit preference for one consistent
// rule (see the plan file's Decisions section).
import { useEffect, useMemo, useState } from "react";
import { getTeamHolidayCalendar } from "../../lib/holidayQueries.js";
import { colors } from "../../lib/theme.js";
import { Alert, Button, Card, PageHeader, SkeletonList } from "../../ui/index.js";
import { addMonths, firstOfMonth, formatMonthLabel, monthGridDates, todayIso } from "./monthMath.js";

function initials(name) {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] || "") + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase() || "?";
}

function DayAvatars({ people }) {
  const shown = people.slice(0, 3);
  const extra = people.length - shown.length;
  return (
    <div style={{ display: "flex", gap: 2, flexWrap: "wrap", justifyContent: "center" }}>
      {shown.map((p) => (
        <span
          key={p.profile_id}
          title={p.display_name}
          style={{
            width: 16, height: 16, borderRadius: "var(--radius-full)", background: colors.moss, color: colors.onDark,
            fontSize: 8, fontWeight: 700, display: "grid", placeItems: "center", flexShrink: 0,
          }}
        >
          {initials(p.display_name)}
        </span>
      ))}
      {extra > 0 && <span style={{ fontSize: 8, fontWeight: 700, color: colors.inkSoft }}>+{extra}</span>}
    </div>
  );
}

export default function TeamHolidayCalendar() {
  const [monthCursor, setMonthCursor] = useState(() => todayIso());
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedDate, setSelectedDate] = useState(null);

  useEffect(() => {
    setLoading(true);
    setSelectedDate(null);
    const monthStart = firstOfMonth(monthCursor);
    const gridDates = monthGridDates(monthCursor).filter(Boolean);
    const monthEnd = gridDates[gridDates.length - 1];
    getTeamHolidayCalendar(monthStart, monthEnd)
      .then(setRows)
      .catch((err) => setError(err.message || String(err)))
      .finally(() => setLoading(false));
  }, [monthCursor]);

  const byDate = useMemo(() => {
    const map = {};
    for (const r of rows) {
      if (!map[r.work_date]) map[r.work_date] = [];
      map[r.work_date].push(r);
    }
    return map;
  }, [rows]);

  return (
    <Card pad="md">
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "var(--space-3)" }}>
        <Button onClick={() => setMonthCursor((m) => addMonths(m, -1))}>← Previous</Button>
        <PageHeader title={formatMonthLabel(monthCursor)} level={2} />
        <Button onClick={() => setMonthCursor((m) => addMonths(m, 1))}>Next →</Button>
      </div>

      {error && <Alert tone="danger" title="Something went wrong">{error}</Alert>}
      {loading ? (
        <SkeletonList rows={3} height={60} />
      ) : (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 4 }}>
            {monthGridDates(monthCursor).map((iso, i) => {
              if (!iso) return <div key={`blank-${i}`} />;
              const people = byDate[iso] || [];
              const isSelected = selectedDate === iso;
              return (
                <Button
                  key={iso}
                  disabled={people.length === 0}
                  onClick={() => setSelectedDate(iso)}
                  style={{
                    aspectRatio: "1",
                    flexDirection: "column",
                    gap: 2,
                    padding: 2,
                    fontSize: "var(--text-xs)",
                    background: isSelected ? colors.surfaceHover : colors.paper,
                    borderColor: isSelected ? colors.moss : undefined,
                  }}
                >
                  <span>{Number(iso.slice(-2))}</span>
                  {people.length > 0 && <DayAvatars people={people} />}
                </Button>
              );
            })}
          </div>

          {selectedDate && byDate[selectedDate] && (
            <Card pad="sm" style={{ marginTop: "var(--space-3)" }}>
              <div style={{ fontWeight: 600, marginBottom: 6 }}>{selectedDate}</div>
              {byDate[selectedDate].map((r) => (
                <div key={r.profile_id} style={{ fontSize: "var(--text-sm)", padding: "4px 0" }}>
                  {r.display_name} — {r.hours} hrs
                </div>
              ))}
            </Card>
          )}
        </>
      )}
    </Card>
  );
}
