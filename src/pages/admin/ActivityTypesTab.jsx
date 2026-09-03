import { useEffect, useState } from "react";
import { useAuth } from "../../lib/AuthContext.jsx";
import { supabase } from "../../lib/supabaseClient.js";
import DocumentPicker from "../../components/DocumentPicker.jsx";
import { colors, space } from "../../lib/theme.js";
import { Alert, Button, Card, Input, PageHeader } from "../../ui/index.js";

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
      supabase.from("ra_ms_documents").select("id, type, title").eq("org_id", org.id).order("title"),
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
      const { error: linkErr } = await supabase
        .from("activity_type_documents")
        .insert(toAdd.map((document_id) => ({ task_type_id: saved.id, document_id })));
      if (linkErr) {
        setError(`Saved, but couldn't update its linked documents: ${linkErr.message}`);
        refresh();
        return;
      }
    }
    for (const document_id of toRemove) {
      const { error: unlinkErr } = await supabase
        .from("activity_type_documents")
        .delete()
        .eq("task_type_id", saved.id)
        .eq("document_id", document_id);
      if (unlinkErr) {
        setError(`Saved, but couldn't update its linked documents: ${unlinkErr.message}`);
        refresh();
        return;
      }
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
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-5)" }}>
      <div>
        <PageHeader title="Activity types" level={2} />
        {activityTypes.map((t) => (
          <Card pad="sm" key={t.id} style={{ marginBottom: "var(--space-2)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <div style={{ fontWeight: 600 }}>{t.name}</div>
              <div style={{ fontSize: "var(--text-xs)", color: colors.inkSoft }}>{(linksByType[t.id] || []).length} RA/MS document(s) linked</div>
            </div>
            <div style={{ display: "flex", gap: "var(--space-2)" }}>
              <Button onClick={() => editType(t)}>Edit</Button>
              <Button variant="danger" onClick={() => handleDelete(t.id)}>Delete</Button>
            </div>
          </Card>
        ))}
        {activityTypes.length === 0 && <p style={{ color: colors.inkSoft }}>No activity types yet.</p>}
      </div>

      <div>
        <PageHeader title={form.id ? "Edit activity type" : "New activity type"} level={2} />
        <Card as="form" pad="md" onSubmit={handleSave}>
          <Input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Strimming" style={{ marginBottom: "var(--space-3)" }} />
          <Input value={form.equipment_category} onChange={(e) => setForm({ ...form, equipment_category: e.target.value })} placeholder="Equipment category (optional)" style={{ marginBottom: "var(--space-3)" }} />

          <label style={{ display: "block", fontSize: "var(--text-sm)", fontWeight: 600, color: colors.inkSoft, marginBottom: "var(--space-2)" }}>Linked RA/MS documents</label>
          <DocumentPicker documents={documents} selectedIds={form.documentIds} onToggle={toggleDocument} />

          {error && (
            <Alert tone="danger" title="Something went wrong">
              {error}
            </Alert>
          )}

          <div style={{ display: "flex", gap: "var(--space-2)", marginTop: "var(--space-4)" }}>
            <Button variant="primary" type="submit">{form.id ? "Save changes" : "Create activity type"}</Button>
            {form.id && <Button onClick={() => setForm(blank)}>Cancel</Button>}
          </div>
        </Card>
      </div>
    </div>
  );
}
