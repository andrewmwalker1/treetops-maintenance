import { useEffect, useState } from "react";
import { useAuth } from "../../lib/AuthContext.jsx";
import { supabase } from "../../lib/supabaseClient.js";
import { colors, space } from "../../lib/theme.js";
import { Alert, Button, Card, EmptyState, Input, PageHeader, Textarea } from "../../ui/index.js";

const blank = { id: null, type: "risk_assessment", title: "", description: "", pdf_storage_path: null };

export default function SafetyLibraryTab() {
  const { org } = useAuth();
  const [documents, setDocuments] = useState([]);
  const [form, setForm] = useState(blank);
  const [pdfFile, setPdfFile] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  function refresh() {
    supabase
      .from("ra_ms_documents")
      .select("id, type, title, description, pdf_storage_path")
      .eq("org_id", org.id)
      .order("title")
      .then(({ data, error: err }) => {
        if (err) setError(err.message);
        else setDocuments(data || []);
      });
  }

  useEffect(refresh, [org]);

  function editDocument(d) {
    setForm({ id: d.id, type: d.type, title: d.title, description: d.description || "", pdf_storage_path: d.pdf_storage_path });
    setPdfFile(null);
  }

  async function handleSave(e) {
    e.preventDefault();
    setSaving(true);
    setError(null);

    try {
      const docId = form.id || crypto.randomUUID();
      const payload = { id: docId, org_id: org.id, type: form.type, title: form.title, description: form.description || null, updated_at: new Date().toISOString() };

      const { error: upsertError } = await supabase.from("ra_ms_documents").upsert(payload);
      if (upsertError) throw upsertError;

      if (pdfFile) {
        const path = `${docId}/${pdfFile.name}`;
        const { error: uploadError } = await supabase.storage.from("ra-ms-pdfs").upload(path, pdfFile, { upsert: true });
        if (uploadError) throw uploadError;
        const { error: pathError } = await supabase.from("ra_ms_documents").update({ pdf_storage_path: path }).eq("id", docId);
        if (pathError) throw pathError;
      }

      setForm(blank);
      setPdfFile(null);
      refresh();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id) {
    const { error: err } = await supabase.from("ra_ms_documents").delete().eq("id", id);
    if (err) setError(err.message);
    else refresh();
  }

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-5)" }}>
      <div>
        <PageHeader title="RA/MS library" level={2} />
        {documents.map((d) => (
          <Card pad="sm" key={d.id} style={{ marginBottom: "var(--space-2)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <div style={{ fontSize: "var(--text-xs)", color: colors.inkSoft, textTransform: "capitalize" }}>{d.type.replace("_", " ")}</div>
              <div style={{ fontWeight: 600 }}>{d.title}</div>
              <div style={{ fontSize: "var(--text-xs)", color: d.pdf_storage_path ? colors.moss : colors.gold }}>{d.pdf_storage_path ? "PDF attached" : "No PDF yet"}</div>
            </div>
            <div style={{ display: "flex", gap: "var(--space-2)" }}>
              <Button onClick={() => editDocument(d)}>Edit</Button>
              <Button variant="danger" onClick={() => handleDelete(d.id)}>Delete</Button>
            </div>
          </Card>
        ))}
        {documents.length === 0 && <EmptyState title="No documents yet" />}
      </div>

      <div>
        <PageHeader title={form.id ? "Edit document" : "New document"} level={2} />
        <Card as="form" pad="md" onSubmit={handleSave}>
          <div style={{ display: "flex", gap: "var(--space-4)", marginBottom: "var(--space-3)" }}>
            <label><input type="radio" checked={form.type === "risk_assessment"} onChange={() => setForm({ ...form, type: "risk_assessment" })} /> Risk assessment</label>
            <label><input type="radio" checked={form.type === "method_statement"} onChange={() => setForm({ ...form, type: "method_statement" })} /> Method statement</label>
          </div>
          <Input required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Title" style={{ marginBottom: "var(--space-3)" }} />
          <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Short summary (optional) — shown next to the PDF link" rows={3} style={{ marginBottom: "var(--space-3)" }} />

          <label style={{ display: "block", fontSize: "var(--text-sm)", fontWeight: 600, color: colors.inkSoft, marginBottom: "var(--space-2)" }}>PDF</label>
          {form.pdf_storage_path && !pdfFile && <p style={{ fontSize: "var(--text-sm)", color: colors.inkSoft }}>Current file attached — choose a new one to replace it.</p>}
          <input type="file" accept="application/pdf" onChange={(e) => setPdfFile(e.target.files?.[0] || null)} style={{ marginBottom: "var(--space-3)" }} />

          {error && (
            <Alert tone="danger" title="Something went wrong">
              {error}
            </Alert>
          )}

          <div style={{ display: "flex", gap: "var(--space-2)", marginTop: "var(--space-3)" }}>
            <Button variant="primary" type="submit" disabled={saving}>{saving ? "Saving…" : form.id ? "Save changes" : "Create document"}</Button>
            {form.id && <Button onClick={() => { setForm(blank); setPdfFile(null); }}>Cancel</Button>}
          </div>
        </Card>
      </div>
    </div>
  );
}
