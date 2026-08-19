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

// Generic preset-reasons editor, backing both contractor_reasons
// (ContractorsTab.jsx, keyed by contractor_id) and role_key_reasons
// (RoleKeyReasonsTab.jsx, keyed by role_id) -- same shape (id, <owner>_id,
// label, sort_order), same UI, only the table/column/id differ. Preset
// reasons show as quick-pick buttons on the key-station check-out screen
// (KeyStationCheckOut.jsx) -- always alongside a free-text override,
// never the only way to enter a reason.
export default function KeyReasonsModal({ title, table, ownerColumn, ownerId, onClose }) {
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
    <div
      style={{ position: "fixed", inset: 0, background: "rgba(49, 56, 45, 0.5)", display: "flex", alignItems: "flex-start", justifyContent: "center", padding: "24px 16px", overflowY: "auto", zIndex: 110 }}
      onClick={onClose}
    >
      <div style={{ ...cardStyle, padding: "20px", width: "100%", maxWidth: "440px" }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px" }}>
          <h2 style={{ fontFamily: fonts.display, fontSize: "16px", color: colors.mossDark, margin: 0 }}>{title}</h2>
          <button type="button" onClick={onClose} aria-label="Close" style={{ background: "none", border: "none", fontSize: "20px", color: colors.inkSoft, cursor: "pointer", lineHeight: 1 }}>×</button>
        </div>

        {error && <p style={{ color: colors.immediate, fontSize: "13px" }}>{error}</p>}

        {reasons.map((r) => (
          <div key={r.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 0", borderBottom: `1px solid ${colors.line}` }}>
            <span style={{ fontSize: "14px" }}>{r.label}</span>
            <button onClick={() => handleDelete(r.id)} style={{ background: "none", border: "none", color: colors.immediate, fontSize: "13px", cursor: "pointer" }}>Delete</button>
          </div>
        ))}
        {reasons.length === 0 && <p style={{ color: colors.inkSoft, fontSize: "13px" }}>No preset reasons yet — staff will type a reason freehand.</p>}

        <form onSubmit={handleAdd} style={{ marginTop: "12px" }}>
          <input type="text" value={newLabel} onChange={(e) => setNewLabel(e.target.value)} placeholder="e.g. Boiler service / repair" style={fieldStyle} />
          <button type="submit" style={buttonStyle.primary}>Add reason</button>
        </form>
      </div>
    </div>
  );
}
