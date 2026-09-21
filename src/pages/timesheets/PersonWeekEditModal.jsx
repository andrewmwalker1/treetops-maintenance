import { useEffect, useState } from "react";
import { colors } from "../../lib/theme.js";
import { getWeekEntries, getWeekNote, saveWeekNote, upsertDailyEntry } from "../../lib/timesheetQueries.js";
import { Alert, Button, Input, Modal, Textarea } from "../../ui/index.js";
import { DAY_LABELS, weekDates } from "./weekMath.js";

// The one place office-on-behalf entry actually happens: every day of one
// person's week in a single deliberate action, opened from the admin
// grid's per-row edit icon rather than the grid's day cells themselves
// being clickable (kept read-only so editing can't happen from an
// accidental click while scanning the grid).
export default function PersonWeekEditModal({ profileId, profileName, weekStart, onClose, onSaved }) {
  const [values, setValues] = useState(null); // { [date]: { morning, afternoon } }
  const [weekNote, setWeekNote] = useState("");
  const [savedWeekNote, setSavedWeekNote] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    Promise.all([getWeekEntries(profileId, weekStart), getWeekNote(profileId, weekStart)])
      .then(([entries, note]) => {
        if (cancelled) return;
        const byDate = Object.fromEntries(entries.filter((e) => e.entry_kind === "daily").map((e) => [e.work_date, e]));
        const initial = {};
        weekDates(weekStart).forEach((date) => {
          initial[date] = {
            morning: byDate[date]?.morning_hours ?? "",
            afternoon: byDate[date]?.afternoon_hours ?? "",
          };
        });
        setValues(initial);
        setWeekNote(note);
        setSavedWeekNote(note);
      })
      .catch((err) => setError(err.message || String(err)))
      .finally(() => setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [profileId, weekStart]);

  function setField(date, field, value) {
    setValues((prev) => ({ ...prev, [date]: { ...prev[date], [field]: value } }));
  }

  async function handleSave() {
    setSaving(true);
    setError("");
    try {
      for (const date of weekDates(weekStart)) {
        const { morning, afternoon } = values[date];
        await upsertDailyEntry({ profileId, workDate: date, morningHours: morning, afternoonHours: afternoon });
      }
      if (weekNote !== savedWeekNote) await saveWeekNote(profileId, weekStart, weekNote);
      onSaved();
      onClose();
    } catch (err) {
      setError(err.message || String(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal title={`Edit ${profileName}'s week`} onClose={onClose} maxWidth="440px">
      <div style={{ padding: 20 }}>
        {error && <Alert tone="danger" title="Something went wrong">{error}</Alert>}
        {loading || !values ? (
          <p style={{ color: colors.inkSoft }}>Loading…</p>
        ) : (
          weekDates(weekStart).map((date, i) => (
            <div key={date} style={{ marginBottom: 10 }}>
              <div style={{ display: "grid", gridTemplateColumns: "90px 70px 40px 70px", gap: 8, alignItems: "center" }}>
                <span style={{ fontSize: "var(--text-sm)", fontWeight: 600 }}>{DAY_LABELS[i]}</span>
                <Input
                  type="number" step="0.25" min="0" placeholder="0"
                  value={values[date].morning}
                  onChange={(e) => setField(date, "morning", e.target.value)}
                />
                <span style={{ textAlign: "center", fontSize: "var(--text-xs)", color: colors.inkSoft }}>lunch</span>
                <Input
                  type="number" step="0.25" min="0" placeholder="0"
                  value={values[date].afternoon}
                  onChange={(e) => setField(date, "afternoon", e.target.value)}
                />
              </div>
            </div>
          ))
        )}
        {!loading && values && (
          <div style={{ marginTop: 12 }}>
            <span style={{ display: "block", fontSize: "var(--text-sm)", fontWeight: 600, color: colors.inkSoft, marginBottom: 4 }}>Notes for the week (optional)</span>
            <Textarea rows={3} value={weekNote} onChange={(e) => setWeekNote(e.target.value)} />
          </div>
        )}
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 16 }}>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" disabled={saving || loading} onClick={handleSave}>{saving ? "Saving…" : "Save"}</Button>
        </div>
      </div>
    </Modal>
  );
}
