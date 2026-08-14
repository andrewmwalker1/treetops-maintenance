import { useEffect, useState, useCallback, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "../lib/AuthContext.jsx";
import { usePermissions } from "../lib/permissions.js";
import { supabase } from "../lib/supabaseClient.js";
import { capturePhoto } from "../platform/camera.js";
import Modal from "../components/Modal.jsx";
import { colors, fonts, cardStyle, buttonStyle } from "../lib/theme.js";

const RECENT_CHECKS_SHOWN = 5;
const RECENT_HISTORY_SHOWN = 5;

const statusLabels = { in_service: "In service", faulty: "Faulty", in_repair: "In repair", scrapped: "Scrapped" };

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
  const [showChecksModal, setShowChecksModal] = useState(false);
  const [checksFilter, setChecksFilter] = useState("all"); // all | passed | failed
  const [checksSort, setChecksSort] = useState("newest"); // newest | oldest
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [historyFilter, setHistoryFilter] = useState("all"); // all | fault | repair
  const [historySort, setHistorySort] = useState("newest"); // newest | oldest

  const loadAll = useCallback(async () => {
    const [{ data: eq }, { data: checkRows }, { data: faultRows }, { data: repairRows }] = await Promise.all([
      supabase.from("equipment").select("id, name, make, model, status, check_frequency_days, equipment_type:equipment_types(name)").eq("id", id).single(),
      supabase.from("equipment_checks").select("id, checked_at, passed, checked_by:profiles(display_name)").eq("equipment_id", id).order("checked_at", { ascending: false }),
      supabase.from("fault_reports").select("id, description, created_at, reported_by:profiles!fault_reports_reported_by_fkey(display_name)").eq("equipment_id", id).order("created_at", { ascending: false }),
      supabase.from("repair_records").select("id, note, cost, vendor, repaired_at").eq("equipment_id", id).order("repaired_at", { ascending: false }),
    ]);
    setEquipment(eq || null);
    setChecks(checkRows || []);
    setFaultReports(faultRows || []);
    setRepairs(repairRows || []);
  }, [id]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  // The full history is already loaded (loadAll has no limit) -- filtering
  // and sorting here is just a client-side view over it, same as JobsList
  // does for its filters. Only the popout modal needs the full set; the
  // tab itself only ever shows the most recent few.
  const filteredSortedChecks = useMemo(() => {
    let result = checks;
    if (checksFilter === "passed") result = result.filter((c) => c.passed);
    else if (checksFilter === "failed") result = result.filter((c) => !c.passed);
    result = [...result].sort((a, b) =>
      checksSort === "oldest"
        ? new Date(a.checked_at) - new Date(b.checked_at)
        : new Date(b.checked_at) - new Date(a.checked_at)
    );
    return result;
  }, [checks, checksFilter, checksSort]);

  // Faults and repairs come from two separate tables with no FK linking a
  // repair to the fault it fixed -- merging them into one date-ordered list
  // (rather than two side-by-side tables) is what actually lets you read a
  // fault and its follow-up repair in sequence.
  const faultsAndRepairsHistory = useMemo(() => {
    return [
      ...faultReports.map((f) => ({
        kind: "fault",
        id: `fault-${f.id}`,
        date: f.created_at,
        description: f.description,
        by: f.reported_by?.display_name,
      })),
      ...repairs.map((r) => ({
        kind: "repair",
        id: `repair-${r.id}`,
        date: r.repaired_at,
        note: r.note,
        vendor: r.vendor,
        cost: r.cost,
      })),
    ];
  }, [faultReports, repairs]);

  const filteredSortedHistory = useMemo(() => {
    let result = faultsAndRepairsHistory;
    if (historyFilter === "fault") result = result.filter((h) => h.kind === "fault");
    else if (historyFilter === "repair") result = result.filter((h) => h.kind === "repair");
    result = [...result].sort((a, b) =>
      historySort === "oldest" ? new Date(a.date) - new Date(b.date) : new Date(b.date) - new Date(a.date)
    );
    return result;
  }, [faultsAndRepairsHistory, historyFilter, historySort]);

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
        <TabButton active={activeTab === "checks"} onClick={() => setActiveTab("checks")} label="Checks" />
        <TabButton active={activeTab === "faults"} onClick={() => setActiveTab("faults")} label="Faults & repairs" />
      </div>

      {activeTab === "checks" && (
        <Section title="Checks">
          <div style={{ display: "flex", gap: "8px", marginBottom: "12px" }}>
            <button onClick={() => logCheck(true)} style={buttonStyle.primary}>Log passed check</button>
            <button onClick={() => logCheck(false)} style={buttonStyle.secondary}>Log failed check</button>
          </div>
          {checks.slice(0, RECENT_CHECKS_SHOWN).map((c) => (
            <CheckRow key={c.id} check={c} />
          ))}
          {checks.length === 0 && <p style={{ color: colors.inkSoft, fontSize: "13px", margin: 0 }}>No checks logged yet.</p>}
          {checks.length > RECENT_CHECKS_SHOWN && (
            <button
              type="button"
              onClick={() => setShowChecksModal(true)}
              style={{ border: "none", background: "none", color: colors.mossDark, textDecoration: "underline", cursor: "pointer", fontFamily: fonts.body, fontSize: "13px", padding: "8px 0 0" }}
            >
              View all {checks.length} checks
            </button>
          )}
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

          <Section title="Fault & repair history">
            {faultsAndRepairsHistory.length === 0 && (
              <p style={{ color: colors.inkSoft, fontSize: "13px", margin: 0 }}>No faults or repairs logged yet.</p>
            )}
            {[...faultsAndRepairsHistory]
              .sort((a, b) => new Date(b.date) - new Date(a.date))
              .slice(0, RECENT_HISTORY_SHOWN)
              .map((item) => (
                <HistoryRow key={item.id} item={item} />
              ))}
            {faultsAndRepairsHistory.length > RECENT_HISTORY_SHOWN && (
              <button
                type="button"
                onClick={() => setShowHistoryModal(true)}
                style={{ border: "none", background: "none", color: colors.mossDark, textDecoration: "underline", cursor: "pointer", fontFamily: fonts.body, fontSize: "13px", padding: "8px 0 0" }}
              >
                View all {faultsAndRepairsHistory.length}
              </button>
            )}
          </Section>
        </>
      )}

      {showChecksModal && (
        <Modal title={`All checks (${checks.length})`} onClose={() => setShowChecksModal(false)}>
          <div style={{ display: "flex", gap: "8px", marginBottom: "14px" }}>
            <select value={checksFilter} onChange={(e) => setChecksFilter(e.target.value)} style={{ ...selectStyle, marginBottom: 0, flex: 1 }}>
              <option value="all">All results</option>
              <option value="passed">Passed only</option>
              <option value="failed">Failed only</option>
            </select>
            <select value={checksSort} onChange={(e) => setChecksSort(e.target.value)} style={{ ...selectStyle, marginBottom: 0, flex: 1 }}>
              <option value="newest">Newest first</option>
              <option value="oldest">Oldest first</option>
            </select>
          </div>
          <div style={{ maxHeight: "50vh", overflowY: "auto" }}>
            {filteredSortedChecks.length === 0 ? (
              <p style={{ color: colors.inkSoft, fontSize: "13px", margin: 0 }}>No checks match this filter.</p>
            ) : (
              filteredSortedChecks.map((c) => <CheckRow key={c.id} check={c} />)
            )}
          </div>
        </Modal>
      )}

      {showHistoryModal && (
        <Modal title={`Fault & repair history (${faultsAndRepairsHistory.length})`} onClose={() => setShowHistoryModal(false)}>
          <div style={{ display: "flex", gap: "8px", marginBottom: "14px" }}>
            <select value={historyFilter} onChange={(e) => setHistoryFilter(e.target.value)} style={{ ...selectStyle, marginBottom: 0, flex: 1 }}>
              <option value="all">All entries</option>
              <option value="fault">Faults only</option>
              <option value="repair">Repairs only</option>
            </select>
            <select value={historySort} onChange={(e) => setHistorySort(e.target.value)} style={{ ...selectStyle, marginBottom: 0, flex: 1 }}>
              <option value="newest">Newest first</option>
              <option value="oldest">Oldest first</option>
            </select>
          </div>
          <div style={{ maxHeight: "50vh", overflowY: "auto" }}>
            {filteredSortedHistory.length === 0 ? (
              <p style={{ color: colors.inkSoft, fontSize: "13px", margin: 0 }}>No entries match this filter.</p>
            ) : (
              filteredSortedHistory.map((item) => <HistoryRow key={item.id} item={item} />)
            )}
          </div>
        </Modal>
      )}
    </div>
  );
}

