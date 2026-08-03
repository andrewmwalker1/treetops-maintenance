import { useEffect, useState } from "react";
import { useAuth } from "../../lib/AuthContext.jsx";
import { supabase } from "../../lib/supabaseClient.js";
import { colors, fonts, cardStyle, buttonStyle } from "../../lib/theme.js";

const inputStyle = {
  flex: 1,
  padding: "6px 10px",
  borderRadius: "6px",
  border: `1px solid ${colors.lineStrong}`,
  fontFamily: fonts.body,
  fontSize: "14px",
};

const iconButtonStyle = {
  background: "transparent",
  border: `1px solid ${colors.lineStrong}`,
  borderRadius: "6px",
  width: "28px",
  height: "28px",
  cursor: "pointer",
  color: colors.inkSoft,
  fontSize: "13px",
};

export default function CommonFaultDescriptionsTab() {
  const { org } = useAuth();
  const [types, setTypes] = useState([]);
  const [selectedTypeId, setSelectedTypeId] = useState(null);
  const [faults, setFaults] = useState([]);
  const [newFault, setNewFault] = useState("");
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!org) return;
    supabase
      .from("equipment_types")
      .select("id, name")
      .eq("org_id", org.id)
      .order("name")
      .then(({ data, error: err }) => {
        if (err) setError(err.message);
        else {
          setTypes(data || []);
          if (data?.length && !selectedTypeId) setSelectedTypeId(data[0].id);
        }
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [org]);

  function refreshFaults(typeId) {
    if (!typeId) return;
    supabase
      .from("common_fault_descriptions")
      .select("id, description, sort_order")
      .eq("equipment_type_id", typeId)
      .order("sort_order")
      .then(({ data, error: err }) => {
        if (err) setError(err.message);
        else setFaults(data || []);
      });
  }

  useEffect(() => {
    refreshFaults(selectedTypeId);
  }, [selectedTypeId]);

  async function addFault(e) {
    e.preventDefault();
    const description = newFault.trim();
    if (!description || !selectedTypeId) return;
    const nextSortOrder = faults.length > 0 ? Math.max(...faults.map((f) => f.sort_order)) + 1 : 0;
    const { error: err } = await supabase
      .from("common_fault_descriptions")
      .insert({ org_id: org.id, equipment_type_id: selectedTypeId, description, sort_order: nextSortOrder });
    if (err) setError(err.message);
    else {
      setNewFault("");
      refreshFaults(selectedTypeId);
    }
  }

  function editFaultLocal(index, text) {
    setFaults((prev) => prev.map((f, i) => (i === index ? { ...f, description: text } : f)));
  }

  async function persistFault(fault) {
    const { error: err } = await supabase
      .from("common_fault_descriptions")
      .update({ description: fault.description })
      .eq("id", fault.id);
    if (err) setError(err.message);
  }

  async function removeFault(id) {
    const { error: err } = await supabase.from("common_fault_descriptions").delete().eq("id", id);
    if (err) setError(err.message);
    else refreshFaults(selectedTypeId);
  }

  async function moveFault(index, direction) {
    const target = index + direction;
    if (target < 0 || target >= faults.length) return;
    const a = faults[index];
    const b = faults[target];
    const [{ error: err1 }, { error: err2 }] = await Promise.all([
      supabase.from("common_fault_descriptions").update({ sort_order: b.sort_order }).eq("id", a.id),
      supabase.from("common_fault_descriptions").update({ sort_order: a.sort_order }).eq("id", b.id),
    ]);
    if (err1 || err2) setError((err1 || err2).message);
    else refreshFaults(selectedTypeId);
  }

  return (
    <div>
      <h2 style={{ fontFamily: fonts.display, fontSize: "16px", color: colors.mossDark, marginTop: 0 }}>Common faults</h2>
      <p style={{ fontSize: "13px", color: colors.inkSoft, marginTop: 0 }}>
        The picklist staff choose from when reporting an issue with a piece of kit on the workshop kiosk, per equipment type.
      </p>

      {types.length === 0 && <p style={{ color: colors.inkSoft }}>No equipment types yet -- add some in the Equipment Types tab first.</p>}

      <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginBottom: "16px" }}>
        {types.map((t) => (
          <button
            key={t.id}
            onClick={() => setSelectedTypeId(t.id)}
            style={{
              border: `1px solid ${selectedTypeId === t.id ? colors.mossDark : colors.lineStrong}`,
              background: selectedTypeId === t.id ? colors.mossDark : "transparent",
              color: selectedTypeId === t.id ? "#FFFFFF" : colors.inkSoft,
              borderRadius: "999px",
              padding: "8px 16px",
              fontFamily: fonts.body,
              fontSize: "14px",
              cursor: "pointer",
            }}
          >
            {t.name}
          </button>
        ))}
      </div>

      {error && <p style={{ color: colors.immediate, fontSize: "13px" }}>{error}</p>}

      {selectedTypeId && (
        <div style={{ ...cardStyle, padding: "16px", maxWidth: "480px" }}>
          {faults.length === 0 && <p style={{ color: colors.inkSoft, fontSize: "13px" }}>No common faults listed yet.</p>}
          {faults.map((f, i) => (
            <div key={f.id} style={{ display: "flex", alignItems: "center", gap: "8px", padding: "4px 0" }}>
              <input value={f.description} onChange={(e) => editFaultLocal(i, e.target.value)} onBlur={() => persistFault(faults[i])} style={inputStyle} />
              <button type="button" onClick={() => moveFault(i, -1)} disabled={i === 0} style={iconButtonStyle}>↑</button>
              <button type="button" onClick={() => moveFault(i, 1)} disabled={i === faults.length - 1} style={iconButtonStyle}>↓</button>
              <button type="button" onClick={() => removeFault(f.id)} style={{ ...iconButtonStyle, color: colors.immediate }}>✕</button>
            </div>
          ))}

          <form onSubmit={addFault} style={{ display: "flex", gap: "8px", marginTop: "10px" }}>
            <input value={newFault} onChange={(e) => setNewFault(e.target.value)} placeholder="Add a common fault…" style={inputStyle} />
            <button type="submit" style={buttonStyle.secondary}>Add</button>
          </form>
        </div>
      )}
    </div>
  );
}
