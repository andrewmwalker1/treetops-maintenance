import { useEffect, useState } from "react";
import { useAuth } from "../../lib/AuthContext.jsx";
import { usePermissions } from "../../lib/permissions.js";
import { supabase } from "../../lib/supabaseClient.js";
import ChecklistBuilder from "../../components/ChecklistBuilder.jsx";
import { colors, space } from "../../lib/theme.js";
import { Alert, Button, Card, Input, PageHeader } from "../../ui/index.js";

const blank = { id: null, name: "", requires_completion_photo: false, template_schema: [], activityTypeIds: [] };

export default function JobTemplatesTab() {
  const { org } = useAuth();
  const permissions = usePermissions();
  const canRequireChecklistItemPhoto = permissions.has("can_require_checklist_item_photo");
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
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-5)" }}>
      <div>
        <PageHeader title="Job templates" level={2} />
        {templates.map((t) => (
          <Card pad="sm" key={t.id} style={{ marginBottom: "var(--space-2)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <div style={{ fontWeight: 600 }}>{t.name}</div>
              <div style={{ fontSize: "var(--text-xs)", color: colors.inkSoft }}>
                {(t.template_schema || []).length} checklist item(s) · {(linksByType[t.id] || []).length} default activity type(s){t.requires_completion_photo ? " · photo required to complete" : ""}
              </div>
            </div>
            <div style={{ display: "flex", gap: "var(--space-2)" }}>
              <Button onClick={() => editTemplate(t)}>Edit</Button>
              <Button variant="danger" onClick={() => handleDelete(t.id)}>Delete</Button>
            </div>
          </Card>
        ))}
        {templates.length === 0 && <p style={{ color: colors.inkSoft }}>No job templates yet.</p>}
      </div>

      <div>
        <PageHeader title={form.id ? "Edit template" : "New template"} level={2} />
        <Card as="form" pad="md" onSubmit={handleSave}>
          <Input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Template name" style={{ marginBottom: "var(--space-3)" }} />
          <label style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", fontSize: "var(--text-base)", marginBottom: "var(--space-3)" }}>
            <input
              type="checkbox"
              checked={form.requires_completion_photo}
              onChange={(e) => setForm({ ...form, requires_completion_photo: e.target.checked })}
            />
            Require a photo to mark jobs of this type complete
          </label>

          <label style={{ display: "block", fontSize: "var(--text-sm)", fontWeight: 600, color: colors.inkSoft, marginBottom: "var(--space-2)" }}>Default checklist</label>
          <ChecklistBuilder
            items={form.template_schema}
            onChange={(items) => setForm({ ...form, template_schema: items })}
            canRequirePhoto={canRequireChecklistItemPhoto}
          />

          <label style={{ display: "block", fontSize: "var(--text-sm)", fontWeight: 600, color: colors.inkSoft, margin: "var(--space-4) 0 var(--space-2)" }}>Default activity types</label>
          <p style={{ fontSize: "var(--text-xs)", color: colors.inkSoft, marginTop: 0 }}>Ticked automatically when this template is picked on a new job — still editable per job afterward.</p>
          {activityTypes.length === 0 && <p style={{ color: colors.inkSoft, fontSize: "var(--text-sm)" }}>No activity types set up yet — add some in the Activity Types tab first.</p>}
          {activityTypes.map((a) => (
            <label key={a.id} style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", fontSize: "var(--text-base)", padding: "var(--space-1) 0" }}>
              <input type="checkbox" checked={form.activityTypeIds.includes(a.id)} onChange={() => toggleActivityType(a.id)} />
              {a.name}
            </label>
          ))}

          {error && (
            <Alert tone="danger" title="Something went wrong">
              {error}
            </Alert>
          )}

          <div style={{ display: "flex", gap: "var(--space-2)", marginTop: "var(--space-4)" }}>
            <Button variant="primary" type="submit">{form.id ? "Save changes" : "Create template"}</Button>
            {form.id && <Button onClick={() => setForm(blank)}>Cancel</Button>}
          </div>
        </Card>
      </div>
    </div>
  );
}
