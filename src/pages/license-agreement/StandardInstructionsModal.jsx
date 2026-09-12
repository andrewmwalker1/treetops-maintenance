import { useState } from "react";
import { useAuth } from "../../lib/AuthContext.jsx";
import { supabase } from "../../lib/supabaseClient.js";
import { colors } from "../../lib/theme.js";
import { Alert, Button, IconArrowDown, IconArrowUp, IconButton, IconClose, Input, Modal, Textarea } from "../../ui/index.js";

const TABLE = "license_agreement_standard_instructions";

// CRUD for the org-wide picklist Step3Instructions offers in the wizard.
// Gated by can_use_office_hub (not can_manage_license_agreement_settings)
// -- these are day-to-day sales wording, not the shared pricing tables,
// so anyone with office hub access can keep them current.
export default function StandardInstructionsModal({ instructions, onClose, onChanged }) {
  const { org } = useAuth();
  const [items, setItems] = useState(instructions);
  const [newLabel, setNewLabel] = useState("");
  const [newBody, setNewBody] = useState("");
  const [error, setError] = useState("");

  function commit(next) {
    setItems(next);
    onChanged(next);
  }

  async function addItem() {
    const label = newLabel.trim();
    const body_text = newBody.trim();
    if (!label || !body_text) return;
    const sort_order = items.length ? Math.max(...items.map((i) => i.sort_order)) + 1 : 0;
    const { data, error: err } = await supabase.from(TABLE).insert({ org_id: org.id, label, body_text, sort_order }).select().single();
    if (err) setError(err.message);
    else {
      commit([...items, data]);
      setNewLabel("");
      setNewBody("");
    }
  }

  function editLocal(index, patch) {
    setItems((prev) => prev.map((it, i) => (i === index ? { ...it, ...patch } : it)));
  }

  async function persist(item) {
    const { error: err } = await supabase.from(TABLE).update({ label: item.label, body_text: item.body_text }).eq("id", item.id);
    if (err) setError(err.message);
    else onChanged(items);
  }

  async function removeItem(id) {
    const { error: err } = await supabase.from(TABLE).delete().eq("id", id);
    if (err) setError(err.message);
    else commit(items.filter((i) => i.id !== id));
  }

  async function moveItem(index, direction) {
    const target = index + direction;
    if (target < 0 || target >= items.length) return;
    const a = items[index];
    const b = items[target];
    const [{ error: err1 }, { error: err2 }] = await Promise.all([
      supabase.from(TABLE).update({ sort_order: b.sort_order }).eq("id", a.id),
      supabase.from(TABLE).update({ sort_order: a.sort_order }).eq("id", b.id),
    ]);
    if (err1 || err2) { setError((err1 || err2).message); return; }
    const swapped = items
      .map((it, i) => {
        if (i === index) return { ...a, sort_order: b.sort_order };
        if (i === target) return { ...b, sort_order: a.sort_order };
        return it;
      })
      .sort((x, y) => x.sort_order - y.sort_order);
    commit(swapped);
  }

  return (
    <Modal title="Standard special instructions" onClose={onClose} maxWidth="640px">
      <div style={{ padding: 20 }}>
        <p style={{ fontSize: "var(--text-sm)", color: colors.inkSoft, marginTop: 0 }}>
          Shared by everyone using the License Agreement Builder. Use <code>{"{thisyear}"}</code> and{" "}
          <code>{"{nextyear}"}</code> anywhere in the text — they're replaced with the actual year when someone picks
          this instruction.
        </p>
        {error && <Alert tone="danger" title="Something went wrong">{error}</Alert>}
        {items.length === 0 && <p style={{ color: colors.inkSoft, fontSize: "var(--text-sm)" }}>No standard instructions yet.</p>}

        {items.map((item, i) => (
          <div key={item.id} style={{ border: `1px solid ${colors.line}`, borderRadius: "var(--radius-sm)", padding: 12, marginBottom: 10 }}>
            <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 6 }}>
              <Input
                value={item.label}
                onChange={(e) => editLocal(i, { label: e.target.value })}
                onBlur={() => persist(items[i])}
                style={{ flex: 1, fontWeight: 600 }}
              />
              <IconButton size="sm" label="Move up" onClick={() => moveItem(i, -1)} disabled={i === 0}><IconArrowUp size={14} /></IconButton>
              <IconButton size="sm" label="Move down" onClick={() => moveItem(i, 1)} disabled={i === items.length - 1}><IconArrowDown size={14} /></IconButton>
              <IconButton size="sm" label="Remove" onClick={() => removeItem(item.id)} style={{ color: colors.immediate }}><IconClose size={14} /></IconButton>
            </div>
            <Textarea
              rows={2}
              value={item.body_text}
              onChange={(e) => editLocal(i, { body_text: e.target.value })}
              onBlur={() => persist(items[i])}
              style={{ width: "100%" }}
            />
          </div>
        ))}

        <div style={{ borderTop: `1px solid ${colors.line}`, paddingTop: 14, marginTop: 10 }}>
          <Input
            placeholder="Label (e.g. Non-standard decking)"
            value={newLabel}
            onChange={(e) => setNewLabel(e.target.value)}
            style={{ marginBottom: 8, width: "100%" }}
          />
          <Textarea
            rows={2}
            placeholder="Instruction text — e.g. Rates apply from 1st July {thisyear}."
            value={newBody}
            onChange={(e) => setNewBody(e.target.value)}
            style={{ marginBottom: 8, width: "100%" }}
          />
          <Button variant="primary" onClick={addItem} disabled={!newLabel.trim() || !newBody.trim()}>+ Add standard instruction</Button>
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 16 }}>
          <Button onClick={onClose}>Done</Button>
        </div>
      </div>
    </Modal>
  );
}
