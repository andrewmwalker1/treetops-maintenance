// Shared by useTimesheetEntry.js (self-service) and FixedHoursSection.jsx
// -- a fixed-hours person (Jayne) never opens her own self-service page,
// so the office grid has to trigger the same "default forward from last
// week" behaviour on her behalf rather than only on page load. One
// implementation rather than two copies of the same logic.
import { getWeekEntries, upsertDailyEntry } from "../../lib/timesheetQueries.js";
import { addWeeks, mondayOf, todayIso, weekDates } from "./weekMath.js";

// Only fires for a week with zero daily rows so far -- never overwrites a
// week someone's already started. Callers that can write to a frozen week
// (only can_manage_timesheets holders can) get the usual audit-logged
// insert for free from the existing before-insert trigger; this function
// itself has no frozen-week awareness of its own.
//
// Only ever copies into the current week (Andy, 19 Nov 2026). It used to
// fire for any empty week, so just paging forward with "Next week" filled
// every future week with copied hours the office would read as real.
export async function copyFromPreviousWeek(profileId, weekStart) {
  if (weekStart !== mondayOf(todayIso())) return false;
  const prevWeekStart = addWeeks(weekStart, -1);
  const prevEntries = await getWeekEntries(profileId, prevWeekStart);
  const prevDaily = prevEntries.filter(
    (e) => e.entry_kind === "daily" && (e.morning_hours != null || e.afternoon_hours != null)
  );
  if (prevDaily.length === 0) return false;

  // A day already booked as holiday or unpaid leave this week can't also
  // take a worked row (timesheet_entries_one_daily_per_day covers all
  // three kinds) -- copying onto it failed the whole week's load.
  const holidayDates = new Set(
    (await getWeekEntries(profileId, weekStart)).filter((e) => e.entry_kind === "holiday" || e.entry_kind === "unpaid").map((e) => e.work_date)
  );

  const prevDates = weekDates(prevWeekStart);
  const thisDates = weekDates(weekStart);
  await Promise.all(
    prevDates.map((prevDate, i) => {
      const prevEntry = prevDaily.find((e) => e.work_date === prevDate);
      if (!prevEntry || holidayDates.has(thisDates[i])) return null;
      return upsertDailyEntry({
        profileId,
        workDate: thisDates[i],
        morningHours: prevEntry.morning_hours,
        afternoonHours: prevEntry.afternoon_hours,
      });
    })
  );
  return true;
}
