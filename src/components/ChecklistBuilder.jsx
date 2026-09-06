import { useState } from "react";
import { colors } from "../lib/theme.js";
import { Button, IconArrowDown, IconArrowUp, IconButton, IconCamera, IconClose, IconPlus, Input } from "../ui/index.js";

// Reusable ordered-list editor for checklist items — used for job
// templates (admin) and for building/editing a job's actual checklist.
// `readOnly` shows the list without add/remove/reorder controls, for
// users without can_edit_job_checklist.
//
// items: [{label, requiresPhoto}, ...] for a checkable item, or
// [{type: "heading", label}, ...] for a section heading -- a heading has
// no checkbox or photo toggle, just a label, and everything between one
// heading and the next becomes that section once the checklist renders
// on a real job (see NewJob.jsx's submit handler, which flattens this
// into job_subtasks.section). `canRequirePhoto` (separate from
// can_edit_job_checklist -- see 32-checklist-item-photo-requirement.sql)
// gates the camera-icon toggle that flags an item as safety-critical;
// without it the toggle isn't shown at all, matching every other
// permission-gated control in this codebase (hidden, not disabled).
export default function ChecklistBuilder({ items, onChange, readOnly = false, canRequirePhoto = false }) {
  const [newItem, setNewItem] = useState("");
  // Which row's label was last focused -- "Add section heading" inserts
  // right above it, rather than always at the bottom, since on a long
  // list dragging a new heading up from the end one row at a time is the
  // whole problem this is meant to solve. Not cleared on blur, so
  // clicking the button itself (which blurs the input) still targets
  // whatever row the admin was just working in.
  const [focusedIndex, setFocusedIndex] = useState(null);

  function addItem() {
    const text = newItem.trim();
    if (!text) return;
    onChange([...items, { label: text, requiresPhoto: false }]);
    setNewItem("");
  }

  function addHeading() {
    const insertAt = focusedIndex !== null && focusedIndex >= 0 && focusedIndex <= items.length ? focusedIndex : items.length;
    onChange([...items.slice(0, insertAt), { type: "heading", label: "New section" }, ...items.slice(insertAt)]);
    setFocusedIndex(null);
  }

  function removeItem(index) {
    if (focusedIndex === index) setFocusedIndex(null);
    onChange(items.filter((_, i) => i !== index));
  }

  // Works for both an item and a heading -- both are just {..., label} --
  // so this only ever touches the label, never the row's type.
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
      {items.map((item, i) => {
        const isHeading = item.type === "heading";
        return (
          <div
            key={i}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "var(--space-2)",
              padding: isHeading ? "var(--space-2)" : "var(--space-1) 0",
              marginTop: isHeading && i > 0 ? "var(--space-3)" : 0,
              background: isHeading ? colors.surfaceSunken : undefined,
              borderRadius: isHeading ? "var(--radius-sm)" : undefined,
            }}
          >
            {readOnly ? (
              <span style={{ flex: 1, fontSize: isHeading ? "var(--text-base)" : "var(--text-base)", fontWeight: isHeading ? 700 : 400 }}>
                {item.label}
              </span>
            ) : (
              <Input
                value={item.label}
                onChange={(e) => editItem(i, e.target.value)}
                onFocus={() => setFocusedIndex(i)}
                aria-label={isHeading ? `Section heading ${i + 1}` : `Checklist item ${i + 1}`}
                style={{
                  flex: 1,
                  fontWeight: isHeading ? 700 : 400,
                  background: isHeading ? colors.paper : undefined,
                  // Lingers after the input itself blurs (e.g. clicking "Add
                  // section heading" moves real focus to the button) so
                  // there's still a visible answer to "where will the new
                  // heading land" -- same inset-ring token the rest of the
                  // app already uses for "this field is focused".
                  boxShadow: focusedIndex === i ? "var(--focus-ring-inset)" : undefined,
                }}
              />
            )}
            {!isHeading && canRequirePhoto && (
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
                <IconCamera size={14} />
              </IconButton>
            )}
            {!readOnly && (
              <>
                <IconButton size="sm" label="Move up" onClick={() => moveItem(i, -1)} disabled={i === 0}>
                  <IconArrowUp size={14} />
                </IconButton>
                <IconButton size="sm" label="Move down" onClick={() => moveItem(i, 1)} disabled={i === items.length - 1}>
                  <IconArrowDown size={14} />
                </IconButton>
                <IconButton size="sm" label={isHeading ? "Remove section heading" : "Remove item"} onClick={() => removeItem(i)} style={{ color: colors.immediate }}>
                  <IconClose size={14} />
                </IconButton>
              </>
            )}
          </div>
        );
      })}

      {!readOnly && (
        <div style={{ display: "flex", gap: "var(--space-2)", marginTop: "var(--space-2)", flexWrap: "wrap" }}>
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
            style={{ flex: 1, minWidth: "160px" }}
          />
          <Button onClick={addItem}>Add</Button>
          <Button variant="secondary" icon={<IconPlus size={13} />} onClick={addHeading}>
            Add section heading
          </Button>
        </div>
      )}
    </div>
  );
}
