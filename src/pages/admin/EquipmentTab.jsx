import { useEffect, useState } from "react";
import { useAuth } from "../../lib/AuthContext.jsx";
import { supabase } from "../../lib/supabaseClient.js";
import { colors, fonts, cardStyle, buttonStyle } from "../../lib/theme.js";

const fieldStyle = {
  width: "100%",
  boxSizing: "border-box",
  padding: "8px 12px",
  borderRadius: "8px",
  border: `1px solid ${colors.lineStrong}`,
  fontFamily: fonts.body,
  marginBottom: "10px",
};

const statusLabels = { in_service: "In service", faulty: "Faulty", in_repair: "In repair", scrapped: "Scrapped" };

const blank = { id: null, name: "", make: "", model: "", equipment_type_id: "" };

export default function EquipmentTab() {
  const { org, activeSite } = useAuth();
  const [equipment, setEquipment] = useState([]);
  const [equipmentTypes, setEquipmentTypes] = useState([]);
  const [form, setForm] = useState(blank);
  const [error, setError] = useState(null);

  function refresh() {
    Promise.all([
      supabase.from("equipment").select("id, name, make, model, status, equipment_type_id, equipment_type:equipment_types(name)").eq("org_id", org?.id),
      supabase.from("equipment_types").select("id, name").eq("org_id", org?.id).order("name"),
    ]).then(([{ data: eq, error: err }, { data: types }]) => {
      if (err) setError(err.message);
      else setEquipment(eq || []);
      setEquipmentTypes(types || []);
    });
  }

  useEffect(refresh, [org]);

  function editItem(eq) {
    setForm({ id: eq.id, name: eq.name, make: eq.make || "", model: eq.model || "", equipment_type_id: eq.equipment_type_id || "" });
  }

  async function handleSave(e) {
    e.preventDefault();
    setError(null);
    const payload = {
      name: form.name,
      make: form.make || null,
      model: form.model || null,
      equipment_type_id: form.equipment_type_id || null,
    };
    let err;
    if (form.id) {
      ({ error: err } = await supabase.from("equipment").update(payload).eq("id", form.id));
    } else {
      ({ error: err } = await supabase.from("equipment").insert({
        ...payload,
        org_id: org.id,
        site_id: activeSite.id,
        status: "in_service",
      }));
    }
    if (err) {
      setError(err.message);
      return;
    }
    setForm(blank);
    refresh();
  }

  async function handleDelete(id) {
    if (!window.confirm("Delete this equipment item? This can't be undone.")) return;
    const { error: err } = await supabase.from("equipment").delete().eq("id", id);
    if (err) setError(err.message);
    else refresh();
  }

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px" }}>
      <div>
        <h2 style={{ fontFamily: fonts.display, fontSize: "16px", color: colors.mossDark }}>Equipment</h2>
        {equipment.map((eq) => (
          <div key={eq.id} style={{ ...cardStyle, padding: "12px 16px", marginBottom: "8px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <div style={{ fontWeight: 600 }}>{eq.name}{eq.equipment_type && <span style={{ fontWeight: 400, color: colors.inkSoft }}> · {eq.equipment_type.name}</span>}</div>
              <div style={{ fontSize: "12px", color: colors.inkSoft }}>
                {[eq.make, eq.model].filter(Boolean).join(" ") || "No make/model set"} · {statusLabels[eq.status]}
              </div>
            </div>
            <div style={{ display: "flex", gap: "8px" }}>
              <button onClick={() => editItem(eq)} style={buttonStyle.secondary}>Edit</button>
              <button onClick={() => handleDelete(eq.id)} style={{ ...buttonStyle.secondary, color: colors.immediate }}>Delete</button>
            </div>
          </div>
        ))}
        {equipment.length === 0 && <p style={{ color: colors.inkSoft }}>No equipment yet.</p>}
      </div>

      <div>
        <h2 style={{ fontFamily: fonts.display, fontSize: "16px", color: colors.mossDark }}>{form.id ? "Edit equipment" : "New equipment"}</h2>
        <form onSubmit={handleSave} style={{ ...cardStyle, padding: "16px" }}>
          <label style={labelStyle}>Kit ID</label>
          <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. EST1" style={fieldStyle} />

          <label style={labelStyle}>Equipment type</label>
          <select value={form.equipment_type_id} onChange={(e) => setForm({ ...form, equipment_type_id: e.target.value })} style={fieldStyle}>
            <option value="">No type set</option>
            {equipmentTypes.map((t) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>

          <label style={labelStyle}>Make</label>
          <input value={form.make} onChange={(e) => setForm({ ...form, make: e.target.value })} placeholder="e.g. Stihl" style={fieldStyle} />

          <label style={labelStyle}>Model</label>
          <input value={form.model} onChange={(e) => setForm({ ...form, model: e.target.value })} placeholder="e.g. FS 131" style={fieldStyle} />

          {error && <p style={{ color: colors.immediate, fontSize: "13px" }}>{error}</p>}

          <div style={{ display: "flex", gap: "8px" }}>
            <button type="submit" style={buttonStyle.primary}>{form.id ? "Save changes" : "Add equipment"}</button>
            {form.id && <button type="button" onClick={() => setForm(blank)} style={buttonStyle.secondary}>Cancel</button>}
          </div>
        </form>
      </div>
    </div>
  );
}

const labelStyle = { display: "block", fontSize: "13px", fontWeight: 600, color: colors.inkSoft, marginBottom: "6px" };
