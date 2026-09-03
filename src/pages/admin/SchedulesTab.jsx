import { useEffect, useState } from "react";
import { RRule } from "rrule";
import { useAuth } from "../../lib/AuthContext.jsx";
import { supabase } from "../../lib/supabaseClient.js";
import { colors, text, space, priorityBarStyle } from "../../lib/theme.js";
import { Alert, Button, Card, EmptyState, Input, PageHeader, Select, Textarea } from "../../ui/index.js";
import PitchPicker from "../../components/PitchPicker.jsx";


const WEEKDAYS = [
  { code: "MO", label: "Mon" },
  { code: "TU", label: "Tue" },
  { code: "WE", label: "Wed" },
  { code: "TH", label: "Thu" },
  { code: "FR", label: "Fri" },
  { code: "SA", label: "Sat" },
  { code: "SU", label: "Sun" },
];

const FREQ_BY_NAME = { daily: RRule.DAILY, weekly: RRule.WEEKLY, monthly: RRule.MONTHLY };
const NAME_BY_FREQ = { [RRule.DAILY]: "daily", [RRule.WEEKLY]: "weekly", [RRule.MONTHLY]: "monthly" };

const MONTHLY_POSITIONS = [
  { value: "1", label: "First" },
  { value: "2", label: "Second" },
  { value: "3", label: "Third" },
  { value: "4", label: "Fourth" },
  { value: "-1", label: "Last" },
];

const blank = {
  id: null,
  description: "",
  jobTypeId: "",
  siteId: "",
  priority: "medium",
  assigneeKind: "person", // person | group
  assigneeId: "",
  locationKind: "none", // pitch | area | none
  locationId: "",
  areaName: "",
  activityTypeIds: [],
  frequency: "weekly",
  interval: 1,
  weekdays: [],
  monthlyMode: "monthday", // monthday | weekday -- e.g. "the 15th" vs "the last Friday"
  monthday: "",
  monthlyPosition: "1",
  monthlyWeekday: "",
  startDate: new Date().toISOString().slice(0, 10),
  leadInDays: 0,
};

function buildRule(form) {
  const options = {
    freq: FREQ_BY_NAME[form.frequency],
    interval: Number(form.interval) || 1,
    dtstart: new Date(`${form.startDate}T00:00:00Z`),
  };
  if (form.frequency === "weekly" && form.weekdays.length > 0) {
    options.byweekday = form.weekdays.map((code) => RRule[code]);
  }
  if (form.frequency === "monthly") {
    if (form.monthlyMode === "weekday" && form.monthlyWeekday) {
      // .nth(-1) etc encodes the position directly into the BYDAY token
      // (e.g. "-1FR" for "the last Friday"), rather than a separate
      // BYSETPOS -- the standard iCal form for a single nth-weekday rule.
      options.byweekday = [RRule[form.monthlyWeekday].nth(Number(form.monthlyPosition))];
    } else if (form.monthday) {
      options.bymonthday = [Number(form.monthday)];
    }
  }
  return new RRule(options).toString();
}

function parseRule(rruleText) {
  const { options } = RRule.fromString(rruleText);
  // rrule stores a plain "BYDAY=FR" as options.byweekday (Weekday objects
  // or plain numbers), but a positioned "BYDAY=-1FR" as a completely
  // separate options.bynweekday ([weekday, n] pairs) -- byweekday is null
  // in that case, not populated with a Weekday carrying an .n property.
  const nthEntry = options.freq === RRule.MONTHLY ? (options.bynweekday || [])[0] : null;

  return {
    frequency: NAME_BY_FREQ[options.freq] || "weekly",
    interval: options.interval || 1,
    startDate: options.dtstart.toISOString().slice(0, 10),
    weekdays: options.freq === RRule.WEEKLY
      ? (options.byweekday || []).map((wd) => WEEKDAYS[typeof wd === "number" ? wd : wd.weekday].code)
      : [],
    monthlyMode: nthEntry ? "weekday" : "monthday",
    monthday: (options.bymonthday || [])[0] || "",
    monthlyPosition: nthEntry ? String(nthEntry[1]) : "1",
    monthlyWeekday: nthEntry ? WEEKDAYS[nthEntry[0]].code : "",
  };
}

function describeRule(rruleText) {
  try {
    return RRule.fromString(rruleText).toText();
  } catch {
    return rruleText;
  }
}

