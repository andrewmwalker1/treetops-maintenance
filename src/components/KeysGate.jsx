import { usePermissions } from "../lib/permissions.js";
import { colors, fonts } from "../lib/theme.js";

// Same can_use_key_system check KeyStationApp.jsx makes for the physical
// kiosk, applied to the in-app Keys pages too -- Layout.jsx's nav already
// hides the "Keys" link without this permission, but that's UI-only, so a
// typed-in /key-register URL needs the same turn-away KeyStationApp.jsx
// gives a role that was never meant to use the key system. Real
// enforcement is RLS server-side either way (see permissions.js).
export default function KeysGate({ children }) {
  const permissions = usePermissions();

  if (permissions.size > 0 && !permissions.has("can_use_key_system")) {
    return (
      <div style={{ textAlign: "center", padding: "var(--space-8) var(--space-5)" }}>
        <p style={{ fontFamily: fonts.body, fontSize: "var(--text-base)", color: colors.inkSoft, maxWidth: "var(--width-sm)", margin: "0 auto" }}>
          This account doesn't have access to the key system.
        </p>
      </div>
    );
  }

  return children;
}
