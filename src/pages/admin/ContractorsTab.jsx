import { useEffect, useState } from "react";
import { useAuth } from "../../lib/AuthContext.jsx";
import { supabase } from "../../lib/supabaseClient.js";
import ContractorDocumentsModal from "./ContractorDocumentsModal.jsx";
import KeyReasonsModal from "./KeyReasonsModal.jsx";
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
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px" }}>
        <h2 style={{ fontFamily: fonts.display, fontSize: "16px", color: colors.mossDark, margin: 0 }}>Contractors</h2>
        <button onClick={() => { setError(null); setForm(blank); }} style={buttonStyle.primary}>+ Add contractor</button>
      </div>

      {contractors.map((c) => (
        <div key={c.id} style={{ ...cardStyle, padding: "12px 16px", marginBottom: "8px", display: "flex", justifyContent: "space-between", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
          <div>
            <div style={{ fontWeight: 600 }}>
              {c.name}
              {c.is_trusted ? " · Trusted (key station)" : ""}
              {keysOutByContractor[c.id] > 0 && (
                <span style={{ marginLeft: "8px", fontSize: "11px", fontWeight: 700, color: colors.mossDark, background: colors.line, borderRadius: "999px", padding: "2px 10px" }}>
                  {keysOutByContractor[c.id]} key{keysOutByContractor[c.id] === 1 ? "" : "s"} out
                </span>
              )}
            </div>
            <div style={{ fontSize: "12px", color: colors.inkSoft }}>
              {[c.main_email, c.main_phone].filter(Boolean).join(" · ") || "No contact details set"}
            </div>
          </div>
          <div style={{ display: "flex", gap: "8px" }}>
            <button onClick={() => setReasonsFor(c)} style={buttonStyle.secondary}>Key reasons</button>
            <button onClick={() => setDocsFor(c)} style={buttonStyle.secondary}>Documents</button>
            <button onClick={() => editItem(c)} style={buttonStyle.secondary}>Edit</button>
            <button onClick={() => handleDelete(c.id)} style={{ ...buttonStyle.secondary, color: colors.immediate }}>Delete</button>
          </div>
        </div>
      ))}
      {contractors.length === 0 && <p style={{ color: colors.inkSoft }}>No contractors set up yet.</p>}

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
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: colors.scrim,
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "center",
            padding: "24px 16px",
            overflowY: "auto",
            zIndex: 100,
          }}
          onClick={() => setForm(null)}
        >
          <div style={{ ...cardStyle, padding: "20px", width: "100%", maxWidth: "440px" }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px" }}>
              <h2 style={{ fontFamily: fonts.display, fontSize: "16px", color: colors.mossDark, margin: 0 }}>
                {form.id ? "Edit contractor" : "New contractor"}
              </h2>
              <button type="button" onClick={() => setForm(null)} aria-label="Close" style={{ background: "none", border: "none", fontSize: "20px", color: colors.inkSoft, cursor: "pointer", lineHeight: 1 }}>×</button>
            </div>
            <form onSubmit={handleSave}>
              <label style={labelStyle}>Company name</label>
              <input required autoFocus value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Kevin Parry Heating Ltd" style={fieldStyle} />

              <label style={labelStyle}>Address (optional)</label>
              <textarea value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} rows={2} style={{ ...fieldStyle, resize: "vertical" }} />

              <label style={labelStyle}>Main email (optional)</label>
              <input type="email" value={form.main_email} onChange={(e) => setForm({ ...form, main_email: e.target.value })} style={fieldStyle} />

              <label style={labelStyle}>Main phone (optional)</label>
              <input type="tel" value={form.main_phone} onChange={(e) => setForm({ ...form, main_phone: e.target.value })} style={fieldStyle} />

              <label style={labelStyle}>Notes (optional)</label>
              <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={3} placeholder="e.g. always ring ahead" style={{ ...fieldStyle, resize: "vertical" }} />

              <label style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "13px", color: colors.inkSoft, marginBottom: "10px" }}>
                <input type="checkbox" checked={form.is_trusted} onChange={(e) => setForm({ ...form, is_trusted: e.target.checked })} />
                Trusted — comes to the key station unaccompanied (needs their own profile + RFID fob set up separately via Users/RFID Fobs)
              </label>

              {error && <p style={{ color: colors.immediate, fontSize: "13px" }}>{error}</p>}

              <div style={{ display: "flex", gap: "8px" }}>
                <button type="submit" style={buttonStyle.primary}>{form.id ? "Save changes" : "Add contractor"}</button>
                <button type="button" onClick={() => setForm(null)} style={buttonStyle.secondary}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
