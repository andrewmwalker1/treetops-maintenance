// Below the hourly grid, its own Card -- people paid a fixed weekly
// figure (Jayne: Fri-Mon, 32 hrs, paid lunch) never submit a timesheet
// themselves. Reuses the exact same entry_kind = 'daily' row shape and
// upsertDailyEntry as the hourly grid: her week is just one row, dated to
// the Monday, with the whole weekly figure in morning_hours and
// afternoon_hours = 0. No new table, no special-casing anywhere else --
// accrual, freeze, and audit logging all already work unchanged for a
// 'daily' row regardless of whose it is.
//
// She'll never open a self-service page to trigger the usual "copy last
// week forward" default, so this section does it on her behalf the first
// time a week with nothing entered yet is loaded here.
import { useEffect, useState } from "react";
import { getFixedHoursProfiles } from "../../lib/holidayQueries.js";
import { getWeekEntriesForProfiles, upsertDailyEntry } from "../../lib/timesheetQueries.js";
import { colors } from "../../lib/theme.js";
import { Card, Input, PageHeader } from "../../ui/index.js";
import { copyFromPreviousWeek } from "./copyForward.js";

function FixedHoursRow({ profile, weekStart, initialHours, onSaved }) {
  const [hours, setHours] = useState(initialHours ?? "");

  useEffect(() => {
    setHours(initialHours ?? "");
  }, [initialHours, weekStart]);

  async function commit() {
    await upsertDailyEntry({ profileId: profile.id, workDate: weekStart, morningHours: hours, afternoonHours: 0 });
    onSaved();
  }

  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, padding: "8px 0", borderBottom: `1px solid ${colors.line}` }}>
      <span style={{ fontWeight: 600 }}>{profile.displayName}</span>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <Input type="number" step="0.25" min="0" value={hours} onChange={(e) => setHours(e.target.value)} onBlur={commit} style={{ width: 90 }} />
        <span style={{ fontSize: "var(--text-xs)", color: colors.inkSoft }}>hrs this week</span>
      </div>
    </div>
  );
}

export default function FixedHoursSection({ weekStart }) {
  const [profiles, setProfiles] = useState([]);
  const [entriesByProfile, setEntriesByProfile] = useState({});
  const [loading, setLoading] = useState(true);

  async function refresh() {
    const fixedProfiles = await getFixedHoursProfiles();
    setProfiles(fixedProfiles);

    let entries = await getWeekEntriesForProfiles(fixedProfiles.map((p) => p.id), weekStart);
    let byProfile = Object.fromEntries(entries.filter((e) => e.entry_kind === "daily").map((e) => [e.profile_id, e]));

    const needsCopy = fixedProfiles.filter((p) => !byProfile[p.id]);
    if (needsCopy.length > 0) {
      const copied = await Promise.all(needsCopy.map((p) => copyFromPreviousWeek(p.id, weekStart)));
      if (copied.some(Boolean)) {
        entries = await getWeekEntriesForProfiles(fixedProfiles.map((p) => p.id), weekStart);
        byProfile = Object.fromEntries(entries.filter((e) => e.entry_kind === "daily").map((e) => [e.profile_id, e]));
      }
    }

    setEntriesByProfile(byProfile);
    setLoading(false);
  }

  useEffect(() => {
    setLoading(true);
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weekStart]);

  if (loading || profiles.length === 0) return null;

  return (
    <Card pad="md" style={{ marginTop: "var(--space-4)" }}>
      <PageHeader title="Fixed weekly hours" level={2} />
      <p style={{ fontSize: "var(--text-xs)", color: colors.inkSoft, marginTop: 0 }}>
        People paid a fixed weekly figure rather than a daily timesheet — carries forward automatically each week.
      </p>
      {profiles.map((p) => (
        <FixedHoursRow
          key={p.id}
          profile={p}
          weekStart={weekStart}
          initialHours={entriesByProfile[p.id]?.morning_hours ?? p.weeklyHours}
          onSaved={refresh}
        />
      ))}
    </Card>
  );
}
