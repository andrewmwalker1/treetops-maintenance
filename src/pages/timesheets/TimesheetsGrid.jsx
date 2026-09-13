// Lives under Office Hub, not Admin -- this is day-to-day payroll
// operations (view hours, enter on someone's behalf, freeze/unfreeze a
// week), not a settings screen. Admin (Roles & Permissions) is still
// where can_submit_timesheet/can_manage_timesheets get assigned to roles.
import { useCallback, useEffect, useState } from "react";
import { useAuth } from "../../lib/AuthContext.jsx";
import {
  freezeWeek, getSubmittableProfiles, getWeekEntriesForProfiles, getWeekFreezeStatus, movePersonOrder, unfreezeWeek,
} from "../../lib/timesheetQueries.js";
import { colors } from "../../lib/theme.js";
import { Alert, Button, Card, IconArrowDown, IconArrowUp, IconButton, IconEdit, PageHeader } from "../../ui/index.js";
import FixedHoursSection from "./FixedHoursSection.jsx";
import PersonWeekEditModal from "./PersonWeekEditModal.jsx";
import { addWeeks, DAY_LABELS, formatShortDate, formatWeekLabel, mondayOf, todayIso, weekDates } from "./weekMath.js";

export default function TimesheetsGrid() {
  const { org } = useAuth();
  const [weekStart, setWeekStart] = useState(() => mondayOf(todayIso()));
  const [people, setPeople] = useState([]);
  const [entries, setEntries] = useState([]);
  const [freeze, setFreeze] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [editingProfile, setEditingProfile] = useState(null); // { id, displayName } or null
  const [openAdjustmentsFor, setOpenAdjustmentsFor] = useState(null); // profile id or null

  const refresh = useCallback(() => {
    if (!org) return;
    setLoading(true);
    setError("");
    getSubmittableProfiles()
      .then((profiles) => {
        setPeople(profiles);
        return getWeekEntriesForProfiles(profiles.map((p) => p.id), weekStart);
      })
      .then(setEntries)
      .catch((err) => setError(err.message || String(err)))
      .finally(() => setLoading(false));
    getWeekFreezeStatus(weekStart)
      .then(setFreeze)
      .catch((err) => setError(err.message || String(err)));
  }, [org, weekStart]);

  useEffect(refresh, [refresh]);

  const isFrozen = !!freeze?.frozen_at;
  const days = weekDates(weekStart);

  const entriesByProfile = {};
  for (const e of entries) {
    (entriesByProfile[e.profile_id] ||= []).push(e);
  }

  async function handleFreeze() {
    if (!window.confirm(`Freeze ${formatWeekLabel(weekStart)}? Team members won't be able to edit their own hours after this.`)) return;
    try {
      await freezeWeek(weekStart);
      refresh();
    } catch (err) {
      setError(err.message || String(err));
    }
  }

  async function handleUnfreeze() {
    if (!window.confirm(`Unfreeze ${formatWeekLabel(weekStart)}?`)) return;
    try {
      await unfreezeWeek(weekStart);
      refresh();
    } catch (err) {
      setError(err.message || String(err));
    }
  }

  async function handleMove(index, direction) {
    setError("");
    try {
      const reorderedIds = await movePersonOrder(org.id, people.map((p) => p.id), index, direction);
      setPeople(reorderedIds.map((id) => people.find((p) => p.id === id)));
    } catch (err) {
      setError(err.message || String(err));
    }
  }

  return (
    <div>
      <PageHeader title="Timesheets" level={2} />
      <Card pad="md">
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14, flexWrap: "wrap", gap: 10 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <Button onClick={() => setWeekStart((w) => addWeeks(w, -1))}>← Previous week</Button>
            <h2 style={{ fontSize: 16, margin: 0, color: colors.mossDark }}>{formatWeekLabel(weekStart)}</h2>
            <Button onClick={() => setWeekStart((w) => addWeeks(w, 1))}>Next week →</Button>
          </div>
          {isFrozen ? (
            <Button variant="danger" onClick={handleUnfreeze}>Unfreeze</Button>
          ) : (
            <Button variant="primary" onClick={handleFreeze}>🔒 Freeze week</Button>
          )}
        </div>

        {isFrozen && (
          <Alert tone="warn" title="This week is frozen">
            {freeze?.frozen_by_profile?.display_name ? `Frozen by ${freeze.frozen_by_profile.display_name}.` : "Frozen."} You can still make changes here — they'll be logged.
          </Alert>
        )}
        {error && <Alert tone="danger" title="Something went wrong">{error}</Alert>}

        {!loading && people.length === 0 && (
          <p style={{ color: colors.inkSoft, fontSize: "var(--text-sm)" }}>
            No one has can_submit_timesheet enabled yet — turn it on for the relevant roles in Roles &amp; Permissions.
          </p>
        )}

        {people.length > 0 && (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "var(--text-sm)" }}>
              <thead>
                <tr>
                  <th style={{ width: 76 }}></th>
                  <th style={{ textAlign: "left", padding: "6px", color: colors.inkSoft, fontSize: "var(--text-xs)", textTransform: "uppercase", letterSpacing: "0.04em" }}>Name</th>
                  {DAY_LABELS.map((d) => (
                    <th key={d} style={{ padding: "6px", color: colors.inkSoft, fontSize: "var(--text-xs)", textTransform: "uppercase", letterSpacing: "0.04em" }}>{d.slice(0, 3)}</th>
                  ))}
                  <th style={{ padding: "6px", color: colors.inkSoft, fontSize: "var(--text-xs)", textTransform: "uppercase", letterSpacing: "0.04em" }}>Adj.</th>
                  <th style={{ textAlign: "right", padding: "6px", color: colors.inkSoft, fontSize: "var(--text-xs)", textTransform: "uppercase", letterSpacing: "0.04em" }}>Total</th>
                </tr>
              </thead>
              <tbody>
                {people.map((person, i) => {
                  const personEntries = entriesByProfile[person.id] || [];
                  const dailyByDate = Object.fromEntries(personEntries.filter((e) => e.entry_kind === "daily").map((e) => [e.work_date, e]));
                  const adjustments = personEntries.filter((e) => e.entry_kind === "adjustment");
                  const adjustmentTotal = adjustments.reduce((sum, a) => sum + Number(a.adjustment_hours || 0), 0);
                  const weekTotal = personEntries.reduce((sum, e) => sum + Number(e.daily_total || 0), 0);
                  return (
                    <tr key={person.id} style={{ borderTop: `1px solid ${colors.line}` }}>
                      <td style={{ padding: "4px 6px", whiteSpace: "nowrap" }}>
                        <IconButton size="sm" label="Move up" disabled={i === 0} onClick={() => handleMove(i, -1)}><IconArrowUp size={14} /></IconButton>
                        <IconButton size="sm" label="Move down" disabled={i === people.length - 1} onClick={() => handleMove(i, 1)}><IconArrowDown size={14} /></IconButton>
                        <IconButton size="sm" label={`Edit ${person.displayName}'s week`} onClick={() => setEditingProfile(person)}><IconEdit size={14} /></IconButton>
                      </td>
                      <td style={{ padding: "6px" }}>{person.displayName}</td>
                      {days.map((date) => {
                        const total = dailyByDate[date]?.daily_total;
                        return (
                          <td key={date} style={{ padding: "6px", textAlign: "center", color: total ? colors.ink : colors.inkSoft }}>
                            {total || "—"}
                          </td>
                        );
                      })}
                      <td style={{ padding: "6px", textAlign: "center" }}>
                        {adjustments.length > 0 ? (
                          <Button
                            onClick={() => setOpenAdjustmentsFor(openAdjustmentsFor === person.id ? null : person.id)}
                            style={{ fontSize: "var(--text-xs)", padding: "2px 8px", color: colors.warnInk, borderColor: colors.warnBorder }}
                          >
                            {adjustmentTotal > 0 ? "+" : ""}{adjustmentTotal}
                          </Button>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td style={{ padding: "6px", textAlign: "right", fontWeight: 600 }}>{weekTotal || 0}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {openAdjustmentsFor && (
          <div style={{ marginTop: 14, background: colors.warnSurface, border: `1px solid ${colors.warnBorder}`, color: colors.warnInk, borderRadius: "var(--radius-sm)", padding: 12, fontSize: "var(--text-sm)" }}>
            {(entriesByProfile[openAdjustmentsFor] || [])
              .filter((e) => e.entry_kind === "adjustment")
              .map((a) => (
                <div key={a.id}>
                  {people.find((p) => p.id === openAdjustmentsFor)?.displayName} — corrects {formatShortDate(a.work_date)}: {a.adjustment_hours > 0 ? "+" : ""}{a.adjustment_hours} hrs — {a.adjustment_reason}
                </div>
              ))}
          </div>
        )}
      </Card>

      <FixedHoursSection weekStart={weekStart} />

      {editingProfile && (
        <PersonWeekEditModal
          profileId={editingProfile.id}
          profileName={editingProfile.displayName}
          weekStart={weekStart}
          onClose={() => setEditingProfile(null)}
          onSaved={refresh}
        />
      )}
    </div>
  );
}
