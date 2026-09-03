import { usePermissions } from "../lib/permissions.js";
import { colors, fonts } from "../lib/theme.js";

// Same pattern as KeysGate.jsx: MeterReadingHome's nav already hides these
// links without the permission, but that's UI-only -- a typed-in URL for
// upload/download/labels/settings needs the same turn-away. Real
// enforcement is RLS server-side either way (see permissions.js).
export default function MeterReadingsGate({ children }) {
  const permissions = usePermissions();

  if (permissions.size > 0 && !permissions.has("can_manage_meter_readings")) {
    return (
      <div style={{ textAlign: "center", padding: "var(--space-8) var(--space-5)" }}>
        <p style={{ fontFamily: fonts.body, fontSize: "15px", color: colors.inkSoft, maxWidth: "360px", margin: "0 auto" }}>
          This account doesn't have access to meter reading admin.
        </p>
      </div>
    );
  }

  return children;
}