export default function SchedulesTab() {
  const { org, profile, terminology } = useAuth();
  const [schedules, setSchedules] = useState([]);
  const [jobTypes, setJobTypes] = useState([]);
  const [sites, setSites] = useState([]);
  const [people, setPeople] = useState([]);
  const [groups, setGroups] = useState([]);
  const [activityTypes, setActivityTypes] = useState([]);
  const [pitches, setPitches] = useState([]);
  const [areas, setAreas] = useState([]);
  const [form, setForm] = useState(blank);
  const [error, setError] = useState(null);

  function refresh() {
    Promise.all([
      supabase
        .from("schedules")
        .select(
          "id, job_type_id, site_id, rrule, lead_in_days, last_generated_date, is_active, description, priority, assignee_profile_id, assignee_group_id, pitch_id, area_id, job_types(name), pitches(pitch_number_or_name), areas(name), schedule_task_types(task_type_id)"
        )
        .eq("org_id", org.id),
      supabase.from("job_types").select("id, name").eq("org_id", org.id),
      supabase.from("sites").select("id, name").eq("org_id", org.id),
      supabase.from("profiles").select("id, display_name").eq("org_id", org.id),
      supabase.from("groups").select("id, name").eq("org_id", org.id),
      supabase.from("task_types").select("id, name").eq("org_id", org.id),
    ]).then(([{ data: s, error: err }, { data: jt }, { data: st }, { data: p }, { data: g }, { data: at }]) => {
      if (err) setError(err.message);
      else setSchedules(s || []);
      setJobTypes(jt || []);
      setSites(st || []);
      setPeople(p || []);
      setGroups(g || []);
      setActivityTypes(at || []);
      setForm((f) => (f.siteId ? f : { ...f, siteId: st?.[0]?.id || "" }));
    });
  }

  useEffect(refresh, [org]);

  // Pitches/areas are site-scoped, so they follow whichever site is
  // currently picked in the form rather than being loaded once for org.
  useEffect(() => {
    if (!form.siteId) {
      setPitches([]);
      setAreas([]);
      return;
    }
    supabase.from("pitches").select("id, pitch_number_or_name").eq("site_id", form.siteId).then(({ data }) => setPitches(data || []));
    supabase.from("areas").select("id, name").eq("site_id", form.siteId).then(({ data }) => setAreas(data || []));
  }, [form.siteId]);

  function toggleWeekday(code) {
    setForm((f) => ({
      ...f,
      weekdays: f.weekdays.includes(code) ? f.weekdays.filter((c) => c !== code) : [...f.weekdays, code],
    }));
  }

  function toggleActivityType(id) {
    setForm((f) => ({
      ...f,
      activityTypeIds: f.activityTypeIds.includes(id) ? f.activityTypeIds.filter((x) => x !== id) : [...f.activityTypeIds, id],
    }));
  }

  function handleJobTypeChange(newJobTypeId) {
    const jobType = jobTypes.find((jt) => jt.id === newJobTypeId);
    setForm((f) => ({
      ...f,
      jobTypeId: newJobTypeId,
      // Don't clobber a description the user has already started typing --
      // same rule as the one-off New Job form.
      description: f.description.trim() ? f.description : jobType?.name || f.description,
    }));
  }

  function editSchedule(s) {
    setForm({
      id: s.id,
      description: s.description || "",
      jobTypeId: s.job_type_id || "",
      siteId: s.site_id,
      priority: s.priority || "medium",
      assigneeKind: s.assignee_group_id ? "group" : "person",
      assigneeId: s.assignee_profile_id || s.assignee_group_id || "",
      locationKind: s.pitch_id ? "pitch" : s.area_id ? "area" : "none",
      locationId: s.pitch_id || "",
      areaName: s.areas?.name || "",
      activityTypeIds: (s.schedule_task_types || []).map((link) => link.task_type_id),
      leadInDays: s.lead_in_days,
      ...parseRule(s.rrule),
    });
  }

  async function handleSave(e) {
    e.preventDefault();
    setError(null);

    if (!form.description.trim()) {
      setError("Description is required.");
      return;
    }
    if (form.frequency === "weekly" && form.weekdays.length === 0) {
      setError("Pick at least one day of the week.");
      return;
    }
    if (form.frequency === "monthly" && form.monthlyMode === "monthday" && !form.monthday) {
      setError("Pick a day of the month.");
      return;
    }
    if (form.frequency === "monthly" && form.monthlyMode === "weekday" && !form.monthlyWeekday) {
      setError("Pick a weekday.");
      return;
    }

    // Areas are free text (see NewJob.jsx) -- resolve the typed name to an
    // existing area for this site, or create a new one.
    let areaId = null;
    if (form.locationKind === "area" && form.areaName.trim()) {
      const trimmed = form.areaName.trim();
      const existing = areas.find((a) => a.name.toLowerCase() === trimmed.toLowerCase());
      if (existing) {
        areaId = existing.id;
      } else {
        const { data: newArea, error: areaError } = await supabase
          .from("areas")
          .insert({ site_id: form.siteId, name: trimmed, created_by: profile.id })
          .select()
          .single();
        if (areaError) {
          setError("Failed to save the new area: " + areaError.message);
          return;
        }
        areaId = newArea.id;
        setAreas((prev) => [...prev, newArea]);
      }
    }

    const payload = {
      org_id: org.id,
      site_id: form.siteId,
      job_type_id: form.jobTypeId || null,
      description: form.description.trim(),
      priority: form.priority,
      assignee_profile_id: form.assigneeKind === "person" && form.assigneeId ? form.assigneeId : null,
      assignee_group_id: form.assigneeKind === "group" && form.assigneeId ? form.assigneeId : null,
      pitch_id: form.locationKind === "pitch" && form.locationId ? form.locationId : null,
      area_id: areaId,
      rrule: buildRule(form),
      lead_in_days: Number(form.leadInDays) || 0,
    };
    const { data: saved, error: err } = form.id
      ? await supabase.from("schedules").update(payload).eq("id", form.id).select("id").single()
      : await supabase.from("schedules").insert(payload).select("id").single();
    if (err) {
      setError(err.message);
      return;
    }

    // Replace the schedule's activity-type links wholesale rather than
    // diffing -- same approach as job template checklists, simplest thing
    // that's correct for a handful of rows.
    const { error: clearError } = await supabase.from("schedule_task_types").delete().eq("schedule_id", saved.id);
    if (clearError) console.error("Failed to clear previous activity types", clearError);
    if (form.activityTypeIds.length > 0) {
      const { error: activityError } = await supabase
        .from("schedule_task_types")
        .insert(form.activityTypeIds.map((task_type_id) => ({ schedule_id: saved.id, task_type_id })));
      if (activityError) console.error("Failed to save activity types", activityError);
    }

    setForm({ ...blank, siteId: form.siteId });
    refresh();
  }

  async function handleDelete(id) {
    const { error: err } = await supabase.from("schedules").delete().eq("id", id);
    if (err) setError(err.message);
    else refresh();
  }

  async function handleToggleActive(s) {
    const resuming = !s.is_active;
    const payload = { is_active: resuming };
    if (resuming) {
      // Resume from the next due occurrence, not a backlog burst of every
      // occurrence missed while paused -- see generate-scheduled-jobs'
      // comment on last_generated_date.
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      payload.last_generated_date = yesterday.toISOString().slice(0, 10);
    }
    const { error: err } = await supabase.from("schedules").update(payload).eq("id", s.id);
    if (err) setError(err.message);
    else refresh();
  }

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-5)" }}>
      <div>
        <PageHeader title="Recurring jobs" level={2} />
        {schedules.map((s) => (
          <Card pad="sm" key={s.id} style={{ marginBottom: "var(--space-2)", display: "flex", gap: "var(--space-3)", justifyContent: "space-between", alignItems: "center", opacity: s.is_active ? 1 : 0.6 }}>
            <div style={priorityBarStyle(s.priority)} />
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 600 }}>
                {s.description || s.job_types?.name || "Untitled"}
                {!s.is_active && (
                  <span style={{ marginLeft: "var(--space-2)", fontSize: "var(--text-xs)", fontWeight: 700, color: colors.inkSoft, border: `1px solid ${colors.lineStrong}`, borderRadius: "var(--radius-full)", padding: "var(--space-1) var(--space-2)" }}>
                    PAUSED
                  </span>
                )}
              </div>
              <div style={{ fontSize: "var(--text-xs)", color: colors.inkSoft }}>
                {describeRule(s.rrule)} · {s.lead_in_days} day lead-in
                {s.last_generated_date ? ` · last created ${s.last_generated_date}` : " · never generated yet"}
              </div>
              <div style={{ fontSize: "var(--text-xs)", color: colors.inkSoft }}>
                {s.assignee_profile_id
                  ? `Assigned to ${people.find((p) => p.id === s.assignee_profile_id)?.display_name || "—"}`
                  : s.assignee_group_id
                    ? `Assigned to ${groups.find((g) => g.id === s.assignee_group_id)?.name || "—"} (group)`
                    : "Unassigned"}
                {(s.pitches?.pitch_number_or_name || s.areas?.name) && ` · ${s.pitches ? `${terminology.pitch || "Pitch"} ${s.pitches.pitch_number_or_name}` : s.areas.name}`}
              </div>
            </div>
            <div style={{ display: "flex", gap: "var(--space-2)" }}>
              <Button onClick={() => handleToggleActive(s)}>{s.is_active ? "Pause" : "Resume"}</Button>
              <Button onClick={() => editSchedule(s)}>Edit</Button>
              <Button variant="danger" onClick={() => handleDelete(s.id)}>Delete</Button>
            </div>
          </Card>
        ))}
        {schedules.length === 0 && <EmptyState title="No recurring jobs set up yet" />}
      </div>

      <div>
        <PageHeader title={form.id ? "Edit recurring job" : "New recurring job"} level={2} />
        <Card as="form" pad="md" onSubmit={handleSave}>
          <label className="tt-field__label">Job template (optional)</label>
          <Select value={form.jobTypeId} onChange={(e) => handleJobTypeChange(e.target.value)} style={{ marginBottom: "var(--space-3)" }}>
            <option value="">—</option>
            {jobTypes.map((jt) => (
              <option key={jt.id} value={jt.id}>{jt.name}</option>
            ))}
          </Select>

          <label className="tt-field__label">Description</label>
          <Textarea required value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2} style={{ marginBottom: "var(--space-3)" }} />

          {sites.length > 1 && (
            <Select required value={form.siteId} onChange={(e) => setForm({ ...form, siteId: e.target.value })} style={{ marginBottom: "var(--space-3)" }}>
              <option value="">Site</option>
              {sites.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </Select>
          )}

          <label className="tt-field__label">Priority</label>
          <Select value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })} style={{ marginBottom: "var(--space-3)" }}>
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
            <option value="immediate">Immediate</option>
          </Select>

          <label className="tt-field__label">Activity types (optional)</label>
          <div
            style={{
              border: `1px solid ${colors.lineStrong}`,
              borderRadius: "var(--radius-sm)",
              padding: "var(--space-3)",
              marginBottom: "var(--space-3)",
            }}
          >
            {activityTypes.length === 0 && <span style={{ color: colors.inkSoft, fontSize: "var(--text-base)" }}>None set up yet.</span>}
            {activityTypes.map((a) => (
              <label key={a.id} style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", padding: "var(--space-1) 0", fontSize: "var(--text-base)" }}>
                <input type="checkbox" checked={form.activityTypeIds.includes(a.id)} onChange={() => toggleActivityType(a.id)} />
                {a.name}
              </label>
            ))}
          </div>

          <label className="tt-field__label">Assign to</label>
          <div style={{ display: "flex", gap: "var(--space-3)", marginBottom: "var(--space-3)" }}>
            <label><input type="radio" checked={form.assigneeKind === "person"} onChange={() => setForm({ ...form, assigneeKind: "person", assigneeId: "" })} /> Person</label>
            <label><input type="radio" checked={form.assigneeKind === "group"} onChange={() => setForm({ ...form, assigneeKind: "group", assigneeId: "" })} /> Group</label>
          </div>
          <Select value={form.assigneeId} onChange={(e) => setForm({ ...form, assigneeId: e.target.value })} style={{ marginBottom: "var(--space-3)" }}>
            <option value="">Unassigned</option>
            {(form.assigneeKind === "person" ? people : groups).map((item) => (
              <option key={item.id} value={item.id}>{item.display_name || item.name}</option>
            ))}
          </Select>

          <label className="tt-field__label">Location</label>
          <div style={{ display: "flex", gap: "var(--space-3)", marginBottom: "var(--space-3)" }}>
            <label><input type="radio" checked={form.locationKind === "pitch"} onChange={() => setForm({ ...form, locationKind: "pitch", locationId: "", areaName: "" })} /> {terminology.pitch || "Pitch"}</label>
            <label><input type="radio" checked={form.locationKind === "area"} onChange={() => setForm({ ...form, locationKind: "area", locationId: "", areaName: "" })} /> {terminology.area || "Area"}</label>
            <label><input type="radio" checked={form.locationKind === "none"} onChange={() => setForm({ ...form, locationKind: "none", locationId: "", areaName: "" })} /> None</label>
          </div>
          {form.locationKind === "pitch" && (
            <PitchPicker pitches={pitches} value={form.locationId} onChange={(id) => setForm({ ...form, locationId: id })} style={{ marginBottom: "var(--space-3)" }} />
          )}
          {form.locationKind === "area" && (
            <>
              <Input list="schedule-area-suggestions" value={form.areaName} onChange={(e) => setForm({ ...form, areaName: e.target.value })} placeholder={`Type a ${(terminology.area || "area").toLowerCase()} name…`} style={{ marginBottom: "var(--space-3)" }} />
              <datalist id="schedule-area-suggestions">
                {areas.map((a) => (
                  <option key={a.id} value={a.name} />
                ))}
              </datalist>
            </>
          )}

          <label style={{ display: "block", fontSize: "var(--text-sm)", fontWeight: 600, color: colors.inkSoft, marginBottom: "var(--space-2)" }}>Repeats</label>
          <div style={{ display: "flex", gap: "var(--space-2)", marginBottom: "var(--space-3)" }}>
            <Select value={form.frequency} onChange={(e) => setForm({ ...form, frequency: e.target.value })} style={{ flex: 1 }}>
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
            </Select>
            <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", whiteSpace: "nowrap", fontSize: "var(--text-sm)", color: colors.inkSoft }}>
              every
              <Input type="number" min="1" value={form.interval} onChange={(e) => setForm({ ...form, interval: e.target.value })} />
              {form.frequency === "daily" ? "day(s)" : form.frequency === "weekly" ? "week(s)" : "month(s)"}
            </div>
          </div>

          {form.frequency === "weekly" && (
            <div style={{ display: "flex", gap: "var(--space-2)", marginBottom: "var(--space-3)", flexWrap: "wrap" }}>
              {WEEKDAYS.map((wd) => (
                <label key={wd.code} style={{ display: "flex", alignItems: "center", gap: "var(--space-1)", fontSize: "var(--text-sm)" }}>
                  <input type="checkbox" checked={form.weekdays.includes(wd.code)} onChange={() => toggleWeekday(wd.code)} />
                  {wd.label}
                </label>
              ))}
            </div>
          )}

          {form.frequency === "monthly" && (
            <>
              <div style={{ display: "flex", gap: "var(--space-4)", marginBottom: "var(--space-3)" }}>
                <label style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", fontSize: "var(--text-sm)" }}>
                  <input type="radio" checked={form.monthlyMode === "monthday"} onChange={() => setForm({ ...form, monthlyMode: "monthday" })} />
                  On a day of the month
                </label>
                <label style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", fontSize: "var(--text-sm)" }}>
                  <input type="radio" checked={form.monthlyMode === "weekday"} onChange={() => setForm({ ...form, monthlyMode: "weekday" })} />
                  On a weekday
                </label>
              </div>

              {form.monthlyMode === "monthday" ? (
                <Input type="number" min="1" max="31" placeholder="Day of month (1-31)" value={form.monthday} onChange={(e) => setForm({ ...form, monthday: e.target.value })} style={{ marginBottom: "var(--space-3)" }} />
              ) : (
                <div style={{ display: "flex", gap: "var(--space-2)", marginBottom: "var(--space-3)" }}>
                  <Select value={form.monthlyPosition} onChange={(e) => setForm({ ...form, monthlyPosition: e.target.value })} style={{ flex: 1 }}>
                    {MONTHLY_POSITIONS.map((p) => (
                      <option key={p.value} value={p.value}>{p.label}</option>
                    ))}
                  </Select>
                  <Select value={form.monthlyWeekday} onChange={(e) => setForm({ ...form, monthlyWeekday: e.target.value })} style={{ flex: 1 }}>
                    <option value="">Weekday</option>
                    {WEEKDAYS.map((wd) => (
                      <option key={wd.code} value={wd.code}>{wd.label}</option>
                    ))}
                  </Select>
                </div>
              )}
            </>
          )}

          <label className="tt-field__label">Starts on</label>
          <Input type="date" required value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} style={{ marginBottom: "var(--space-3)" }} />

          <label className="tt-field__label">Lead-in days (create the job this many days before it's due)</label>
          <Input type="number" min="0" value={form.leadInDays} onChange={(e) => setForm({ ...form, leadInDays: e.target.value })} style={{ marginBottom: "var(--space-3)" }} />

          {error && (
            <Alert tone="danger" title="Something went wrong">
              {error}
            </Alert>
          )}

          <div style={{ display: "flex", gap: "var(--space-2)", marginTop: "var(--space-4)" }}>
            <Button variant="primary" type="submit">{form.id ? "Save changes" : "Create recurring job"}</Button>
            {form.id && <Button onClick={() => setForm({ ...blank, siteId: form.siteId })}>Cancel</Button>}
          </div>
        </Card>
      </div>
    </div>
  );
}
