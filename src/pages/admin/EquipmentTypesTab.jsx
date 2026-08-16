import { useEffect, useState } from "react";
import { useAuth } from "../../lib/AuthContext.jsx";
import { supabase } from "../../lib/supabaseClient.js";
import ChecklistBuilder from "../../components/ChecklistBuilder.jsx";
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

const blank = { id: null, name: "", pre_use_checklist: [], allow_multi_checkout: false };

export default function EquipmentTypesTab() {
  const { org } = useAuth();
  const [types, setTypes] = useState([]);
  const [counts, setCounts] = useState({});
  const [form, setForm] = useState(null); // null = modal closed
  const [error, setError] = useState(null);
  const [copyFromId, setCopyFromId] = useState("");

  function refresh() {
    Promise.all([
      supabase.from("equipment_types").select("id, name, pre_use_checklist, allow_multi_checkout, sort_order").eq("org_id", org.id).order("sort_order"),
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

  async function moveType(index, direction) {
    const target = index + direction;
    if (target < 0 || target >= types.length) return;
    const a = types[index];
    const b = types[target];
    const [{ error: err1 }, { error: err2 }] = await Promise.all([
      supabase.from("equipment_types").update({ sort_order: b.sort_order }).eq("id", a.id),
      supabase.from("equipment_types").update({ sort_order: a.sort_order }).eq("id", b.id),
    ]);
    if (err1 || err2) setError((err1 || err2).message);
    else refresh();
  }

  useEffect(refresh, [org]);

  function editType(t) {
    setError(null);
    setCopyFromId("");
    setForm({ id: t.id, name: t.name, pre_use_checklist: t.pre_use_checklist || [], allow_multi_checkout: t.allow_multi_checkout || false });
  }

  function copyChecklistFrom(sourceId) {
    const source = types.find((t) => t.id === sourceId);
    if (!source) return;
    const existing = new Set(form.pre_use_checklist);
    const toAdd = (source.pre_use_checklist || []).filter((item) => !existing.has(item));
    setForm({ ...form, pre_use_checklist: [...form.pre_use_checklist, ...toAdd] });
  }

  async function handleSave(e) {
    e.preventDefault();
    setError(null);
    const payload = { org_id: org.id, name: form.name, pre_use_checklist: form.pre_use_checklist, allow_multi_checkout: form.allow_multi_checkout };
    if (!form.id) {
      payload.sort_order = types.length > 0 ? Math.max(...types.map((t) => t.sort_order)) + 1 : 0;
    }
    const { error: err } = form.id
      ? await supabase.from("equipment_types").update(payload).eq("id", form.id)
      : await supabase.from("equipment_types").insert(payload);
    if (err) {
      setError(err.message);
      return;
    }
    setForm(null);
    refresh();
  }

  async function handleDelete(id) {
    const { error: err } = await supabase.from("equipment_types").delete().eq("id", id);
    if (err) setError(err.message);
    else refresh();
  }

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "12px", marginBottom: "6px", flexWrap: "wrap" }}>
        <h2 style={{ fontFamily: fonts.display, fontSize: "16px", color: colors.mossDark, margin: 0 }}>Equipment types</h2>
        <button onClick={() => { setError(null); setCopyFromId(""); setForm(blank); }} style={buttonStyle.primary}>+ Add equipment type</button>
      </div>
      <p style={{ fontSize: "13px", color: colors.inkSoft, marginTop: 0 }}>
        Groups individual equipment items (e.g. ST1, ST2, ST3) under what they actually are (e.g. "Strimmer").
      </p>

      {types.map((t, i) => (
        <div key={t.id} style={{ ...cardStyle, padding: "12px 16px", marginBottom: "8px", display: "flex", justifyContent: "space-between", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
          <div>
            <div style={{ fontWeight: 600 }}>{t.name}</div>
            <div style={{ fontSize: "12px", color: colors.inkSoft }}>
              {counts[t.id] || 0} item(s){t.allow_multi_checkout ? " · multi-checkout" : ""}
            </div>
          </div>
          <div style={{ display: "flex", gap: "8px" }}>
            <button type="button" onClick={() => moveType(i, -1)} disabled={i === 0} style={iconButtonStyle}>↑</button>
            <button type="button" onClick={() => moveType(i, 1)} disabled={i === types.length - 1} style={iconButtonStyle}>↓</button>
            <button onClick={() => editType(t)} style={buttonStyle.secondary}>Edit</button>
            <button onClick={() => handleDelete(t.id)} style={{ ...buttonStyle.secondary, color: colors.immediate }}>Delete</button>
          </div>
        </div>
      ))}
      {types.length === 0 && <p style={{ color: colors.inkSoft }}>No equipment types yet.</p>}

      {form && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(49, 56, 45, 0.5)",
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "center",
            padding: "24px 16px",
            overflowY: "auto",
            zIndex: 100,
          }}
          onClick={() => setForm(null)}
        >
          <div
            style={{ ...cardStyle, padding: "20px", width: "100%", maxWidth: "440px" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px" }}>
              <h2 style={{ fontFamily: fonts.display, fontSize: "16px", color: colors.mossDark, margin: 0 }}>
                {form.id ? "Edit equipment type" : "New equipment type"}
              </h2>
              <button type="button" onClick={() => setForm(null)} aria-label="Close" style={{ background: "none", border: "none", fontSize: "20px", color: colors.inkSoft, cursor: "pointer", lineHeight: 1 }}>×</button>
            </div>
            <form onSubmit={handleSave}>
              <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Strimmer" style={fieldStyle} />

              <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: colors.inkSoft, margin: "10px 0 6px" }}>
                Pre-use checklist (shown as a reminder on the workshop kiosk)
              </label>

              {types.filter((t) => t.id !== form.id).length > 0 && (
                <div style={{ display: "flex", gap: "8px", marginBottom: "10px" }}>
                  <select
                    value={copyFromId}
                    onChange={(e) => setCopyFromId(e.target.value)}
                    style={{ ...fieldStyle, marginBottom: 0, flex: 1 }}
                  >
                    <option value="">Copy checklist from…</option>
                    {types.filter((t) => t.id !== form.id).map((t) => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => copyChecklistFrom(copyFromId)}
                    disabled={!copyFromId}
                    style={buttonStyle.secondary}
                  >
                    Copy
                  </button>
                </div>
              )}

              <ChecklistBuilder
                items={form.pre_use_checklist}
                onChange={(items) => setForm({ ...form, pre_use_checklist: items })}
              />

              <label style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "14px", color: colors.ink, marginTop: "14px" }}>
                <input
                  type="checkbox"
                  checked={form.allow_multi_checkout}
                  onChange={(e) => setForm({ ...form, allow_multi_checkout: e.target.checked })}
                />
                Allow checking out more than one at once
              </label>
              <p style={{ fontSize: "12px", color: colors.inkSoft, marginTop: "4px", marginBottom: 0 }}>
                For kit like batteries that the team takes out and swaps in a group. On the kiosk, staff will tick as
                many units as they need before continuing, instead of picking one at a time.
              </p>

              {error && <p style={{ color: colors.immediate, fontSize: "13px", marginTop: "10px" }}>{error}</p>}

              <div style={{ display: "flex", gap: "8px" }}>
                <button type="submit" style={buttonStyle.primary}>{form.id ? "Save changes" : "Create equipment type"}</button>
                <button type="button" onClick={() => setForm(null)} style={buttonStyle.secondary}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
