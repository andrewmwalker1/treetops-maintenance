// Pure date helpers for the timesheet week grid -- no I/O. Parses via
// new Date(y, m-1, d) rather than new Date(isoString), which parses as
// UTC midnight and can land on the wrong local day -- same reasoning as
// inputValueToDate in license-agreement/calculations.js.

function parseIsoDate(iso) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function toIsoDate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

// Monday of the week containing `date` (an ISO "YYYY-MM-DD" string).
export function mondayOf(iso) {
  const d = parseIsoDate(iso);
  const day = d.getDay(); // 0 = Sunday ... 6 = Saturday
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return toIsoDate(d);
}

// The 7 ISO dates (Monday..Sunday) for the week starting weekStart.
export function weekDates(weekStart) {
  const start = parseIsoDate(weekStart);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    return toIsoDate(d);
  });
}

export function addWeeks(weekStart, n) {
  const d = parseIsoDate(weekStart);
  d.setDate(d.getDate() + n * 7);
  return toIsoDate(d);
}

export const DAY_LABELS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export function formatWeekLabel(weekStart) {
  const start = parseIsoDate(weekStart);
  return `Week of ${start.getDate()} ${MONTH_NAMES[start.getMonth()]} ${start.getFullYear()}`;
}

export function formatShortDate(iso) {
  const d = parseIsoDate(iso);
  return `${DAY_LABELS[(d.getDay() + 6) % 7].slice(0, 3)} ${d.getDate()} ${MONTH_NAMES[d.getMonth()].slice(0, 3)}`;
}

export function todayIso() {
  return toIsoDate(new Date());
}

// Purely informational -- was this row saved before the day it's for
// actually happened (the Thursday-for-Friday forecast, or a pre-entered
// holiday week)? Not stored in the database -- see the comment in
// supabase/69-staff-timesheets.sql on why is_forecast isn't a column.
export function isForecastEntry(entry) {
  if (!entry?.created_at || !entry?.work_date) return false;
  return toIsoDate(new Date(entry.created_at)) < entry.work_date;
}
