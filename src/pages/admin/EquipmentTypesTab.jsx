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

const blank = { id: null, name: "" };

export default function EquipmentTypesTab() {
  const { org } = useAuth();
  const [types, setTypes] = useState([]);
  const [counts, setCounts] = useState({});
  const [form, setForm] = useState(blank);
  const [error, setError] = useState(null);

  function refresh() {
    Promise.all([
      supabase.from("equipment_types").select("id, name").eq("org_id", org.id).order("name"),
      supabase.from("equipment").select("equipment_type_id"),
    ]).then(([{ data: t, error: err }, { data: eq }]) => {
      if (err) setError(err.message);
      else setTypes(t || []);
      const grouped = {};
      for (const row of eq || []) {
        if (row.equipment_type_id) grouped[row.equipment_type_id] = (grouped[row.equipment_type_id] || 0) + 1;
      }
      setCounts(grouped);
    });
  }

  useEffect(refresh, [org]);

  function editType(t) {
    setForm({ id: t.id, name: t.name });
  }

  async function handleSave(e) {
    e.preventDefault();
    setError(null);
    const payload = { org_id: org.id, name: form.name };
    const { error: err } = form.id
      ? await supabase.from("equipment_types").update(payload).eq("id", form.id)
      : await supabase.from("equipment_types").insert(payload);
    if (err) {
      setError(err.message);
      return;
    }
    setForm(blank);
    refresh();
  }

  async function handleDelete(id) {
    const { error: err } = await supabase.from("equipment_types").delete().eq("id", id);
    if (err) setError(err.message);
    else refresh();
  }

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px" }}>
      <div>
        <h2 style={{ fontFamily: fonts.display, fontSize: "16px", color: colors.mossDark }}>Equipment types</h2>
        <p style={{ fontSize: "13px", color: colors.inkSoft }}>
          Groups individual equipment items (e.g. ST1, ST2, ST3) under what they actually are (e.g. "Strimmer").
        </p>
        {types.map((t) => (
          <div key={t.id} style={{ ...cardStyle, padding: "12px 16px", marginBottom: "8px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <div style={{ fontWeight: 600 }}>{t.name}</div>
              <div style={{ fontSize: "12px", color: colors.inkSoft }}>{counts[t.id] || 0} item(s)</div>
            </div>
            <div style={{ display: "flex", gap: "8px" }}>
              <button onClick={() => editType(t)} style={buttonStyle.secondary}>Edit</button>
              <button onClick={() => handleDelete(t.id)} style={{ ...buttonStyle.secondary, color: colors.immediate }}>Delete</button>
            </div>
          </div>
        ))}
        {types.length === 0 && <p style={{ color: colors.inkSoft }}>No equipment types yet.</p>}
      </div>

      <div>
        <h2 style={{ fontFamily: fonts.display, fontSize: "16px", color: colors.mossDark }}>{form.id ? "Edit equipment type" : "New equipment type"}</h2>
        <form onSubmit={handleSave} style={{ ...cardStyle, padding: "16px" }}>
          <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Strimmer" style={fieldStyle} />

          {error && <p style={{ color: colors.immediate, fontSize: "13px" }}>{error}</p>}

          <div style={{ display: "flex", gap: "8px" }}>
            <button type="submit" style={buttonStyle.primary}>{form.id ? "Save changes" : "Create equipment type"}</button>
            {form.id && <button type="button" onClick={() => setForm(blank)} style={buttonStyle.secondary}>Cancel</button>}
          </div>
        </form>
      </div>
    </div>
  );
}
