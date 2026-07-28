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

const blank = { id: null, name: "", requires_completion_photo: false, template_schema: [], activityTypeIds: [] };

export default function JobTemplatesTab() {
  const { org } = useAuth();
  const [templates, setTemplates] = useState([]);
  const [activityTypes, setActivityTypes] = useState([]);
  const [linksByType, setLinksByType] = useState({}); // job_type_id -> [task_type_id]
  const [form, setForm] = useState(blank);
  const [error, setError] = useState(null);

  function refresh() {
    Promise.all([
      supabase.from("job_types").select("id, name, requires_completion_photo, template_schema").eq("org_id", org.id),
      supabase.from("task_types").select("id, name").eq("org_id", org.id),
      supabase.from("job_type_task_types").select("job_type_id, task_type_id"),
    ]).then(([{ data: jt, error: err }, { data: tt }, { data: links }]) => {
      if (err) setError(err.message);
      else setTemplates(jt || []);
      setActivityTypes(tt || []);
      const grouped = {};
      for (const link of links || []) {
        grouped[link.job_type_id] = [...(grouped[link.job_type_id] || []), link.task_type_id];
      }
      setLinksByType(grouped);
    });
  }

  useEffect(refresh, [org]);

  function editTemplate(t) {
    setForm({
      id: t.id,
      name: t.name,
      requires_completion_photo: t.requires_completion_photo,
      template_schema: t.template_schema || [],
      activityTypeIds: linksByType[t.id] || [],
    });
  }

  function toggleActivityType(id) {
    setForm((f) => ({
      ...f,
      activityTypeIds: f.activityTypeIds.includes(id) ? f.activityTypeIds.filter((i) => i !== id) : [...f.activityTypeIds, id],
    }));
  }

  async function handleSave(e) {
    e.preventDefault();
    setError(null);
    const payload = {
      org_id: org.id,
      name: form.name,
      requires_completion_photo: form.requires_completion_photo,
      template_schema: form.template_schema,
    };
    const { data: saved, error: err } = form.id
      ? await supabase.from("job_types").update(payload).eq("id", form.id).select().single()
      : await supabase.from("job_types").insert(payload).select().single();
    if (err) {
      setError(err.message);
      return;
    }

    const previousLinks = linksByType[saved.id] || [];
    const toAdd = form.activityTypeIds.filter((id) => !previousLinks.includes(id));
    const toRemove = previousLinks.filter((id) => !form.activityTypeIds.includes(id));

    if (toAdd.length > 0) {
      await supabase.from("job_type_task_types").insert(toAdd.map((task_type_id) => ({ job_type_id: saved.id, task_type_id })));
    }
    for (const task_type_id of toRemove) {
      await supabase.from("job_type_task_types").delete().eq("job_type_id", saved.id).eq("task_type_id", task_type_id);
    }

    setForm(blank);
    refresh();
  }

  async function handleDelete(id) {
    const { error: err } = await supabase.from("job_types").delete().eq("id", id);
    if (err) setError(err.message);
    else refresh();
  }

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px" }}>
      <div>
        <h2 style={{ fontFamily: fonts.display, fontSize: "16px", color: colors.mossDark }}>Job templates</h2>
        {templates.map((t) => (
          <div key={t.id} style={{ ...cardStyle, padding: "12px 16px", marginBottom: "8px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <div style={{ fontWeight: 600 }}>{t.name}</div>
              <div style={{ fontSize: "12px", color: colors.inkSoft }}>
                {(t.template_schema || []).length} checklist item(s) · {(linksByType[t.id] || []).length} default activity type(s){t.requires_completion_photo ? " · photo required to complete" : ""}
              </div>
            </div>
            <div style={{ display: "flex", gap: "8px" }}>
              <button onClick={() => editTemplate(t)} style={buttonStyle.secondary}>Edit</button>
              <button onClick={() => handleDelete(t.id)} style={{ ...buttonStyle.secondary, color: colors.immediate }}>Delete</button>
            </div>
          </div>
        ))}
        {templates.length === 0 && <p style={{ color: colors.inkSoft }}>No job templates yet.</p>}
      </div>

      <div>
        <h2 style={{ fontFamily: fonts.display, fontSize: "16px", color: colors.mossDark }}>{form.id ? "Edit template" : "New template"}</h2>
        <form onSubmit={handleSave} style={{ ...cardStyle, padding: "16px" }}>
          <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Template name" style={fieldStyle} />
          <label style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "14px", marginBottom: "12px" }}>
            <input
              type="checkbox"
              checked={form.requires_completion_photo}
              onChange={(e) => setForm({ ...form, requires_completion_photo: e.target.checked })}
            />
            Require a photo to mark jobs of this type complete
          </label>

          <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: colors.inkSoft, marginBottom: "6px" }}>Default checklist</label>
          <ChecklistBuilder items={form.template_schema} onChange={(items) => setForm({ ...form, template_schema: items })} />

          <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: colors.inkSoft, margin: "14px 0 6px" }}>Default activity types</label>
          <p style={{ fontSize: "12px", color: colors.inkSoft, marginTop: 0 }}>Ticked automatically when this template is picked on a new job — still editable per job afterward.</p>
          {activityTypes.length === 0 && <p style={{ color: colors.inkSoft, fontSize: "13px" }}>No activity types set up yet — add some in the Activity Types tab first.</p>}
          {activityTypes.map((a) => (
            <label key={a.id} style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "14px", padding: "3px 0" }}>
              <input type="checkbox" checked={form.activityTypeIds.includes(a.id)} onChange={() => toggleActivityType(a.id)} />
              {a.name}
            </label>
          ))}

          {error && <p style={{ color: colors.immediate, fontSize: "13px" }}>{error}</p>}

          <div style={{ display: "flex", gap: "8px", marginTop: "14px" }}>
            <button type="submit" style={buttonStyle.primary}>{form.id ? "Save changes" : "Create template"}</button>
            {form.id && <button type="button" onClick={() => setForm(blank)} style={buttonStyle.secondary}>Cancel</button>}
          </div>
        </form>
      </div>
    </div>
  );
}
