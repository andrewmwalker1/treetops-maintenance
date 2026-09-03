import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabaseClient.js";
import { colors, text, space } from "../../lib/theme.js";
import { Alert, Button, Input, Modal } from "../../ui/index.js";

// Generic preset-reasons editor, backing contractor_reasons
// (ContractorsTab.jsx, keyed by contractor_id), role_key_reasons
// (RoleKeyReasonsTab.jsx, keyed by role_id), and key_reason_presets
// (also RoleKeyReasonsTab.jsx, keyed by a fixed kind string --
// "customer"/"guest" -- rather than a row id) -- same shape (id,
// <owner>, label, sort_order), same UI, only the table/column/id differ.
// `extraFields` covers key_reason_presets' extra not-null org_id column,
// which the other two tables don't have. Preset reasons show as
// quick-pick buttons on the key-station check-out screen
// (KeyStationCheckOut.jsx) -- always alongside a free-text override,
// never the only way to enter a reason.
export default function KeyReasonsModal({ title, table, ownerColumn, ownerId, extraFields, onClose }) {
  const [reasons, setReasons] = useState([]);
  const [newLabel, setNewLabel] = useState("");
  const [error, setError] = useState(null);

  function refresh() {
    supabase
      .from(table)
      .select("id, label, sort_order")
      .eq(ownerColumn, ownerId)
      .order("sort_order")
      .then(({ data, error: err }) => {
        if (err) setError(err.message);
        else setReasons(data || []);
      });
  }

  useEffect(refresh, [table, ownerColumn, ownerId]);

  async function handleAdd(e) {
    e.preventDefault();
    const label = newLabel.trim();
    if (!label) return;
    const { error: err } = await supabase.from(table).insert({
      [ownerColumn]: ownerId,
      label,
      sort_order: reasons.length,
      ...extraFields,
    });
    if (err) {
      setError(err.message);
      return;
    }
    setNewLabel("");
    refresh();
  }

  async function handleDelete(id) {
    const { error: err } = await supabase.from(table).delete().eq("id", id);
    if (err) setError(err.message);
    else refresh();
  }

  return (
    <Modal title={title} onClose={onClose}>

        {error && (
          <Alert tone="danger" title="Something went wrong">
            {error}
          </Alert>
        )}

        {reasons.map((r) => (
          <div key={r.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "var(--space-2) 0", borderBottom: `1px solid ${colors.line}` }}>
            <span style={{ fontSize: "var(--text-base)" }}>{r.label}</span>
            <Button variant="danger" size="sm" onClick={() => handleDelete(r.id)}>Delete</Button>
          </div>
        ))}
        {reasons.length === 0 && <p style={{ color: colors.inkSoft, fontSize: "var(--text-sm)" }}>No preset reasons yet — staff will type a reason freehand.</p>}

        <form onSubmit={handleAdd} style={{ marginTop: "var(--space-3)" }}>
          <Input type="text" value={newLabel} onChange={(e) => setNewLabel(e.target.value)} placeholder="e.g. Boiler service / repair" style={{ marginBottom: "var(--space-3)" }} />
          <Button variant="primary" type="submit">Add reason</Button>
        </form>
          </Modal>
  );
}
