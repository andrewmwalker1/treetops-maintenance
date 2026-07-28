import { useEffect, useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "../lib/AuthContext.jsx";
import { usePermissions } from "../lib/permissions.js";
import { supabase } from "../lib/supabaseClient.js";
import { capturePhoto } from "../platform/camera.js";
import { colors, fonts, cardStyle, buttonStyle } from "../lib/theme.js";

const statusLabels = { in_service: "In service", faulty: "Faulty", in_repair: "In repair", scrapped: "Scrapped" };

export default function EquipmentDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { profile } = useAuth();
  const permissions = usePermissions();
  const canManage = permissions.has("can_manage_equipment_status");

  const [equipment, setEquipment] = useState(null);
  const [equipmentTypes, setEquipmentTypes] = useState([]);
  const [checks, setChecks] = useState([]);
  const [faultReports, setFaultReports] = useState([]);
  const [repairs, setRepairs] = useState([]);
  const [faultDescription, setFaultDescription] = useState("");
  const [repairNote, setRepairNote] = useState("");
  const [repairCost, setRepairCost] = useState("");
  const [repairVendor, setRepairVendor] = useState("");
  const [error, setError] = useState(null);

  const loadAll = useCallback(async () => {
    const [{ data: eq }, { data: checkRows }, { data: faultRows }, { data: repairRows }, { data: types }] = await Promise.all([
      supabase.from("equipment").select("id, name, status, check_frequency_days, equipment_type_id, equipment_type:equipment_types(name)").eq("id", id).single(),
      supabase.from("equipment_checks").select("id, checked_at, passed, checked_by:profiles(display_name)").eq("equipment_id", id).order("checked_at", { ascending: false }),
      supabase.from("fault_reports").select("id, description, created_at, reported_by:profiles!fault_reports_reported_by_fkey(display_name)").eq("equipment_id", id).order("created_at", { ascending: false }),
      supabase.from("repair_records").select("id, note, cost, vendor, repaired_at").eq("equipment_id", id).order("repaired_at", { ascending: false }),
      supabase.from("equipment_types").select("id, name").order("name"),
    ]);
    setEquipment(eq || null);
    setChecks(checkRows || []);
    setFaultReports(faultRows || []);
    setRepairs(repairRows || []);
    setEquipmentTypes(types || []);
  }, [id]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  async function handleTypeChange(equipment_type_id) {
    const { error: err } = await supabase.from("equipment").update({ equipment_type_id: equipment_type_id || null }).eq("id", id);
    if (err) setError(err.message);
    else loadAll();
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
        {canManage ? (
          <select value={equipment.equipment_type_id || ""} onChange={(e) => handleTypeChange(e.target.value)} style={selectStyle}>
            <option value="">No type set</option>
            {equipmentTypes.map((t) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
        ) : (
          equipment.equipment_type && <p style={{ color: colors.inkSoft, marginTop: 0 }}>{equipment.equipment_type.name}</p>
        )}
        {canManage ? (
          <select value={equipment.status} onChange={(e) => handleStatusChange(e.target.value)} style={selectStyle}>
            {Object.entries(statusLabels).map(([val, label]) => <option key={val} value={val}>{label}</option>)}
          </select>
        ) : (
          <p>{statusLabels[equipment.status]}</p>
        )}
      </div>

      <Section title="Checks">
        <div style={{ display: "flex", gap: "8px", marginBottom: "12px" }}>
          <button onClick={() => logCheck(true)} style={buttonStyle.primary}>Log passed check</button>
          <button onClick={() => logCheck(false)} style={buttonStyle.secondary}>Log failed check</button>
        </div>
        {checks.map((c) => (
          <div key={c.id} style={{ fontSize: "13px", color: colors.inkSoft, padding: "4px 0" }}>
            {c.passed ? "Passed" : "Failed"} by {c.checked_by?.display_name} — {new Date(c.checked_at).toLocaleString()}
          </div>
        ))}
      </Section>

      <Section title="Fault reports">
        <form onSubmit={handleReportFault} style={{ marginBottom: "12px" }}>
          <textarea value={faultDescription} onChange={(e) => setFaultDescription(e.target.value)} placeholder="Describe the fault…" rows={2} style={{ ...selectStyle, resize: "vertical" }} />
          <button type="submit" style={buttonStyle.primary}>Report fault (with photo)</button>
        </form>
        {faultReports.map((f) => (
          <div key={f.id} style={{ padding: "8px 0", borderBottom: `1px solid ${colors.line}` }}>
            <div>{f.description}</div>
            <div style={{ fontSize: "12px", color: colors.inkSoft }}>{f.reported_by?.display_name} — {new Date(f.created_at).toLocaleString()}</div>
          </div>
        ))}
      </Section>

      {(canManage || repairs.length > 0) && (
        <Section title="Repair history">
          {canManage && (
            <form onSubmit={handleLogRepair} style={{ marginBottom: "12px" }}>
              <textarea value={repairNote} onChange={(e) => setRepairNote(e.target.value)} placeholder="What was done…" rows={2} style={{ ...selectStyle, resize: "vertical" }} />
              <div style={{ display: "flex", gap: "8px" }}>
                <input value={repairVendor} onChange={(e) => setRepairVendor(e.target.value)} placeholder="Vendor (optional)" style={{ ...selectStyle, flex: 1 }} />
                <input value={repairCost} onChange={(e) => setRepairCost(e.target.value)} placeholder="Cost £ (optional)" type="number" step="0.01" style={{ ...selectStyle, flex: 1 }} />
              </div>
              <button type="submit" style={buttonStyle.primary}>Log repair</button>
            </form>
          )}
          {repairs.map((r) => (
            <div key={r.id} style={{ padding: "8px 0", borderBottom: `1px solid ${colors.line}` }}>
              <div>{r.note}</div>
              <div style={{ fontSize: "12px", color: colors.inkSoft }}>
                {r.vendor && `${r.vendor} · `}{r.cost != null && `£${r.cost} · `}{r.repaired_at && new Date(r.repaired_at).toLocaleDateString()}
              </div>
            </div>
          ))}
        </Section>
      )}
    </div>
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
