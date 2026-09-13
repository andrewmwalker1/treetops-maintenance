import { usePermissions } from "../lib/permissions.js";
import { colors, fonts } from "../lib/theme.js";

// Same shape as KeysGate.jsx: Layout.jsx's nav already hides the
// "Timesheet" link without this permission, but that's UI-only, so a
// typed-in /timesheets URL needs the same turn-away. Real enforcement is
// RLS server-side either way (see permissions.js). permissions.size > 0
// guard avoids flashing "no access" before permissions have loaded.
export default function TimesheetsGate({ children }) {
  const permissions = usePermissions();

  if (permissions.size > 0 && !permissions.has("can_submit_timesheet")) {
    return (
      <div style={{ textAlign: "center", padding: "var(--space-8) var(--space-5)" }}>
        <p style={{ fontFamily: fonts.body, fontSize: "var(--text-base)", color: colors.inkSoft, maxWidth: "var(--width-sm)", margin: "0 auto" }}>
          This account doesn't have access to timesheets.
        </p>
      </div>
    );
  }

  return children;
}
