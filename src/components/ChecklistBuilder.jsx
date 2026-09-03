import { useState } from "react";
import { colors } from "../lib/theme.js";
import { Button, IconButton, Input } from "../ui/index.js";

// Reusable ordered-list editor for checklist items — used for job
// templates (admin) and for building/editing a job's actual checklist.
// `readOnly` shows the list without add/remove/reorder controls, for
// users without can_edit_job_checklist.
//
// items: [{label, requiresPhoto}, ...]. `canRequirePhoto` (separate from
// can_edit_job_checklist -- see 32-checklist-item-photo-requirement.sql)
// gates the camera-icon toggle that flags an item as safety-critical;
// without it the toggle isn't shown at all, matching every other
// permission-gated control in this codebase (hidden, not disabled).
export default function ChecklistBuilder({ items, onChange, readOnly = false, canRequirePhoto = false }) {
  const [newItem, setNewItem] = useState("");

  function addItem() {
    const text = newItem.trim();
    if (!text) return;
    onChange([...items, { label: text, requiresPhoto: false }]);
    setNewItem("");
  }

  function removeItem(index) {
    onChange(items.filter((_, i) => i !== index));
  }

  function editItem(index, text) {
    const next = [...items];
    next[index] = { ...next[index], label: text };
    onChange(next);
  }

  function toggleRequiresPhoto(index) {
    const next = [...items];
    next[index] = { ...next[index], requiresPhoto: !next[index].requiresPhoto };
    onChange(next);
  }

  function moveItem(index, direction) {
    const target = index + direction;
    if (target < 0 || target >= items.length) return;
    const next = [...items];
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next);
  }

  return (
    <div>
      {items.length === 0 && <p style={{ color: colors.inkSoft, fontSize: "var(--text-sm)" }}>No checklist items.</p>}
      {items.map((item, i) => (
        <div key={i} style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", padding: "var(--space-1) 0" }}>
          {readOnly ? (
            <span style={{ flex: 1, fontSize: "var(--text-base)" }}>{item.label}</span>
          ) : (
            <Input value={item.label} onChange={(e) => editItem(i, e.target.value)} aria-label={`Checklist item ${i + 1}`} style={{ flex: 1 }} />
          )}
          {canRequirePhoto && (
            <IconButton
              size="sm"
              onClick={() => toggleRequiresPhoto(i)}
              disabled={readOnly}
              aria-pressed={item.requiresPhoto}
              label={item.requiresPhoto ? "Requires a photo to check off — click to remove" : "Click to require a photo to check off"}
              // The pressed state is the whole point of this control, so it
              // gets a filled treatment rather than the icon button's
              // default quiet one.
              style={
                item.requiresPhoto
                  ? { background: colors.mossDark, color: colors.onDark, borderColor: colors.mossDark }
                  : undefined
              }
            >
              📷
            </IconButton>
          )}
          {!readOnly && (
            <>
              <IconButton size="sm" label="Move up" onClick={() => moveItem(i, -1)} disabled={i === 0}>
                ↑
              </IconButton>
              <IconButton size="sm" label="Move down" onClick={() => moveItem(i, 1)} disabled={i === items.length - 1}>
                ↓
              </IconButton>
              <IconButton size="sm" label="Remove item" onClick={() => removeItem(i)} style={{ color: colors.immediate }}>
                ✕
              </IconButton>
            </>
          )}
        </div>
      ))}

      {!readOnly && (
        <div style={{ display: "flex", gap: "var(--space-2)", marginTop: "var(--space-2)" }}>
          <Input
            value={newItem}
            onChange={(e) => setNewItem(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addItem();
              }
            }}
            placeholder="Add an item…"
            aria-label="Add a checklist item"
            style={{ flex: 1 }}
          />
          <Button onClick={addItem}>Add</Button>
        </div>
      )}
    </div>
  );
}
