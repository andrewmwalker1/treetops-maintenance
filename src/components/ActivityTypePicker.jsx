import { useState } from "react";
import { colors } from "../lib/theme.js";
import { Button, Input, Modal, ModalFooter, Pill, IconPlus } from "../ui/index.js";

// Shared activity-type multi-select -- used by NewJob.jsx (building a job
// before it exists) and JobDetail.jsx's edit-mode Safety section (mutating
// an existing job's job_activity_types rows), which independently grew the
// exact same "one checkbox per row, every type in the org" list. Both had
// the same problem: fine at a handful of activity types, but the picker's
// own height grew with the size of the *library*, not with how many
// actually apply to this job -- at 20-30 types it's most of a screen
// before the job's real fields.
//
// The resting state instead shows only what's selected (removable pills --
// the same shape the read-only Safety view already renders for someone
// without edit permission), with the full searchable list moved into a
// popout that doesn't take up page space until opened.
//
// `allTypes`: [{id, name}, ...]. `selectedIds`: array of currently-selected
// ids. `onToggle(id)`: called for both ticking a row and removing a pill --
// same callback either way, same as ChecklistBuilder/DocumentPicker's shape.
export default function ActivityTypePicker({ allTypes, selectedIds, onToggle }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const selected = allTypes.filter((t) => selectedIds.includes(t.id));
  const q = query.trim().toLowerCase();
  const visible = q ? allTypes.filter((t) => t.name.toLowerCase().includes(q)) : allTypes;

  return (
    <>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--space-2)", alignItems: "center" }}>
        {selected.map((t) => (
          <Pill key={t.id} color={colors.mossDark} onRemove={() => onToggle(t.id)} removeLabel={`Remove ${t.name}`}>
            {t.name}
          </Pill>
        ))}
        <Button size="sm" icon={<IconPlus size={13} />} onClick={() => setOpen(true)}>
          Add activity types
        </Button>
      </div>

      {open && (
        <Modal title="Activity types" onClose={() => setOpen(false)} maxWidth="440px">
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search activity types…"
            aria-label="Search activity types"
            autoFocus
            style={{ marginBottom: "var(--space-3)" }}
          />
          <div style={{ maxHeight: "var(--scrollbox-max-h)", overflowY: "auto" }}>
            {visible.length === 0 && <p style={{ color: colors.inkSoft, fontSize: "var(--text-sm)" }}>No matches.</p>}
            {visible.map((t) => (
              <label key={t.id} style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", padding: "var(--space-1) 0", fontSize: "var(--text-base)" }}>
                <input type="checkbox" checked={selectedIds.includes(t.id)} onChange={() => onToggle(t.id)} />
                {t.name}
              </label>
            ))}
          </div>
          <ModalFooter>
            <Button variant="primary" onClick={() => setOpen(false)}>
              Done
            </Button>
          </ModalFooter>
        </Modal>
      )}
    </>
  );
}
