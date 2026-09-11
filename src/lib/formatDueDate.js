// Short, human-scannable due-date text for job cards and lists -- "15 Sep"
// reads faster than a raw ISO string ("2026-09-15") when glancing at a
// phone outdoors. The year is only added when it isn't the current one,
// since almost every due date in view is this year and repeating it adds
// no signal.
export function formatDueDate(isoDate) {
  if (!isoDate) return "";
  const date = new Date(`${isoDate}T00:00:00`);
  const sameYear = date.getFullYear() === new Date().getFullYear();
  return date.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    ...(sameYear ? {} : { year: "numeric" }),
  });
}
