import { colors, fonts } from "../lib/theme.js";

const fieldStyle = {
  width: "100%",
  boxSizing: "border-box",
  padding: "var(--space-2) var(--space-3)",
  borderRadius: "var(--radius-sm)",
  border: `1px solid ${colors.lineStrong}`,
  fontFamily: fonts.body,
  marginBottom: "var(--space-3)",
};

// Converts between the three-nullable-FK-columns shape a "who does this"
// row is stored in (assignee_profile_id/assignee_group_id/assignee_
// contractor_id -- e.g. equipment_type_repair_assignees, 49-equipment-
// repair-jobs.sql, and service_template_tiers) and the kind/id pair the
// radio+select UI below actually edits. Originally lived only in
// EquipmentTypesTab.jsx; pulled out once ServiceTemplatesTab.jsx needed
// the exact same picker rather than a second hand-copied version.
export function assigneeKindAndIdFromRow(row) {
  if (!row) return { assigneeKind: "none", assigneeId: "" };
  if (row.assignee_profile_id) return { assigneeKind: "person", assigneeId: row.assignee_profile_id };
  if (row.assignee_group_id) return { assigneeKind: "group", assigneeId: row.assignee_group_id };
  if (row.assignee_contractor_id) return { assigneeKind: "contractor", assigneeId: row.assignee_contractor_id };
  return { assigneeKind: "none", assigneeId: "" };
}

export function assigneeLabel(row, { people, groups, contractors }) {
  const { assigneeKind, assigneeId } = assigneeKindAndIdFromRow(row);
  if (assigneeKind === "person") return people.find((p) => p.id === assigneeId)?.display_name;
  if (assigneeKind === "group") return groups.find((g) => g.id === assigneeId)?.name;
  if (assigneeKind === "contractor") return contractors.find((c) => c.id === assigneeId)?.name;
  return null;
}

// "none" means "fall through to whatever's configured above this" (a
// type's default, an org-wide default) rather than "unassigned" the way
// a job's own assignee can genuinely be nobody -- callers that don't have
// a fall-through concept (e.g. a fresh row with no wider default at all)
// should just treat "none" as unassigned themselves.
export default function AssigneePicker({ kind, id, onChange, people, groups, contractors, noneLabel = "None (use default)" }) {
  const options = kind === "person" ? people : kind === "group" ? groups : kind === "contractor" ? contractors : [];
  const labelKey = kind === "person" ? "display_name" : "name";
  return (
    <div>
      <div style={{ display: "flex", gap: "var(--space-3)", flexWrap: "wrap", marginBottom: "var(--space-2)" }}>
        {["none", "person", "group", "contractor"].map((k) => (
          <label key={k} style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", fontSize: "13px" }}>
            <input type="radio" checked={kind === k} onChange={() => onChange(k, "")} />
            {k === "none" ? noneLabel : k.charAt(0).toUpperCase() + k.slice(1)}
          </label>
        ))}
      </div>
      {kind !== "none" && (
        <select value={id} onChange={(e) => onChange(kind, e.target.value)} style={{ ...fieldStyle, marginBottom: 0 }}>
          <option value="">Choose…</option>
          {options.map((o) => (
            <option key={o.id} value={o.id}>{o[labelKey]}</option>
          ))}
        </select>
      )}
    </div>
  );
}
