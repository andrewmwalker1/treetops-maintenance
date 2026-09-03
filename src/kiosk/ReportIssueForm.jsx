import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient.js";
import { colors } from "../lib/theme.js";
import { Button, Card, EmptyState, Field, PageHeader, Textarea } from "../ui/index.js";

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
    <Card pad="lg" style={{ marginTop: "var(--space-5)" }}>
      <PageHeader title="Report an issue" level={2} />

      {commonFaults.length === 0 ? (
        <EmptyState title="No common faults set up for this equipment type yet">Add a note below.</EmptyState>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)", marginBottom: "var(--space-4)" }}>
          {commonFaults.map((f) => (
            <Button
              key={f.id}
              variant={picked === f.description ? "primary" : "secondary"}
              size="kiosk"
              aria-pressed={picked === f.description}
              onClick={() => setPicked(picked === f.description ? null : f.description)}
              style={{ justifyContent: "flex-start", textAlign: "left" }}
            >
              {f.description}
            </Button>
          ))}
        </div>
      )}

      <Field label="Note (optional)">
        {({ id }) => <Textarea id={id} value={note} onChange={(e) => setNote(e.target.value)} rows={3} />}
      </Field>

      <div style={{ display: "flex", gap: "var(--space-3)", marginTop: "var(--space-4)" }}>
        <Button size="kiosk" onClick={onCancel} disabled={submitting}>
          Cancel
        </Button>
        <Button
          variant="primary"
          size="kiosk"
          onClick={handleSubmit}
          loading={submitting}
          disabled={!picked && !note.trim()}
        >
          {submitting ? "Reporting…" : "Submit report"}
        </Button>
      </div>

      <p style={{ fontSize: "var(--text-base)", color: colors.inkSoft, marginTop: "var(--space-4)", marginBottom: 0, textAlign: "center" }}>
        Please remember to pink ticket the defective machine.
      </p>
    </Card>
  );
}
