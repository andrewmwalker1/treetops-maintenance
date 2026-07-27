import { useState } from "react";
import { colors, fonts, buttonStyle } from "../lib/theme.js";

// Reusable ordered-list editor for checklist items — used for job
// templates (admin) and for building/editing a job's actual checklist.
// `readOnly` shows the list without add/remove/reorder controls, for
// users without can_edit_job_checklist.
export default function ChecklistBuilder({ items, onChange, readOnly = false }) {
  const [newItem, setNewItem] = useState("");

  function addItem() {
    const text = newItem.trim();
    if (!text) return;
    onChange([...items, text]);
    setNewItem("");
  }

  function removeItem(index) {
    onChange(items.filter((_, i) => i !== index));
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
      {items.length === 0 && <p style={{ color: colors.inkSoft, fontSize: "13px" }}>No checklist items.</p>}
      {items.map((label, i) => (
        <div key={i} style={{ display: "flex", alignItems: "center", gap: "8px", padding: "4px 0" }}>
          <span style={{ flex: 1, fontSize: "14px" }}>{label}</span>
          {!readOnly && (
            <>
              <button type="button" onClick={() => moveItem(i, -1)} disabled={i === 0} style={iconButtonStyle}>↑</button>
              <button type="button" onClick={() => moveItem(i, 1)} disabled={i === items.length - 1} style={iconButtonStyle}>↓</button>
              <button type="button" onClick={() => removeItem(i)} style={{ ...iconButtonStyle, color: colors.immediate }}>✕</button>
            </>
          )}
        </div>
      ))}

      {!readOnly && (
        <div style={{ display: "flex", gap: "8px", marginTop: "10px" }}>
          <input
            value={newItem}
            onChange={(e) => setNewItem(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addItem();
              }
            }}
            placeholder="Add an item…"
            style={{
              flex: 1,
              padding: "8px 12px",
              borderRadius: "8px",
              border: `1px solid ${colors.lineStrong}`,
              fontFamily: fonts.body,
              fontSize: "14px",
            }}
          />
          <button type="button" onClick={addItem} style={buttonStyle.secondary}>Add</button>
        </div>
      )}
    </div>
  );
}

const iconButtonStyle = {
  background: "transparent",
  border: `1px solid ${colors.lineStrong}`,
  borderRadius: "6px",
  width: "28px",
  height: "28px",
  cursor: "pointer",
  color: colors.inkSoft,
  fontSize: "13px",
};