function HistoryRow({ item }) {
  if (item.kind === "fault") {
    return (
      <div style={{ padding: "8px 0", borderBottom: `1px solid ${colors.line}` }}>
        <div>
          <span style={{ color: colors.immediate, fontWeight: 600 }}>Fault</span> — {item.description}
        </div>
        <div style={{ fontSize: "12px", color: colors.inkSoft }}>
          {item.by} — {item.date && new Date(item.date).toLocaleString()}
        </div>
      </div>
    );
  }
  return (
    <div style={{ padding: "8px 0", borderBottom: `1px solid ${colors.line}` }}>
      <div>
        <span style={{ color: colors.mossDark, fontWeight: 600 }}>Repair</span> — {item.note}
      </div>
      <div style={{ fontSize: "12px", color: colors.inkSoft }}>
        {item.vendor && `${item.vendor} · `}
        {item.cost != null && `£${item.cost} · `}
        {item.date && new Date(item.date).toLocaleDateString()}
      </div>
    </div>
  );
}

function CheckRow({ check }) {
  return (
    <div style={{ fontSize: "13px", color: colors.inkSoft, padding: "4px 0" }}>
      <span style={{ color: check.passed ? colors.mossDark : colors.immediate, fontWeight: 600 }}>
        {check.passed ? "Passed" : "Failed"}
      </span>{" "}
      by {check.checked_by?.display_name} — {new Date(check.checked_at).toLocaleString()}
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

function Section({ title, children }) {
  return (
    <div style={{ ...cardStyle, padding: "18px", marginBottom: "16px" }}>
      <h2 style={{ fontFamily: fonts.display, fontSize: "16px", color: colors.mossDark, marginTop: 0 }}>{title}</h2>
      {children}
    </div>
  );
}
