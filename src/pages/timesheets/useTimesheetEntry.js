// Shared self-service state: current week, that week's entries and
// freeze status, save-a-day, add-a-correction. Consumed by both
// Timesheet.jsx (desktop/PWA) and KioskTimesheet.jsx -- same
// relationship useEquipmentCheckout.js has to CheckoutKit.jsx/
// KioskCheckOut.jsx. Always operates on the logged-in profile; office
// entering on someone else's behalf goes through PersonWeekEditModal.jsx
// instead, which calls the same timesheetQueries.js functions directly.
import { useCallback, useEffect, useState } from "react";
import { useAuth } from "../../lib/AuthContext.jsx";
import {
  getRecentDailyEntries, getWeekEntries, getWeekFreezeStatus, insertAdjustment, upsertDailyEntry,
} from "../../lib/timesheetQueries.js";
import { copyFromPreviousWeek } from "./copyForward.js";
import { mondayOf, todayIso, weekDates } from "./weekMath.js";

export function useTimesheetEntry() {
  const { profile } = useAuth();
  const [weekStart, setWeekStart] = useState(() => mondayOf(todayIso()));
  const [entries, setEntries] = useState([]);
  const [freeze, setFreeze] = useState(null);
  const [recentEntries, setRecentEntries] = useState([]);
  const [copiedFromLastWeek, setCopiedFromLastWeek] = useState(false);
  // Only gates the very first render -- a save-triggered refresh (e.g.
  // after saveDay's onBlur commit) must not flash the whole page away and
  // back, which would drop focus and discard whatever's mid-edit.
  const [initialLoading, setInitialLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    if (!profile) return;
    setError("");
    try {
      const [weekEntries, freezeStatus, recent] = await Promise.all([
        getWeekEntries(profile.id, weekStart),
        getWeekFreezeStatus(weekStart),
        getRecentDailyEntries(profile.id),
      ]);

      const hasAnyDaily = weekEntries.some((e) => e.entry_kind === "daily");
      if (!hasAnyDaily && !freezeStatus?.frozen_at) {
        const copied = await copyFromPreviousWeek(profile.id, weekStart);
        if (copied) {
          setCopiedFromLastWeek(true);
          setEntries(await getWeekEntries(profile.id, weekStart));
          setFreeze(freezeStatus);
          setRecentEntries(recent);
          return;
        }
      }

      setCopiedFromLastWeek(false);
      setEntries(weekEntries);
      setFreeze(freezeStatus);
      setRecentEntries(recent);
    } catch (err) {
      setError(err.message || String(err));
    } finally {
      setInitialLoading(false);
    }
  }, [profile, weekStart]);

  useEffect(() => {
    load();
  }, [load]);

  function refresh() {
    load();
  }

  const dailyByDate = Object.fromEntries(entries.filter((e) => e.entry_kind === "daily").map((e) => [e.work_date, e]));
  const adjustments = entries.filter((e) => e.entry_kind === "adjustment");
  const weekTotal = entries.reduce((sum, e) => sum + Number(e.daily_total || 0), 0);
  const isFrozen = !!freeze?.frozen_at;

  async function saveDay(workDate, morningHours, afternoonHours, notes) {
    setSaving(true);
    setError("");
    try {
      await upsertDailyEntry({ profileId: profile.id, workDate, morningHours, afternoonHours, notes });
      refresh();
    } catch (err) {
      setError(err.message || String(err));
    } finally {
      setSaving(false);
    }
  }

  async function addCorrection({ correctsEntryId, workDate, adjustmentHours, reason }) {
    setSaving(true);
    setError("");
    try {
      await insertAdjustment({ profileId: profile.id, correctsEntryId, workDate, enteredWeekStart: weekStart, adjustmentHours, reason });
      refresh();
    } catch (err) {
      setError(err.message || String(err));
    } finally {
      setSaving(false);
    }
  }

  return {
    weekStart, setWeekStart,
    days: weekDates(weekStart),
    dailyByDate, adjustments, weekTotal,
    isFrozen, frozenByName: freeze?.frozen_by_profile?.display_name,
    copiedFromLastWeek,
    recentEntries,
    initialLoading, saving, error,
    saveDay, addCorrection, refresh,
  };
}
