import { useEffect, useState } from "react";
import { useAuth } from "../../lib/AuthContext.jsx";
import { supabase } from "../../lib/supabaseClient.js";
import ContractorDocumentsModal from "./ContractorDocumentsModal.jsx";
import KeyReasonsModal from "./KeyReasonsModal.jsx";
import { colors, space } from "../../lib/theme.js";
import { Alert, Button, Card, EmptyState, Input, Modal, PageHeader, Textarea } from "../../ui/index.js";

const blank = {
  id: null,
  name: "",
  address: "",
  main_email: "",
  main_phone: "",
  notes: "",
  is_trusted: false,
};

export default function ContractorsTab() {
  const { org } = useAuth();
  const [contractors, setContractors] = useState([]);
  const [keysOutByContractor, setKeysOutByContractor] = useState({});
  const [form, setForm] = useState(null); // null = modal closed
  const [docsFor, setDocsFor] = useState(null); // contractor whose documents modal is open, or null
  const [reasonsFor, setReasonsFor] = useState(null); // contractor whose reasons modal is open, or null
  const [error, setError] = useState(null);

  function refresh() {
    supabase
      .from("contractors")
      .select("id, name, address, main_email, main_phone, notes, is_trusted")
      .eq("org_id", org?.id)
      .order("name")
      .then(({ data, error: err }) => {
        if (err) setError(err.message);
        else setContractors(data || []);
      });
    // Covers both a staff member checking a key out to a contractor AND a
    // trusted contractor's own login checking one out for themselves --
    // both land as issued_to_contractor_id on the same row (see
    // 43-contractor-linked-profiles.sql). Only visible to whatever this
    // admin's own can_use_key_system/can_manage_keys grants let key_checkouts'
    // RLS return -- someone with can_manage_contractors but no key
    // permission will just see 0 here rather than an error.
    supabase
      .from("key_checkouts")
      .select("issued_to_contractor_id")
      .is("checked_in_at", null)
      .not("issued_to_contractor_id", "is", null)
      .then(({ data }) => {
        const counts = {};
        for (const row of data || []) counts[row.issued_to_contractor_id] = (counts[row.issued_to_contractor_id] || 0) + 1;
        setKeysOutByContractor(counts);
      });
  }

  useEffect(refresh, [org]);

  function editItem(c) {
    setError(null);
    setForm({
      id: c.id,
      name: c.name,
      address: c.address || "",
      main_email: c.main_email || "",
      main_phone: c.main_phone || "",
      notes: c.notes || "",
      is_trusted: c.is_trusted,
    });
  }

  async function handleSave(e) {
    e.preventDefault();
    setError(null);
    const payload = {
      name: form.name,
      address: form.address || null,
      main_email: form.main_email || null,
      main_phone: form.main_phone || null,
      notes: form.notes || null,
      is_trusted: form.is_trusted,
    };
    let err;
    if (form.id) {
      ({ error: err } = await supabase.from("contractors").update(payload).eq("id", form.id));
    } else {
      ({ error: err } = await supabase.from("contractors").insert({ ...payload, org_id: org.id }));
    }
    if (err) {
      setError(err.message);
      return;
    }
    setForm(null);
    refresh();
  }

  async function handleDelete(id) {
    if (!window.confirm("Delete this contractor? Any jobs assigned to them will become unassigned.")) return;
    const { error: err } = await supabase.from("contractors").delete().eq("id", id);
    if (err) setError(err.message);
    else refresh();
  }

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "var(--space-4)" }}>
        <PageHeader title="Contractors" level={2} />
        <Button variant="primary" onClick={() => { setError(null); setForm(blank); }}>+ Add contractor</Button>
      </div>

      {contractors.map((c) => (
        <Card pad="sm" key={c.id} style={{ marginBottom: "var(--space-2)", display: "flex", justifyContent: "space-between", alignItems: "center", gap: "var(--space-3)", flexWrap: "wrap" }}>
          <div>
            <div style={{ fontWeight: 600 }}>
              {c.name}
              {c.is_trusted ? " · Trusted (key station)" : ""}
              {keysOutByContractor[c.id] > 0 && (
                <span style={{ marginLeft: "var(--space-2)", fontSize: "var(--text-xs)", fontWeight: 700, color: colors.mossDark, background: colors.line, borderRadius: "var(--radius-full)", padding: "var(--space-1) var(--space-3)" }}>
                  {keysOutByContractor[c.id]} key{keysOutByContractor[c.id] === 1 ? "" : "s"} out
                </span>
              )}
            </div>
            <div style={{ fontSize: "var(--text-xs)", color: colors.inkSoft }}>
              {[c.main_email, c.main_phone].filter(Boolean).join(" · ") || "No contact details set"}
            </div>
          </div>
          <div style={{ display: "flex", gap: "var(--space-2)" }}>
            <Button onClick={() => setReasonsFor(c)}>Key reasons</Button>
            <Button onClick={() => setDocsFor(c)}>Documents</Button>
            <Button onClick={() => editItem(c)}>Edit</Button>
            <Button variant="danger" onClick={() => handleDelete(c.id)}>Delete</Button>
          </div>
        </Card>
      ))}
      {contractors.length === 0 && <EmptyState title="No contractors set up yet" />}

      {docsFor && <ContractorDocumentsModal contractor={docsFor} orgId={org.id} onClose={() => setDocsFor(null)} />}
      {reasonsFor && (
        <KeyReasonsModal
          title={`${reasonsFor.name} — Key reasons`}
          table="contractor_reasons"
          ownerColumn="contractor_id"
          ownerId={reasonsFor.id}
          onClose={() => setReasonsFor(null)}
        />
      )}

      {form && (
        <Modal title={form.id ? "Edit contractor" : "New contractor"} onClose={() => setForm(null)}>
          <Card pad="lg" onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxWidth: "var(--width-base)" }}>
            <form onSubmit={handleSave}>
              <label className="tt-field__label">Company name</label>
              <Input required autoFocus value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Kevin Parry Heating Ltd" style={{ marginBottom: "var(--space-3)" }} />

              <label className="tt-field__label">Address (optional)</label>
              <Textarea value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} rows={2} style={{ marginBottom: "var(--space-3)" }} />

              <label className="tt-field__label">Main email (optional)</label>
              <Input type="email" value={form.main_email} onChange={(e) => setForm({ ...form, main_email: e.target.value })} style={{ marginBottom: "var(--space-3)" }} />

              <label className="tt-field__label">Main phone (optional)</label>
              <Input type="tel" value={form.main_phone} onChange={(e) => setForm({ ...form, main_phone: e.target.value })} style={{ marginBottom: "var(--space-3)" }} />

              <label className="tt-field__label">Notes (optional)</label>
              <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={3} placeholder="e.g. always ring ahead" style={{ marginBottom: "var(--space-3)" }} />

              <label style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", fontSize: "var(--text-sm)", color: colors.inkSoft, marginBottom: "var(--space-3)" }}>
                <input type="checkbox" checked={form.is_trusted} onChange={(e) => setForm({ ...form, is_trusted: e.target.checked })} />
                Trusted — comes to the key station unaccompanied (needs their own profile + RFID fob set up separately via Users/RFID Fobs)
              </label>

              {error && (
                <Alert tone="danger" title="Something went wrong">
                  {error}
                </Alert>
              )}

              <div style={{ display: "flex", gap: "var(--space-2)" }}>
                <Button variant="primary" type="submit">{form.id ? "Save changes" : "Add contractor"}</Button>
                <Button onClick={() => setForm(null)}>Cancel</Button>
              </div>
            </form>
          </Card>
                </Modal>
      )}
    </div>
  );
}
