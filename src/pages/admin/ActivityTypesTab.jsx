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

const blank = { id: null, name: "", equipment_category: "", documentIds: [] };

export default function ActivityTypesTab() {
  const { org } = useAuth();
  const [activityTypes, setActivityTypes] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [linksByType, setLinksByType] = useState({});
  const [form, setForm] = useState(blank);
  const [error, setError] = useState(null);

  function refresh() {
    Promise.all([
      supabase.from("task_types").select("id, name, equipment_category").eq("org_id", org.id),
      supabase.from("ra_ms_documents").select("id, type, title").eq("org_id", org.id),
      supabase.from("activity_type_documents").select("task_type_id, document_id"),
    ]).then(([{ data: tt }, { data: docs }, { data: links }]) => {
      setActivityTypes(tt || []);
      setDocuments(docs || []);
      const grouped = {};
      for (const link of links || []) {
        grouped[link.task_type_id] = [...(grouped[link.task_type_id] || []), link.document_id];
      }
      setLinksByType(grouped);
    });
  }

  useEffect(refresh, [org]);

  function editType(t) {
    setForm({ id: t.id, name: t.name, equipment_category: t.equipment_category || "", documentIds: linksByType[t.id] || [] });
  }

  function toggleDocument(docId) {
    setForm((f) => ({
      ...f,
      documentIds: f.documentIds.includes(docId) ? f.documentIds.filter((id) => id !== docId) : [...f.documentIds, docId],
    }));
  }

  async function handleSave(e) {
    e.preventDefault();
    setError(null);

    const payload = { org_id: org.id, name: form.name, equipment_category: form.equipment_category || null };
    const { data: saved, error: err } = form.id
      ? await supabase.from("task_types").update(payload).eq("id", form.id).select().single()
      : await supabase.from("task_types").insert(payload).select().single();
    if (err) {
      setError(err.message);
      return;
    }

    const previousLinks = linksByType[saved.id] || [];
    const toAdd = form.documentIds.filter((id) => !previousLinks.includes(id));
    const toRemove = previousLinks.filter((id) => !form.documentIds.includes(id));

    if (toAdd.length > 0) {
      await supabase.from("activity_type_documents").insert(toAdd.map((document_id) => ({ task_type_id: saved.id, document_id })));
    }
    for (const document_id of toRemove) {
      await supabase.from("activity_type_documents").delete().eq("task_type_id", saved.id).eq("document_id", document_id);
    }

    setForm(blank);
    refresh();
  }

  async function handleDelete(id) {
    const { error: err } = await supabase.from("task_types").delete().eq("id", id);
    if (err) setError(err.message);
    else refresh();
  }

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px" }}>
      <div>
        <h2 style={{ fontFamily: fonts.display, fontSize: "16px", color: colors.mossDark }}>Activity types</h2>
        {activityTypes.map((t) => (
          <div key={t.id} style={{ ...cardStyle, padding: "12px 16px", marginBottom: "8px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <div style={{ fontWeight: 600 }}>{t.name}</div>
              <div style={{ fontSize: "12px", color: colors.inkSoft }}>{(linksByType[t.id] || []).length} RA/MS document(s) linked</div>
            </div>
            <div style={{ display: "flex", gap: "8px" }}>
              <button onClick={() => editType(t)} style={buttonStyle.secondary}>Edit</button>
              <button onClick={() => handleDelete(t.id)} style={{ ...buttonStyle.secondary, color: colors.immediate }}>Delete</button>
            </div>
          </div>
        ))}
        {activityTypes.length === 0 && <p style={{ color: colors.inkSoft }}>No activity types yet.</p>}
      </div>

      <div>
        <h2 style={{ fontFamily: fonts.display, fontSize: "16px", color: colors.mossDark }}>{form.id ? "Edit activity type" : "New activity type"}</h2>
        <form onSubmit={handleSave} style={{ ...cardStyle, padding: "16px" }}>
          <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Strimming" style={fieldStyle} />
          <input
            value={form.equipment_category}
            onChange={(e) => setForm({ ...form, equipment_category: e.target.value })}
            placeholder="Equipment category (optional)"
            style={fieldStyle}
          />

          <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: colors.inkSoft, marginBottom: "6px" }}>Linked RA/MS documents</label>
          {documents.length === 0 && <p style={{ color: colors.inkSoft, fontSize: "13px" }}>No documents in the library yet — add some in the Safety Library tab first.</p>}
          {documents.map((d) => (
            <label key={d.id} style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "14px", padding: "3px 0" }}>
              <input type="checkbox" checked={form.documentIds.includes(d.id)} onChange={() => toggleDocument(d.id)} />
              <span style={{ fontSize: "12px", color: colors.inkSoft, textTransform: "capitalize" }}>{d.type.replace("_", " ")}</span> {d.title}
            </label>
          ))}

          {error && <p style={{ color: colors.immediate, fontSize: "13px" }}>{error}</p>}

          <div style={{ display: "flex", gap: "8px", marginTop: "14px" }}>
            <button type="submit" style={buttonStyle.primary}>{form.id ? "Save changes" : "Create activity type"}</button>
            {form.id && <button type="button" onClick={() => setForm(blank)} style={buttonStyle.secondary}>Cancel</button>}
          </div>
        </form>
      </div>
    </div>
  );
}
