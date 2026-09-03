import { useEffect, useState } from "react";
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

const labelStyle = { display: "block", fontSize: "13px", fontWeight: 600, color: colors.inkSoft, marginBottom: "6px" };

function formatDate(dateStr) {
  return new Date(`${dateStr}T00:00:00`).toLocaleDateString("en-GB");
}

// Whole days between today and the expiry date -- negative once past.
function daysUntil(dateStr) {
  const today = new Date(new Date().toISOString().slice(0, 10));
  const expiry = new Date(dateStr);
  return Math.round((expiry - today) / 86400000);
}

function DocumentRow({ doc, onDelete }) {
  const [url, setUrl] = useState(null);

  useEffect(() => {
    if (!doc.storage_path) return;
    let cancelled = false;
    supabase.storage
      .from("contractor-documents")
      .createSignedUrl(doc.storage_path, 3600)
      .then(({ data }) => {
        if (!cancelled && data) setUrl(data.signedUrl);
      });
    return () => {
      cancelled = true;
    };
  }, [doc.storage_path]);

  const days = doc.expiry_date ? daysUntil(doc.expiry_date) : null;
  const expiryColor = days == null ? colors.inkSoft : days < 0 ? colors.immediate : days <= 7 ? colors.gold : colors.inkSoft;
  const expiryLabel =
    days == null ? "No expiry set" : days < 0 ? `Expired ${formatDate(doc.expiry_date)}` : days <= 7 ? `Expires ${formatDate(doc.expiry_date)} — ${days} day${days === 1 ? "" : "s"} left` : `Expires ${formatDate(doc.expiry_date)}`;

  return (
    <div style={{ ...cardStyle, padding: "12px 16px", marginBottom: "8px", display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "12px" }}>
      <div>
        <div style={{ fontWeight: 600 }}>
          {url ? (
            <a href={url} target="_blank" rel="noreferrer" style={{ color: colors.moss }}>{doc.description}</a>
          ) : (
            <>{doc.description}{!doc.storage_path && " (no file)"}</>
          )}
        </div>
        <div style={{ fontSize: "12px", color: expiryColor }}>{expiryLabel}</div>
        {doc.reminder_triggered_at && <div style={{ fontSize: "11px", color: colors.inkSoft }}>Renewal reminder already sent</div>}
      </div>
      <button onClick={() => onDelete(doc)} style={{ ...buttonStyle.secondary, color: colors.immediate, padding: "4px 10px", fontSize: "12px" }}>Delete</button>
    </div>
  );
}

// Andy: proof of qualifications, insurance, and H&S documents per
// contractor, each expiring (or not) independently -- one row per
// document rather than one blob per contractor, so a renewed insurance
// certificate doesn't affect a qualification's own expiry tracking.
// contractor-document-reminders (Edge Function) reads expiry_date +
// reminder_triggered_at from the same contractor_documents rows this
// modal writes.
export default function ContractorDocumentsModal({ contractor, orgId, onClose }) {
  const [documents, setDocuments] = useState([]);
  const [description, setDescription] = useState("");
  const [expiryDate, setExpiryDate] = useState("");
  const [file, setFile] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  function refresh() {
    supabase
      .from("contractor_documents")
      .select("id, description, expiry_date, storage_path, reminder_triggered_at")
      .eq("contractor_id", contractor.id)
      .order("expiry_date", { ascending: true, nullsFirst: false })
      .then(({ data, error: err }) => {
        if (err) setError(err.message);
        else setDocuments(data || []);
      });
  }

  useEffect(refresh, [contractor.id]);

  async function handleAdd(e) {
    e.preventDefault();
    if (!description.trim() || !file) return;
    setSaving(true);
    setError(null);
    try {
      const docId = crypto.randomUUID();
      const { error: insertError } = await supabase.from("contractor_documents").insert({
        id: docId,
        org_id: orgId,
        contractor_id: contractor.id,
        description: description.trim(),
        expiry_date: expiryDate || null,
      });
      if (insertError) throw insertError;

      const path = `${contractor.id}/${docId}-${file.name}`;
      const { error: uploadError } = await supabase.storage.from("contractor-documents").upload(path, file, { upsert: true });
      if (uploadError) throw uploadError;

      const { error: pathError } = await supabase.from("contractor_documents").update({ storage_path: path }).eq("id", docId);
      if (pathError) throw pathError;

      setDescription("");
      setExpiryDate("");
      setFile(null);
      refresh();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(doc) {
    if (!window.confirm(`Delete "${doc.description}"?`)) return;
    if (doc.storage_path) await supabase.storage.from("contractor-documents").remove([doc.storage_path]);
    const { error: err } = await supabase.from("contractor_documents").delete().eq("id", doc.id);
    if (err) setError(err.message);
    else refresh();
  }

  return (
    <div
      style={{ position: "fixed", inset: 0, background: colors.scrim, display: "flex", alignItems: "flex-start", justifyContent: "center", padding: "24px 16px", overflowY: "auto", zIndex: 110 }}
      onClick={onClose}
    >
      <div style={{ ...cardStyle, padding: "20px", width: "100%", maxWidth: "520px" }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px" }}>
          <h2 style={{ fontFamily: fonts.display, fontSize: "16px", color: colors.mossDark, margin: 0 }}>{contractor.name} — Documents</h2>
          <button type="button" onClick={onClose} aria-label="Close" style={{ background: "none", border: "none", fontSize: "20px", color: colors.inkSoft, cursor: "pointer", lineHeight: 1 }}>×</button>
        </div>

        {documents.map((d) => (
          <DocumentRow key={d.id} doc={d} onDelete={handleDelete} />
        ))}
        {documents.length === 0 && <p style={{ color: colors.inkSoft, fontSize: "13px" }}>No documents uploaded yet.</p>}

        <h3 style={{ fontFamily: fonts.display, fontSize: "14px", color: colors.mossDark, marginTop: "18px" }}>Add a document</h3>
        <form onSubmit={handleAdd}>
          <label style={labelStyle}>Description</label>
          <input required value={description} onChange={(e) => setDescription(e.target.value)} placeholder="e.g. Public liability insurance" style={fieldStyle} />

          <label style={labelStyle}>Expiry date (optional)</label>
          <input type="date" value={expiryDate} onChange={(e) => setExpiryDate(e.target.value)} style={fieldStyle} />
          <p style={{ fontSize: "12px", color: colors.inkSoft, marginTop: "-6px" }}>
            7 days before this date, a job is raised for the Office group and {contractor.main_email ? "an email is sent to " + contractor.main_email : "no email is sent (no address on file)"} asking for an updated copy.
          </p>

          <label style={labelStyle}>File</label>
          <input required type="file" onChange={(e) => setFile(e.target.files?.[0] || null)} style={{ marginBottom: "10px" }} />

          {error && <p style={{ color: colors.immediate, fontSize: "13px" }}>{error}</p>}

          <button type="submit" disabled={saving} style={buttonStyle.primary}>{saving ? "Uploading…" : "Add document"}</button>
        </form>
      </div>
    </div>
  );
}
