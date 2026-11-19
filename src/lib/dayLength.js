// A person's working day in hours, and hours shown as days -- display only,
// everything is still counted in hours (people's days differ in length).
//
// Day length: staff_time_profiles.typical_day_hours if the office set one
// (92-unpaid-leave-and-day-length.sql), otherwise weekly hours / days in a
// fixed pattern (Peter 35/5 = 7, Jayne 32/4 = 8). Null when neither works
// out (hours vary and no typical day set) -- callers fall back to hours.
const DAY_KEYS = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];

export function patternDayHours(timeProfile) {
  if (!timeProfile?.has_fixed_pattern) return null;
  const days = DAY_KEYS.filter((d) => timeProfile[`works_${d}`]).length;
  const weekly = Number(timeProfile.weekly_hours);
  return days > 0 && weekly > 0 ? weekly / days : null;
}

export function workingDayHours(timeProfile) {
  const typical = Number(timeProfile?.typical_day_hours);
  return typical > 0 ? typical : patternDayHours(timeProfile);
}

// Nearest half day (Andy's call, 19 Nov 2026): "25½ days", "½ day", "1 day".
export function formatDays(hours, dayHours) {
  if (!(dayHours > 0)) return null;
  const halves = Math.round((Math.abs(Number(hours) || 0) / dayHours) * 2);
  const whole = Math.floor(halves / 2);
  const half = halves % 2 === 1;
  const text = `${whole === 0 && half ? "" : whole}${half ? "½" : ""}`;
  const sign = Number(hours) < 0 && halves > 0 ? "−" : "";
  return `${sign}${text} ${halves === 2 ? "day" : halves === 1 ? "day" : "days"}`;
}

// Hours to 2dp without trailing zeros ("7", "7.5", "6.25").
export function formatHours(hours) {
  return String(Number(Number(hours || 0).toFixed(2)));
}
