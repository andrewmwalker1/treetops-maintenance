import { useEffect, useState, useCallback, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "../lib/AuthContext.jsx";
import { usePermissions } from "../lib/permissions.js";
import { supabase } from "../lib/supabaseClient.js";
import { capturePhoto } from "../platform/camera.js";
import { colors, fonts, cardStyle, buttonStyle } from "../lib/theme.js";

const statusLabels = { in_service: "In service", faulty: "Faulty", in_repair: "In repair", scrapped: "Scrapped" };

// One shared vocabulary for every row in the combined history table below,
// whichever of the three source tables (equipment_checks/fault_reports/
// repair_records) it came from -- each gets its own colour so the table
// reads at a glance without needing a legend.
const HISTORY_STATUS = {
  pass: { label: "Pass", color: colors.mossDark },
  fail: { label: "Fail", color: colors.immediate },
  fault: { label: "Fault", color: colors.clay },
  repair: { label: "Repair", color: colors.moss },
};

const HISTORY_STATUS_CHIPS = [
  { key: "all", label: "All" },
  { key: "pass", label: "Pass" },
  { key: "fail", label: "Fail" },
  { key: "fault", label: "Fault" },
  { key: "repair", label: "Repair" },
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
  const [faultDescription, setFaultDescription] = useState("");
  const [repairNote, setRepairNote] = useState("");
  const [repairCost, setRepairCost] = useState("");
  const [repairVendor, setRepairVendor] = useState("");
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
    const [{ data: eq }, { data: checkRows }, { data: faultRows }, { data: repairRows }] = await Promise.all([
      supabase.from("equipment").select("id, name, make, model, status, check_frequency_days, equipment_type:equipment_types(name)").eq("id", id).single(),
      supabase.from("equipment_checks").select("id, checked_at, passed, checked_by:profiles(display_name)").eq("equipment_id", id).order("checked_at", { ascending: false }),
      supabase.from("fault_reports").select("id, description, created_at, reported_by:profiles!fault_reports_reported_by_fkey(display_name)").eq("equipment_id", id).order("created_at", { ascending: false }),
      supabase.from("repair_records").select("id, note, cost, vendor, repaired_at, repaired_by:profiles(display_name)").eq("equipment_id", id).order("repaired_at", { ascending: false }),
    ]);
    setEquipment(eq || null);
    setChecks(checkRows || []);
    setFaultReports(faultRows || []);
    setRepairs(repairRows || []);
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
    ];
    return rows.sort((a, b) => new Date(b.date) - new Date(a.date));
  }, [checks, faultReports, repairs]);

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

  async function logCheck(passed) {
    const { error: err } = await supabase.from("equipment_checks").insert({ equipment_id: id, checked_by: profile.id, passed });
    if (err) setError(err.message);
    else loadAll();
  }

  async function handleStatusChange(status) {
    const { error: err } = await supabase.from("equipment").update({ status }).eq("id", id);
    if (err) setError(err.message);
    else loadAll();
  }

  async function handleReportFault(e) {
    e.preventDefault();
    if (!faultDescription.trim()) return;
    const { data: faultReport, error: err } = await supabase
      .from("fault_reports")
      .insert({ equipment_id: id, reported_by: profile.id, description: faultDescription })
      .select()
      .single();
    if (err) {
      setError(err.message);
      return;
    }

    try {
      const file = await capturePhoto();
      const path = `${id}/${crypto.randomUUID()}-${file.name}`;
      const { error: uploadError } = await supabase.storage.from("fault-photos").upload(path, file);
      if (!uploadError) {
        await supabase.from("fault_photos").insert({ fault_report_id: faultReport.id, storage_path: path });
      }
    } catch {
      // Photo is optional on a fault report — skip silently if cancelled.
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

  if (!equipment) return <p style={{ color: colors.inkSoft }}>Loading…</p>;

  return (
    <div style={{ maxWidth: "600px" }}>
      <button onClick={() => navigate(-1)} style={{ ...buttonStyle.secondary, marginBottom: "16px" }}>← Back</button>
      {error && <p style={{ color: colors.immediate }}>{error}</p>}

      <div style={{ ...cardStyle, padding: "20px", marginBottom: "20px" }}>
        <h1 style={{ fontFamily: fonts.display, color: colors.mossDark, marginTop: 0, marginBottom: "4px" }}>{equipment.name}</h1>
        <p style={{ color: colors.inkSoft, marginTop: 0, marginBottom: "14px" }}>
          {[equipment.equipment_type?.name, equipment.make, equipment.model].filter(Boolean).join(" · ") || "No details set"}
        </p>
        {canManage ? (
          <select value={equipment.status} onChange={(e) => handleStatusChange(e.target.value)} style={selectStyle}>
            {Object.entries(statusLabels).map(([val, label]) => <option key={val} value={val}>{label}</option>)}
          </select>
        ) : (
          <p>{statusLabels[equipment.status]}</p>
        )}
      </div>

      <div style={{ display: "flex", gap: "8px", marginBottom: "16px" }}>
        <TabButton active={activeTab === "checks"} onClick={() => setActiveTab("checks")} label="Log a check" />
        <TabButton active={activeTab === "faults"} onClick={() => setActiveTab("faults")} label="Report a fault / repair" />
      </div>

      {activeTab === "checks" && (
        <Section title="Log a check">
          <div style={{ display: "flex", gap: "8px" }}>
            <button onClick={() => logCheck(true)} style={buttonStyle.primary}>Log passed check</button>
            <button onClick={() => logCheck(false)} style={buttonStyle.secondary}>Log failed check</button>
          </div>
        </Section>
      )}

      {activeTab === "faults" && (
        <>
          <Section title="Report a fault">
            <form onSubmit={handleReportFault}>
              <textarea value={faultDescription} onChange={(e) => setFaultDescription(e.target.value)} placeholder="Describe the fault…" rows={2} style={{ ...selectStyle, resize: "vertical" }} />
              <button type="submit" style={buttonStyle.primary}>Report fault (with photo)</button>
            </form>
          </Section>

          {canManage && (
            <Section title="Log a repair">
              <form onSubmit={handleLogRepair}>
                <textarea value={repairNote} onChange={(e) => setRepairNote(e.target.value)} placeholder="What was done…" rows={2} style={{ ...selectStyle, resize: "vertical" }} />
                <div style={{ display: "flex", gap: "8px" }}>
                  <input value={repairVendor} onChange={(e) => setRepairVendor(e.target.value)} placeholder="Vendor (optional)" style={{ ...selectStyle, flex: 1 }} />
                  <input value={repairCost} onChange={(e) => setRepairCost(e.target.value)} placeholder="Cost £ (optional)" type="number" step="0.01" style={{ ...selectStyle, flex: 1 }} />
                </div>
                <button type="submit" style={buttonStyle.primary}>Log repair</button>
              </form>
            </Section>
          )}
        </>
      )}

      <Section title="History">
        {combinedHistory.length === 0 ? (
          <p style={{ color: colors.inkSoft, fontSize: "13px", margin: 0 }}>Nothing logged against this machine yet.</p>
        ) : (
          <>
            <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", alignItems: "center", marginBottom: "10px" }}>
              <input type="date" value={historyFrom} onChange={(e) => setHistoryFrom(e.target.value)} style={{ ...selectStyle, marginBottom: 0, width: "auto" }} title="From date" />
              <input type="date" value={historyTo} onChange={(e) => setHistoryTo(e.target.value)} style={{ ...selectStyle, marginBottom: 0, width: "auto" }} title="To date" />
              {(historyFrom || historyTo) && (
                <button
                  type="button"
                  onClick={() => { setHistoryFrom(""); setHistoryTo(""); }}
                  style={{ border: "none", background: "none", color: colors.mossDark, textDecoration: "underline", cursor: "pointer", fontFamily: fonts.body, fontSize: "13px" }}
                >
                  Show all time
                </button>
              )}
            </div>

            <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginBottom: "12px" }}>
              {HISTORY_STATUS_CHIPS.map((chip) => (
                <button
                  key={chip.key}
                  type="button"
                  onClick={() => setHistoryStatusFilter(chip.key)}
                  style={{
                    border: `1px solid ${historyStatusFilter === chip.key ? colors.mossDark : colors.lineStrong}`,
                    background: historyStatusFilter === chip.key ? colors.mossDark : "transparent",
                    color: historyStatusFilter === chip.key ? "#FFFFFF" : colors.inkSoft,
                    borderRadius: "999px",
                    padding: "6px 14px",
                    fontFamily: fonts.body,
                    fontSize: "13px",
                    cursor: "pointer",
                  }}
                >
                  {chip.label}
                </button>
              ))}
            </div>

            {filteredSortedHistory.length === 0 ? (
              <p style={{ color: colors.inkSoft, fontSize: "13px", margin: 0 }}>No entries match this filter.</p>
            ) : (
              <div style={{ border: `1px solid ${colors.line}`, borderRadius: "10px", overflowX: "auto", maxHeight: "60vh", overflowY: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr>
                      <th style={thStyle} onClick={() => toggleHistorySort("status")}>Status{historySortIndicator("status")}</th>
                      <th style={thStyle} onClick={() => toggleHistorySort("details")}>Details{historySortIndicator("details")}</th>
                      <th style={thStyle} onClick={() => toggleHistorySort("person")}>Person{historySortIndicator("person")}</th>
                      <th style={thStyle} onClick={() => toggleHistorySort("date")}>Date{historySortIndicator("date")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredSortedHistory.map((row) => (
                      <tr key={row.id}>
                        <td style={tdStyle}>
                          <span style={{ color: HISTORY_STATUS[row.status].color, fontWeight: 600 }}>{HISTORY_STATUS[row.status].label}</span>
                        </td>
                        <td style={tdStyle}>{row.details || "—"}</td>
                        <td style={tdStyle}>{row.person || "—"}</td>
                        <td style={tdStyle}>{formatDateTime(row.date)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </Section>
    </div>
  );
}

function TabButton({ active, onClick, label }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        border: `1px solid ${active ? colors.mossDark : colors.lineStrong}`,
        background: active ? colors.mossDark : "transparent",
        color: active ? "#FFFFFF" : colors.inkSoft,
        borderRadius: "999px",
        padding: "6px 14px",
        fontFamily: fonts.body,
        fontSize: "13px",
        cursor: "pointer",
      }}
    >
      {label}
    </button>
  );
}

const selectStyle = {
  width: "100%",
  boxSizing: "border-box",
  padding: "10px 14px",
  borderRadius: "10px",
  border: `1px solid ${colors.lineStrong}`,
  fontFamily: fonts.body,
  marginBottom: "10px",
};

const thStyle = {
  textAlign: "left",
  padding: "8px 10px",
  fontSize: "12px",
  color: colors.inkSoft,
  cursor: "pointer",
  userSelect: "none",
  whiteSpace: "nowrap",
};

const tdStyle = {
  padding: "8px 10px",
  fontSize: "13px",
  borderTop: `1px solid ${colors.line}`,
  verticalAlign: "top",
};

function Section({ title, children }) {
  return (
    <div style={{ ...cardStyle, padding: "18px", marginBottom: "16px" }}>
      <h2 style={{ fontFamily: fonts.display, fontSize: "16px", color: colors.mossDark, marginTop: 0 }}>{title}</h2>
      {children}
    </div>
  );
}
