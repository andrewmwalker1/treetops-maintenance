import { useNavigate } from "react-router-dom";
import { usePermissions } from "../lib/permissions.js";
import KeyActivityLogTab from "./admin/KeyActivityLogTab.jsx";
import { colors, fonts } from "../lib/theme.js";
import { Button, IconArrowLeft } from "../ui/index.js";

// The Key activity log reached from the Keys screen (/key-register/activity)
// rather than only via Admin ▸ Keys -- same component as the admin tab,
// gated by the same can_manage_keys permission.
export default function KeyActivityLog() {
  const navigate = useNavigate();
  const permissions = usePermissions();

  if (permissions.size > 0 && !permissions.has("can_manage_keys")) {
    return (
      <div style={{ textAlign: "center", padding: "var(--space-8) var(--space-5)" }}>
        <p style={{ fontFamily: fonts.body, fontSize: "var(--text-base)", color: colors.inkSoft, maxWidth: "var(--width-sm)", margin: "0 auto" }}>
          This account doesn't have access to the key activity log.
        </p>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: "var(--width-xl)" }}>
      <Button variant="secondary" icon={<IconArrowLeft size={15} />} onClick={() => navigate("/key-register")} style={{ marginBottom: "var(--space-4)" }}>
        Back
      </Button>
      <KeyActivityLogTab />
    </div>
  );
}
