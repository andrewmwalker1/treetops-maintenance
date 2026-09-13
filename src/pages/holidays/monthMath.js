// Pure month-grid date helpers -- no I/O. Same local-date-safe convention
// as src/pages/timesheets/weekMath.js: parse "YYYY-MM-DD" via
// new Date(y, m-1, d), never new Date(isoString), which parses as UTC
// midnight and can land on the wrong local day.

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

export function firstOfMonth(iso) {
  const d = parseIsoDate(iso);
  return toIsoDate(new Date(d.getFullYear(), d.getMonth(), 1));
}

// All ISO dates in the month containing `iso`, Monday-first, including
// the leading/trailing blanks needed to fill a 7-column grid (null for
// those slots).
export function monthGridDates(iso) {
  const start = parseIsoDate(firstOfMonth(iso));
  const daysInMonth = new Date(start.getFullYear(), start.getMonth() + 1, 0).getDate();
  const startOffset = (start.getDay() + 6) % 7; // Monday = 0
  const cells = Array.from({ length: startOffset }, () => null);
  for (let day = 1; day <= daysInMonth; day++) {
    cells.push(toIsoDate(new Date(start.getFullYear(), start.getMonth(), day)));
  }
  return cells;
}

export function addMonths(iso, n) {
  const d = parseIsoDate(firstOfMonth(iso));
  return toIsoDate(new Date(d.getFullYear(), d.getMonth() + n, 1));
}

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export function formatMonthLabel(iso) {
  const d = parseIsoDate(iso);
  return `${MONTH_NAMES[d.getMonth()]} ${d.getFullYear()}`;
}

const WEEKDAY_KEYS = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];

// 0 = Monday .. 6 = Sunday, matching the works_* column suffixes on
// staff_time_profiles (works_monday..works_sunday).
export function weekdayKey(iso) {
  const d = parseIsoDate(iso);
  return WEEKDAY_KEYS[(d.getDay() + 6) % 7];
}

export function todayIso() {
  return toIsoDate(new Date());
}
