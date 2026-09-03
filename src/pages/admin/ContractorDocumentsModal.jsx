import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabaseClient.js";
import { colors, space } from "../../lib/theme.js";
import { Alert, Button, Card, EmptyState, Input, Modal, PageHeader } from "../../ui/index.js";

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
    <Card pad="sm" style={{ marginBottom: "var(--space-2)", display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "var(--space-3)" }}>
      <div>
        <div style={{ fontWeight: 600 }}>
          {url ? (
            <a href={url} target="_blank" rel="noreferrer" style={{ color: colors.moss }}>{doc.description}</a>
          ) : (
            <>{doc.description}{!doc.storage_path && " (no file)"}</>
          )}
        </div>
        <div style={{ fontSize: "var(--text-xs)", color: expiryColor }}>{expiryLabel}</div>
        {doc.reminder_triggered_at && <div style={{ fontSize: "var(--text-xs)", color: colors.inkSoft }}>Renewal reminder already sent</div>}
      </div>
      <Button variant="danger" size="sm" onClick={() => onDelete(doc)}>Delete</Button>
    </Card>
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
    <Modal title={`${contractor.name} — Documents`} onClose={onClose} maxWidth="520px">

        {documents.map((d) => (
          <DocumentRow key={d.id} doc={d} onDelete={handleDelete} />
        ))}
        {documents.length === 0 && <EmptyState title="No documents uploaded yet" />}

        <PageHeader title="Add a document" level={2} />
        <form onSubmit={handleAdd}>
          <label className="tt-field__label">Description</label>
          <Input required value={description} onChange={(e) => setDescription(e.target.value)} placeholder="e.g. Public liability insurance" style={{ marginBottom: "var(--space-3)" }} />

          <label className="tt-field__label">Expiry date (optional)</label>
          <Input type="date" value={expiryDate} onChange={(e) => setExpiryDate(e.target.value)} style={{ marginBottom: "var(--space-3)" }} />
          <p style={{ fontSize: "var(--text-xs)", color: colors.inkSoft, marginTop: "calc(-1 * var(--space-2))" }}>
            7 days before this date, a job is raised for the Office group and {contractor.main_email ? "an email is sent to " + contractor.main_email : "no email is sent (no address on file)"} asking for an updated copy.
          </p>

          <label className="tt-field__label">File</label>
          <input required type="file" onChange={(e) => setFile(e.target.files?.[0] || null)} style={{ marginBottom: "var(--space-3)" }} />

          {error && (
            <Alert tone="danger" title="Something went wrong">
              {error}
            </Alert>
          )}

          <Button variant="primary" type="submit" disabled={saving}>{saving ? "Uploading…" : "Add document"}</Button>
        </form>
          </Modal>
  );
}
