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
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px" }}>
      <div>
        <h2 style={{ fontFamily: fonts.display, fontSize: "16px", color: colors.mossDark }}>RA/MS library</h2>
        {documents.map((d) => (
          <div key={d.id} style={{ ...cardStyle, padding: "12px 16px", marginBottom: "8px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <div style={{ fontSize: "12px", color: colors.inkSoft, textTransform: "capitalize" }}>{d.type.replace("_", " ")}</div>
              <div style={{ fontWeight: 600 }}>{d.title}</div>
              <div style={{ fontSize: "12px", color: d.pdf_storage_path ? colors.moss : colors.gold }}>{d.pdf_storage_path ? "PDF attached" : "No PDF yet"}</div>
            </div>
            <div style={{ display: "flex", gap: "8px" }}>
              <button onClick={() => editDocument(d)} style={buttonStyle.secondary}>Edit</button>
              <button onClick={() => handleDelete(d.id)} style={{ ...buttonStyle.secondary, color: colors.immediate }}>Delete</button>
            </div>
          </div>
        ))}
        {documents.length === 0 && <p style={{ color: colors.inkSoft }}>No documents yet.</p>}
      </div>

      <div>
        <h2 style={{ fontFamily: fonts.display, fontSize: "16px", color: colors.mossDark }}>{form.id ? "Edit document" : "New document"}</h2>
        <form onSubmit={handleSave} style={{ ...cardStyle, padding: "16px" }}>
          <div style={{ display: "flex", gap: "14px", marginBottom: "10px" }}>
            <label><input type="radio" checked={form.type === "risk_assessment"} onChange={() => setForm({ ...form, type: "risk_assessment" })} /> Risk assessment</label>
            <label><input type="radio" checked={form.type === "method_statement"} onChange={() => setForm({ ...form, type: "method_statement" })} /> Method statement</label>
          </div>
          <input required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Title" style={fieldStyle} />
          <textarea
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            placeholder="Short summary (optional) — shown next to the PDF link"
            rows={3}
            style={{ ...fieldStyle, resize: "vertical" }}
          />

          <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: colors.inkSoft, marginBottom: "6px" }}>PDF</label>
          {form.pdf_storage_path && !pdfFile && <p style={{ fontSize: "13px", color: colors.inkSoft }}>Current file attached — choose a new one to replace it.</p>}
          <input type="file" accept="application/pdf" onChange={(e) => setPdfFile(e.target.files?.[0] || null)} style={{ marginBottom: "10px" }} />

          {error && <p style={{ color: colors.immediate, fontSize: "13px" }}>{error}</p>}

          <div style={{ display: "flex", gap: "8px", marginTop: "10px" }}>
            <button type="submit" disabled={saving} style={buttonStyle.primary}>{saving ? "Saving…" : form.id ? "Save changes" : "Create document"}</button>
            {form.id && <button type="button" onClick={() => { setForm(blank); setPdfFile(null); }} style={buttonStyle.secondary}>Cancel</button>}
          </div>
        </form>
      </div>
    </div>
  );
}
