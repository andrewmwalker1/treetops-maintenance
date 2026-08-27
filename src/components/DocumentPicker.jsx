import { useState } from "react";
import { colors, fonts } from "../lib/theme.js";

const searchStyle = {
  width: "100%",
  boxSizing: "border-box",
  padding: "8px 12px",
  borderRadius: "8px",
  border: `1px solid ${colors.lineStrong}`,
  fontFamily: fonts.body,
  fontSize: "13px",
  marginBottom: "8px",
};

const typeLabel = { risk_assessment: "Risk assessments", method_statement: "Method statements" };

// Checkbox picker for the RA/MS library, shared by ActivityTypesTab and
// EquipmentTypesTab -- both link the same library to a type, the same
// admin pattern. Andy hit this once the library grew past a screenful of
// unlabelled checkboxes: a live title search plus grouping by document
// type keeps a long, still-growing list scannable instead of a
// scroll-and-hunt, and the bounded-height scroll box keeps the picker
// itself from pushing the Save button further down as the library grows.
export default function DocumentPicker({ documents, selectedIds, onToggle }) {
  const [query, setQuery] = useState("");

  if (documents.length === 0) {
    return <p style={{ color: colors.inkSoft, fontSize: "13px" }}>No documents in the library yet — add some in the Safety Library tab first.</p>;
  }

  const q = query.trim().toLowerCase();
  const visible = q ? documents.filter((d) => d.title.toLowerCase().includes(q)) : documents;
  const groups = [
    ["risk_assessment", visible.filter((d) => d.type === "risk_assessment")],
    ["method_statement", visible.filter((d) => d.type === "method_statement")],
  ];

  return (
    <div>
      <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search documents…" style={searchStyle} />
      <p style={{ fontSize: "12px", color: colors.inkSoft, margin: "0 0 6px" }}>{selectedIds.length} selected</p>
      <div style={{ maxHeight: "220px", overflowY: "auto", border: `1px solid ${colors.line}`, borderRadius: "8px", padding: "2px 10px" }}>
        {groups.map(([type, docs]) =>
          docs.length === 0 ? null : (
            <div key={type} style={{ marginBottom: "4px" }}>
              <div style={{ fontSize: "11px", fontWeight: 700, color: colors.inkSoft, textTransform: "uppercase", margin: "8px 0 2px" }}>
                {typeLabel[type] || type}
              </div>
              {docs.map((d) => (
                <label key={d.id} style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "14px", padding: "3px 0" }}>
                  <input type="checkbox" checked={selectedIds.includes(d.id)} onChange={() => onToggle(d.id)} />
                  {d.title}
                </label>
              ))}
            </div>
          )
        )}
        {visible.length === 0 && <p style={{ color: colors.inkSoft, fontSize: "13px", margin: "8px 0" }}>No documents match "{query}".</p>}
      </div>
    </div>
  );
}
