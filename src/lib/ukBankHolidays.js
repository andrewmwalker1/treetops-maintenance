// England & Wales bank holidays, for Admin -> Bank holidays' "Fill in"
// button. Tries the official GOV.UK list first (covers future years as
// they're announced); if the browser can't reach it, falls back to the
// dates below. Substitute days already applied (e.g. 28 Dec 2026, Boxing
// Day falling on a Saturday). Extend BUILT_IN when GOV.UK publishes 2029.
const BUILT_IN = [
  ["2026-01-01", "New Year's Day"], ["2026-04-03", "Good Friday"], ["2026-04-06", "Easter Monday"],
  ["2026-05-04", "Early May bank holiday"], ["2026-05-25", "Spring bank holiday"], ["2026-08-31", "Summer bank holiday"],
  ["2026-12-25", "Christmas Day"], ["2026-12-28", "Boxing Day (substitute day)"],
  ["2027-01-01", "New Year's Day"], ["2027-03-26", "Good Friday"], ["2027-03-29", "Easter Monday"],
  ["2027-05-03", "Early May bank holiday"], ["2027-05-31", "Spring bank holiday"], ["2027-08-30", "Summer bank holiday"],
  ["2027-12-27", "Christmas Day (substitute day)"], ["2027-12-28", "Boxing Day (substitute day)"],
  ["2028-01-03", "New Year's Day (substitute day)"], ["2028-04-14", "Good Friday"], ["2028-04-17", "Easter Monday"],
  ["2028-05-01", "Early May bank holiday"], ["2028-05-29", "Spring bank holiday"], ["2028-08-28", "Summer bank holiday"],
  ["2028-12-25", "Christmas Day"], ["2028-12-26", "Boxing Day"],
].map(([date, title]) => ({ date, title }));

export async function getEnglandWalesBankHolidays() {
  try {
    const res = await fetch("https://www.gov.uk/bank-holidays.json");
    if (!res.ok) throw new Error(`GOV.UK returned ${res.status}`);
    const events = (await res.json())["england-and-wales"]?.events || [];
    if (events.length === 0) throw new Error("GOV.UK list was empty");
    const byDate = new Map(BUILT_IN.map((e) => [e.date, e]));
    for (const e of events) byDate.set(e.date, { date: e.date, title: e.title });
    return { source: "GOV.UK", events: [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date)) };
  } catch (err) {
    console.warn("GOV.UK bank holidays unavailable, using built-in list", err);
    return { source: "built-in list", events: BUILT_IN };
  }
}
