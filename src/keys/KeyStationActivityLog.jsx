import { useNavigate } from "react-router-dom";
import { usePermissions } from "../lib/permissions.js";
import KeyActivityLogTab from "../pages/admin/KeyActivityLogTab.jsx";
import { colors } from "../lib/theme.js";
import { Button, IconArrowLeft } from "../ui/index.js";

// Key-cupboard kiosk version of the Key activity log (Andy, 2026-11-10),
// matching the main app's /key-register/activity -- same component as the
// Admin ▸ Keys tab, can_manage_keys-gated like Relocate/Force check-in.
export default function KeyStationActivityLog() {
  const navigate = useNavigate();
  const permissions = usePermissions();

  if (permissions.size > 0 && !permissions.has("can_manage_keys")) {
    return (
      <div style={{ padding: "var(--space-6)", maxWidth: "var(--width-2xl)", margin: "0 auto" }}>
        <p style={{ color: colors.inkSoft, fontSize: "var(--text-md)" }}>This account doesn't have access to the key activity log.</p>
        <Button onClick={() => navigate("/keys")} icon={<IconArrowLeft size={16} />}>Menu</Button>
      </div>
    );
  }

  return (
    <div style={{ padding: "var(--space-6)", maxWidth: "var(--width-2xl)", margin: "0 auto" }}>
      <Button onClick={() => navigate("/keys")} icon={<IconArrowLeft size={16} />} style={{ marginBottom: "var(--space-5)" }}>
        Menu
      </Button>
      <KeyActivityLogTab />
    </div>
  );
}
