import { useEffect, useState, useCallback, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "../lib/AuthContext.jsx";
import { usePermissions } from "../lib/permissions.js";
import { supabase } from "../lib/supabaseClient.js";
import { capturePhoto } from "../platform/camera.js";
import { notifyJobAssigned } from "../lib/jobAssignmentNotify.js";
import { colors } from "../lib/theme.js";
import {
  Alert,
  Button,
  Card,
  Chip,
  EmptyState,
  Field,
  IconArrowLeft,
  Input,
  PageHeader,
  Select,
  SkeletonList,
  Table,
  Textarea,
} from "../ui/index.js";

const statusLabels = { in_service: "In service", monitor: "Monitor", faulty: "Faulty", in_repair: "In repair", scrapped: "Scrapped", decommissioned: "Decommissioned" };

// One shared vocabulary for every row in the combined history table below,
// whichever of the four source tables (equipment_checks/fault_reports/
// repair_records/equipment_monitor_events) it came from -- each gets its
// own colour so the table reads at a glance without needing a legend.
// monitor_events gets its own status (not folded into "repair") because a
// monitor flag isn't a repair -- nothing was fixed.
const HISTORY_STATUS = {
  pass: { label: "Pass", color: colors.mossDark },
  fail: { label: "Fail", color: colors.immediate },
  fault: { label: "Fault", color: colors.clay },
  repair: { label: "Repair", color: colors.moss },
  monitor: { label: "Monitoring", color: colors.gold },
  hours: { label: "Hours reading", color: colors.inkSoft },
};

const HISTORY_STATUS_CHIPS = [
  { key: "all", label: "All" },
  { key: "pass", label: "Pass" },
  { key: "fail", label: "Fail" },
  { key: "fault", label: "Fault" },
  { key: "repair", label: "Repair" },
  { key: "monitor", label: "Monitoring" },
  { key: "hours", label: "Hours reading" },
];

function formatDateTime(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  return `${d.toLocaleDateString("en-GB")} ${d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}`;
}

function oneMonthAgoISODate() {
  const d = new Date();
  d.setMonth(d.getMonth() - 1);
  return d.toISOString().slice(0, 10);
}

export default function EquipmentDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { profile } = useAuth();
  const permissions = usePermissions();
  const canManage = permissions.has("can_manage_equipment_status");

  const [equipment, setEquipment] = useState(null);
  const [checks, setChecks] = useState([]);
  const [faultReports, setFaultReports] = useState([]);
  const [repairs, setRepairs] = useState([]);
  const [monitorEvents, setMonitorEvents] = useState([]);
  const [hoursReadings, setHoursReadings] = useState([]);
  const [serviceTemplates, setServiceTemplates] = useState([]);
  const [appliedTemplateIds, setAppliedTemplateIds] = useState([]);
  const [tierStates, setTierStates] = useState([]);
  const [templateToApply, setTemplateToApply] = useState("");
  const [applyingTemplate, setApplyingTemplate] = useState(false);
  const [faultDescription, setFaultDescription] = useState("");
  const [repairNote, setRepairNote] = useState("");
  const [repairCost, setRepairCost] = useState("");
  const [repairVendor, setRepairVendor] = useState("");
  const [monitorNoteDraft, setMonitorNoteDraft] = useState("");
  const [pendingMonitorNote, setPendingMonitorNote] = useState(null); // non-null while prompting for a note after picking "Monitor" in the status dropdown
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState("checks");
  const [historyStatusFilter, setHistoryStatusFilter] = useState("all");
  const [historySort, setHistorySort] = useState({ field: "date", direction: "desc" });
  // Defaults to the last month so a machine with years of history doesn't
  // dump its whole log onto the page at once -- widen or clear the dates
  // to see further back.
  const [historyFrom, setHistoryFrom] = useState(oneMonthAgoISODate);
  const [historyTo, setHistoryTo] = useState("");

  const loadAll = useCallback(async () => {
    const [{ data: eq }, { data: checkRows }, { data: faultRows }, { data: repairRows }, { data: monitorRows }, { data: hoursRows }, { data: appliedRows }, { data: stateRows }] = await Promise.all([
      supabase
        .from("equipment")
        .select(
          "id, org_id, name, make, model, status, monitor_note, check_frequency_days, tracks_hours, hours_required, last_hours_reading, last_hours_reading_at, equipment_type:equipment_types(name, tracks_hours_default, hours_required_default)"
        )
        .eq("id", id)
        .single(),
      supabase.from("equipment_checks").select("id, checked_at, passed, checked_by:profiles(display_name)").eq("equipment_id", id).order("checked_at", { ascending: false }),
      supabase.from("fault_reports").select("id, description, created_at, reported_by:profiles!fault_reports_reported_by_fkey(display_name)").eq("equipment_id", id).order("created_at", { ascending: false }),
      supabase.from("repair_records").select("id, note, cost, vendor, repaired_at, repaired_by:profiles(display_name)").eq("equipment_id", id).order("repaired_at", { ascending: false }),
      supabase.from("equipment_monitor_events").select("id, note, event_type, created_at, created_by:profiles(display_name)").eq("equipment_id", id).order("created_at", { ascending: false }),
      supabase.from("equipment_hours_readings").select("id, hours_value, recorded_at, recorded_by:profiles(display_name)").eq("equipment_id", id).order("recorded_at", { ascending: false }),
      supabase.from("equipment_service_schedules").select("service_template_id, service_templates(name)").eq("equipment_id", id),
      supabase
        .from("equipment_service_tier_state")
        .select("id, next_due_hours, next_due_date, last_completed_at, tier:service_template_tiers(id, name, trigger_type, is_recurring, template:service_templates(name))")
        .eq("equipment_id", id),
    ]);
    setAppliedTemplateIds((appliedRows || []).map((r) => r.service_template_id));
    setTierStates(stateRows || []);
    if (eq?.org_id) {
      supabase.from("service_templates").select("id, name").eq("org_id", eq.org_id).order("name").then(({ data }) => setServiceTemplates(data || []));
    }
    setEquipment(eq || null);
    setMonitorNoteDraft(eq?.monitor_note || "");
    setChecks(checkRows || []);
    setFaultReports(faultRows || []);
    setRepairs(repairRows || []);
    setMonitorEvents(monitorRows || []);
    setHoursReadings(hoursRows || []);
  }, [id]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  // Checks, fault reports, and repairs are three separate tables with no FK
  // chaining a repair to the fault it fixed -- merging them into one
  // date-ordered list (rather than three separate views) is what actually
  // lets you read a failed check, the fault it prompted, and the repair
  // that followed in sequence, one table, like the admin checkout log.
  const combinedHistory = useMemo(() => {
    const rows = [
      ...checks.map((c) => ({
        id: `check-${c.id}`,
        status: c.passed ? "pass" : "fail",
        details: null,
        person: c.checked_by?.display_name,
        date: c.checked_at,
      })),
      ...faultReports.map((f) => ({
        id: `fault-${f.id}`,
        status: "fault",
        details: f.description,
        person: f.reported_by?.display_name,
        date: f.created_at,
      })),
      ...repairs.map((r) => ({
        id: `repair-${r.id}`,
        status: "repair",
        details: [r.note, r.vendor && `via ${r.vendor}`, r.cost != null && `£${r.cost}`].filter(Boolean).join(" · "),
        person: r.repaired_by?.display_name,
        date: r.repaired_at,
      })),
      ...monitorEvents.map((m) => ({
        id: `monitor-${m.id}`,
        status: "monitor",
        details: m.event_type === "cleared" ? `Cleared — ${m.note}` : m.event_type === "updated" ? `Updated — ${m.note}` : m.note,
        person: m.created_by?.display_name,
        date: m.created_at,
      })),
      ...hoursReadings.map((h) => ({
        id: `hours-${h.id}`,
        status: "hours",
        details: `${h.hours_value} hrs`,
        person: h.recorded_by?.display_name,
        date: h.recorded_at,
      })),
    ];
    return rows.sort((a, b) => new Date(b.date) - new Date(a.date));
  }, [checks, faultReports, repairs, monitorEvents, hoursReadings]);

  const filteredSortedHistory = useMemo(() => {
    let result = combinedHistory;
    if (historyStatusFilter !== "all") result = result.filter((r) => r.status === historyStatusFilter);
    if (historyFrom) {
      const from = new Date(historyFrom);
      result = result.filter((r) => r.date && new Date(r.date) >= from);
    }
    if (historyTo) {
      // End-of-day so a "to" date includes entries logged that day.
      const to = new Date(`${historyTo}T23:59:59.999`);
      result = result.filter((r) => r.date && new Date(r.date) <= to);
    }

    const dir = historySort.direction === "asc" ? 1 : -1;
    const getValue = (r) => {
      switch (historySort.field) {
        case "status":
          return HISTORY_STATUS[r.status].label;
        case "details":
          return r.details || "";
        case "person":
          return r.person || "";
        // Compared as an actual timestamp, not the raw string -- repairs
        // are logged with a client-generated `new Date().toISOString()`
        // (e.g. "...123Z") while checks/faults get Postgres's `now()`
        // default (e.g. "...123456+00:00"). Those two formats aren't
        // string-comparable: 'Z' sorts after digits, so a repair could
        // falsely rank "newer" than a check/fault from later the same
        // day, scrambling the fault-then-repair sequence this table
        // exists to show.
        default:
          return r.date ? new Date(r.date).getTime() : 0;
      }
    };
    return [...result].sort((a, b) => {
      const va = getValue(a);
      const vb = getValue(b);
      if (va < vb) return -1 * dir;
      if (va > vb) return 1 * dir;
      return 0;
    });
  }, [combinedHistory, historyStatusFilter, historyFrom, historyTo, historySort]);

  function toggleHistorySort(field) {
    setHistorySort((prev) => (prev.field === field ? { field, direction: prev.direction === "asc" ? "desc" : "asc" } : { field, direction: "asc" }));
  }

  function historySortIndicator(field) {
    if (historySort.field !== field) return "";
    return historySort.direction === "asc" ? " ↑" : " ↓";
  }

  async function applyTemplate() {
    if (!templateToApply) return;
    setApplyingTemplate(true);
    const { error: err } = await supabase.rpc("apply_service_template", { p_equipment_id: id, p_template_id: templateToApply });
    setApplyingTemplate(false);
    if (err) {
      setError(err.message);
      return;
    }
    setTemplateToApply("");
    loadAll();
  }

  async function logCheck(passed) {
    const { error: err } = await supabase.from("equipment_checks").insert({ equipment_id: id, checked_by: profile.id, passed });
    if (err) setError(err.message);
    else loadAll();
  }

  // Picking "Monitor" from the free status dropdown needs a note -- there'd
  // be nothing for the checkout badge to show otherwise -- so it opens an
  // inline prompt instead of writing immediately. Picking anything else
  // away from an existing "Monitor" logs a "cleared" event, so the history
  // table shows when/why watching a machine stopped, not just silence.
  async function handleStatusChange(status) {
    if (status === "monitor") {
      setPendingMonitorNote("");
      return;
    }
    const wasMonitoring = equipment.status === "monitor";
    const { error: err } = await supabase.from("equipment").update({ status }).eq("id", id);
    if (err) {
      setError(err.message);
      return;
    }
    if (wasMonitoring) {
      await supabase.from("equipment_monitor_events").insert({
        equipment_id: id,
        note: equipment.monitor_note || "Cleared",
        event_type: "cleared",
        created_by: profile.id,
      });
    }
    loadAll();
  }

  async function handleConfirmMonitor(e) {
    e.preventDefault();
    if (!pendingMonitorNote.trim()) return;
    const { error: err } = await supabase
      .from("equipment")
      .update({ status: "monitor", monitor_note: pendingMonitorNote.trim() })
      .eq("id", id);
    if (err) {
      setError(err.message);
      return;
    }
    await supabase.from("equipment_monitor_events").insert({
      equipment_id: id,
      note: pendingMonitorNote.trim(),
      event_type: "flagged",
      created_by: profile.id,
    });
    setPendingMonitorNote(null);
    loadAll();
  }

  async function handleUpdateMonitorNote(e) {
    e.preventDefault();
    if (!monitorNoteDraft.trim()) return;
    const { error: err } = await supabase.from("equipment").update({ monitor_note: monitorNoteDraft.trim() }).eq("id", id);
    if (err) {
      setError(err.message);
      return;
    }
    await supabase.from("equipment_monitor_events").insert({
      equipment_id: id,
      note: monitorNoteDraft.trim(),
      event_type: "updated",
      created_by: profile.id,
    });
    loadAll();
  }

  async function handleReportFault(e) {
    e.preventDefault();
    if (!faultDescription.trim()) return;
    // Goes through the same RPC the kiosk uses (report_equipment_fault,
    // see 49-equipment-repair-jobs.sql) rather than a plain insert, so this
    // screen also gets the auto-created, auto-assigned repair job instead
    // of the two code paths drifting apart.
    const { data, error: err } = await supabase.rpc("report_equipment_fault", {
      p_equipment_id: id,
      p_description: faultDescription,
    });
    if (err) {
      setError(err.message);
      return;
    }
    const result = Array.isArray(data) ? data[0] : data;
    const faultId = result?.fault_report_id;
    const jobId = result?.job_id;

    try {
      const file = await capturePhoto();
      const path = `${id}/${crypto.randomUUID()}-${file.name}`;
      const { error: uploadError } = await supabase.storage.from("fault-photos").upload(path, file);
      if (!uploadError && faultId) {
        await supabase.from("fault_photos").insert({ fault_report_id: faultId, storage_path: path });
      }
    } catch {
      // Photo is optional on a fault report — skip silently if cancelled.
    }

    if (jobId) {
      const { data: newJob } = await supabase
        .from("jobs")
        .select("id, description, assignee_profile_id, assignee_group_id")
        .eq("id", jobId)
        .single();
      if (newJob) {
        notifyJobAssigned({ job: newJob, actorProfileId: profile.id, actorDisplayName: profile.display_name }).catch((err2) =>
          console.error("Failed to notify repair job assignee", err2)
        );
      }
    }

    setFaultDescription("");
    loadAll();
  }

  async function handleLogRepair(e) {
    e.preventDefault();
    if (!repairNote.trim()) return;
    const { error: err } = await supabase.from("repair_records").insert({
      equipment_id: id,
      note: repairNote,
      cost: repairCost ? Number(repairCost) : null,
      vendor: repairVendor || null,
      repaired_at: new Date().toISOString(),
      repaired_by: profile.id,
    });
    if (err) {
      setError(err.message);
      return;
    }
    setRepairNote("");
    setRepairCost("");
    setRepairVendor("");
    loadAll();
  }

  if (!equipment) return <SkeletonList rows={3} />;

  return (
    <div style={{ maxWidth: "600px" }}>
      <Button onClick={() => navigate(-1)} icon={<IconArrowLeft size={15} />} style={{ marginBottom: "var(--space-4)" }}>
        Back
      </Button>
      {error && (
        <Alert tone="danger" title="Something went wrong">
          {error}
        </Alert>
      )}

      <Card pad="lg" style={{ marginBottom: "var(--space-5)" }}>
        <PageHeader
          title={equipment.name}
          subtitle={[equipment.equipment_type?.name, equipment.make, equipment.model].filter(Boolean).join(" · ") || "No details set"}
        />
        {(equipment.tracks_hours ?? equipment.equipment_type?.tracks_hours_default) && (
          <p style={{ color: colors.inkSoft, marginTop: 0, marginBottom: "var(--space-4)", fontSize: "var(--text-sm)" }}>
            {equipment.last_hours_reading != null
              ? `Last hours reading: ${equipment.last_hours_reading} hrs (${formatDateTime(equipment.last_hours_reading_at)})`
              : "No hours reading on file yet"}
          </p>
        )}
        {canManage ? (
          <Select
            value={equipment.status}
            onChange={(e) => handleStatusChange(e.target.value)}
            aria-label="Equipment status"
            style={{ marginBottom: "var(--space-3)" }}
          >
            {Object.entries(statusLabels).map(([val, label]) => (
              <option key={val} value={val}>
                {label}
              </option>
            ))}
          </Select>
        ) : (
          <p>{statusLabels[equipment.status]}</p>
        )}

        {pendingMonitorNote !== null && (
          <form
            onSubmit={handleConfirmMonitor}
            style={{ background: colors.bg, borderRadius: "var(--radius-sm)", padding: "var(--space-3)" }}
          >
            <Field label="What should the team watch for?">
              {({ id }) => (
                <Textarea
                  id={id}
                  value={pendingMonitorNote}
                  onChange={(e) => setPendingMonitorNote(e.target.value)}
                  rows={2}
                  autoFocus
                  placeholder="e.g. Rear tyres worn — check tread before longer jobs"
                />
              )}
            </Field>
            <div style={{ display: "flex", gap: "var(--space-2)", marginTop: "var(--space-3)" }}>
              <Button onClick={() => setPendingMonitorNote(null)}>Cancel</Button>
              <Button type="submit" variant="primary" disabled={!pendingMonitorNote.trim()}>
                Set to Monitor
              </Button>
            </div>
          </form>
        )}

        {equipment.status === "monitor" && pendingMonitorNote === null && (
          <Alert tone="warn" title="Being monitored">
            {canManage ? (
              <form onSubmit={handleUpdateMonitorNote}>
                <Textarea
                  value={monitorNoteDraft}
                  onChange={(e) => setMonitorNoteDraft(e.target.value)}
                  rows={2}
                  aria-label="What the team should watch for"
                  style={{ marginBottom: "var(--space-2)" }}
                />
                <Button
                  type="submit"
                  size="sm"
                  disabled={!monitorNoteDraft.trim() || monitorNoteDraft.trim() === equipment.monitor_note}
                >
                  Update note
                </Button>
              </form>
            ) : (
              <p>{equipment.monitor_note}</p>
            )}
          </Alert>
        )}
      </Card>

      {(tierStates.length > 0 || (canManage && serviceTemplates.length > 0)) && (
        <Section title="Service schedule">
          {tierStates.length > 0 && (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "var(--space-2)",
                marginBottom: canManage ? "var(--space-4)" : 0,
              }}
            >
              {tierStates.map((s) => (
                <div
                  key={s.id}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    gap: "var(--space-3)",
                    fontSize: "var(--text-sm)",
                    padding: "var(--space-1) 0",
                    borderBottom: `1px solid ${colors.line}`,
                  }}
                >
                  <span>
                    {s.tier?.template?.name ? `${s.tier.template.name} — ` : ""}
                    {s.tier?.name}
                    {s.tier?.is_recurring === false && s.last_completed_at && <span style={{ color: colors.inkSoft }}> (done)</span>}
                  </span>
                  <span style={{ color: colors.inkSoft }}>
                    {s.tier?.trigger_type === "hours"
                      ? s.next_due_hours != null
                        ? `Due at ${s.next_due_hours} hrs`
                        : "—"
                      : s.next_due_date
                      ? `Due ${s.next_due_date}`
                      : "—"}
                  </span>
                </div>
              ))}
            </div>
          )}
          {canManage && (
            <div style={{ display: "flex", gap: "var(--space-2)", flexWrap: "wrap" }}>
              <Select
                value={templateToApply}
                onChange={(e) => setTemplateToApply(e.target.value)}
                aria-label="Service template to apply"
                style={{ flex: 1, minWidth: "160px" }}
              >
                <option value="">Apply a service template…</option>
                {serviceTemplates
                  .filter((t) => !appliedTemplateIds.includes(t.id))
                  .map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
              </Select>
              <Button onClick={applyTemplate} disabled={!templateToApply} loading={applyingTemplate}>
                {applyingTemplate ? "Applying…" : "Apply"}
              </Button>
            </div>
          )}
        </Section>
      )}

      <div style={{ display: "flex", gap: "var(--space-2)", marginBottom: "var(--space-4)", flexWrap: "wrap" }}>
        <Chip active={activeTab === "checks"} onClick={() => setActiveTab("checks")}>
          Log a check
        </Chip>
        <Chip active={activeTab === "faults"} onClick={() => setActiveTab("faults")}>
          Report a fault / repair
        </Chip>
      </div>

      {activeTab === "checks" && (
        <Section title="Log a check">
          <div style={{ display: "flex", gap: "var(--space-2)", flexWrap: "wrap" }}>
            <Button variant="primary" onClick={() => logCheck(true)}>
              Log passed check
            </Button>
            <Button onClick={() => logCheck(false)}>Log failed check</Button>
          </div>
        </Section>
      )}

      {activeTab === "faults" && (
        <>
          <Section title="Report a fault">
            <form onSubmit={handleReportFault}>
              <Textarea
                value={faultDescription}
                onChange={(e) => setFaultDescription(e.target.value)}
                placeholder="Describe the fault…"
                aria-label="Fault description"
                rows={2}
                style={{ marginBottom: "var(--space-3)" }}
              />
              <Button type="submit" variant="primary">
                Report fault (with photo)
              </Button>
            </form>
          </Section>

          {canManage && (
            <Section title="Log a repair">
              <form onSubmit={handleLogRepair}>
                <Textarea
                  value={repairNote}
                  onChange={(e) => setRepairNote(e.target.value)}
                  placeholder="What was done…"
                  aria-label="What was done"
                  rows={2}
                  style={{ marginBottom: "var(--space-2)" }}
                />
                <div style={{ display: "flex", gap: "var(--space-2)", marginBottom: "var(--space-3)" }}>
                  <Input
                    value={repairVendor}
                    onChange={(e) => setRepairVendor(e.target.value)}
                    placeholder="Vendor (optional)"
                    aria-label="Vendor"
                    style={{ flex: 1 }}
                  />
                  <Input
                    value={repairCost}
                    onChange={(e) => setRepairCost(e.target.value)}
                    placeholder="Cost £ (optional)"
                    aria-label="Cost in pounds"
                    type="number"
                    step="0.01"
                    style={{ flex: 1 }}
                  />
                </div>
                <Button type="submit" variant="primary">
                  Log repair
                </Button>
              </form>
            </Section>
          )}
        </>
      )}

      <Section title="History">
        {combinedHistory.length === 0 ? (
          <EmptyState title="Nothing logged yet">Checks, faults and repairs for this machine will appear here.</EmptyState>
        ) : (
          <>
            <div
              style={{
                display: "flex",
                gap: "var(--space-2)",
                flexWrap: "wrap",
                alignItems: "center",
                marginBottom: "var(--space-3)",
              }}
            >
              <Input
                type="date"
                value={historyFrom}
                onChange={(e) => setHistoryFrom(e.target.value)}
                aria-label="History from date"
                style={{ width: "auto" }}
              />
              <Input
                type="date"
                value={historyTo}
                onChange={(e) => setHistoryTo(e.target.value)}
                aria-label="History to date"
                style={{ width: "auto" }}
              />
              {(historyFrom || historyTo) && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setHistoryFrom("");
                    setHistoryTo("");
                  }}
                >
                  Show all time
                </Button>
              )}
            </div>

            <div style={{ display: "flex", gap: "var(--space-2)", flexWrap: "wrap", marginBottom: "var(--space-3)" }}>
              {HISTORY_STATUS_CHIPS.map((chip) => (
                <Chip
                  key={chip.key}
                  active={historyStatusFilter === chip.key}
                  onClick={() => setHistoryStatusFilter(chip.key)}
                >
                  {chip.label}
                </Chip>
              ))}
            </div>

            {filteredSortedHistory.length === 0 ? (
              <EmptyState
                title="No entries match this filter"
                action={
                  <Button
                    variant="primary"
                    onClick={() => {
                      setHistoryStatusFilter("all");
                      setHistoryFrom("");
                      setHistoryTo("");
                    }}
                  >
                    Clear filters
                  </Button>
                }
              />
            ) : (
              <Table wrapperProps={{ style: { maxHeight: "60vh", overflowY: "auto" } }}>
                <thead>
                  <tr>
                    {[
                      ["status", "Status"],
                      ["details", "Details"],
                      ["person", "Person"],
                      ["date", "Date"],
                    ].map(([field, label]) => (
                      <th key={field} aria-sort={ariaSort(historySort, field)}>
                        <button type="button" className="tt-sortbtn" onClick={() => toggleHistorySort(field)}>
                          {label}
                          {historySortIndicator(field)}
                        </button>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredSortedHistory.map((row) => (
                    <tr key={row.id}>
                      <td>
                        <span style={{ color: HISTORY_STATUS[row.status].color, fontWeight: 600 }}>
                          {HISTORY_STATUS[row.status].label}
                        </span>
                      </td>
                      <td>{row.details || "—"}</td>
                      <td>{row.person || "—"}</td>
                      <td className="tt-num">{formatDateTime(row.date)}</td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            )}
          </>
        )}
      </Section>
    </div>
  );
}

// Screen readers announce a sortable column's current direction from this,
// which the old click-handler-on-a-th version had no way to express.
function ariaSort(sort, field) {
  if (sort.field !== field) return "none";
  return sort.direction === "asc" ? "ascending" : "descending";
}

function Section({ title, children }) {
  return (
    <Card pad="lg" style={{ marginBottom: "var(--space-4)" }}>
      <PageHeader title={title} level={2} />
      {children}
    </Card>
  );
}
