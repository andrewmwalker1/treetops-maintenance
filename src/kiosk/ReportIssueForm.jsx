import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient.js";
import { colors, fonts } from "../lib/theme.js";
import { kioskButtonStyle, kioskSecondaryButtonStyle, kioskCardStyle } from "./kioskTheme.js";

// Shared "pink ticket a machine" form -- used both from the check-out
// confirm screen (reporting a fault before taking a unit) and the
// check-in confirm screen (reporting a fault found during use). The
// parent supplies onSubmit(description) and decides what RPC args go
// with it (whether a checkout id needs closing at the same time).
export default function ReportIssueForm({ equipmentTypeId, onSubmit, onCancel, submitting }) {
  const [commonFaults, setCommonFaults] = useState([]);
  const [picked, setPicked] = useState(null);
  const [note, setNote] = useState("");

  useEffect(() => {
    supabase
      .from("common_fault_descriptions")
      .select("id, description")
      .eq("equipment_type_id", equipmentTypeId)
      .order("sort_order")
      .then(({ data }) => setCommonFaults(data || []));
  }, [equipmentTypeId]);

  function handleSubmit() {
    const parts = [];
    if (picked) parts.push(picked);
    if (note.trim()) parts.push(note.trim());
    if (parts.length === 0) return;
    onSubmit(parts.join(" — "));
  }

  return (
    <div style={{ ...kioskCardStyle, marginTop: "20px" }}>
      <h2 style={{ fontFamily: fonts.display, fontSize: "20px", color: colors.mossDark, marginTop: 0 }}>Report an issue</h2>

      {commonFaults.length === 0 ? (
        <p style={{ color: colors.inkSoft }}>No common faults set up for this equipment type yet -- add a note below.</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginBottom: "16px" }}>
          {commonFaults.map((f) => (
            <button
              key={f.id}
              onClick={() => setPicked(f.description)}
              style={{
                ...kioskSecondaryButtonStyle,
                textAlign: "left",
                fontSize: "18px",
                padding: "16px",
                border: `2px solid ${picked === f.description ? colors.mossDark : colors.lineStrong}`,
                background: picked === f.description ? colors.bg : "transparent",
              }}
            >
              {f.description}
            </button>
          ))}
        </div>
      )}

      <label style={{ display: "block", fontSize: "16px", fontWeight: 600, color: colors.inkSoft, marginBottom: "8px" }}>
        Note (optional)
      </label>
      <textarea
        value={note}
        onChange={(e) => setNote(e.target.value)}
        rows={3}
        style={{
          width: "100%",
          boxSizing: "border-box",
          padding: "14px",
          borderRadius: "12px",
          border: `1px solid ${colors.lineStrong}`,
          fontFamily: fonts.body,
          fontSize: "16px",
          marginBottom: "16px",
        }}
      />

      <div style={{ display: "flex", gap: "12px" }}>
        <button style={kioskSecondaryButtonStyle} onClick={onCancel} disabled={submitting}>Cancel</button>
        <button style={kioskButtonStyle} onClick={handleSubmit} disabled={submitting || (!picked && !note.trim())}>
          {submitting ? "Reporting…" : "Submit report"}
        </button>
      </div>

      <p style={{ fontFamily: fonts.body, fontSize: "14px", color: colors.inkSoft, marginTop: "16px", marginBottom: 0, textAlign: "center" }}>
        Please remember to pink ticket the defective machine.
      </p>
    </div>
  );
}
