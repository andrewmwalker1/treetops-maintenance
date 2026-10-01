import ChecklistBuilder from "./ChecklistBuilder.jsx";
import { colors } from "../lib/theme.js";

// One saved version of an equipment type's pre-use checklist
// (src/lib/checklistVersions.js), read-only.
export function checklistVersionSavedLine(version) {
  const when = new Date(version.created_at).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" });
  // Version 1 with no author is the baseline recorded when versioning was
  // switched on, not a save anyone made.
  if (!version.created_by_profile && version.version_number === 1) return `Recorded ${when}, when checklist history began`;
  return `Saved ${when}${version.created_by_profile ? ` by ${version.created_by_profile.display_name}` : ""}`;
}

export default function ChecklistVersionView({ version }) {
  return (
    <div>
      <div style={{ fontWeight: 600 }}>Version {version.version_number}</div>
      <div style={{ fontSize: "var(--text-xs)", color: colors.inkSoft, marginBottom: "var(--space-2)" }}>
        {checklistVersionSavedLine(version)}
      </div>
      {(version.items || []).length > 0 ? (
        <ChecklistBuilder items={version.items} onChange={() => {}} readOnly />
      ) : (
        <p style={{ fontSize: "var(--text-sm)", color: colors.inkSoft, margin: 0 }}>No pre-use checklist at this version.</p>
      )}
    </div>
  );
}
