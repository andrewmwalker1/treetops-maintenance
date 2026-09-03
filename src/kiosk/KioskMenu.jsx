import { useNavigate } from "react-router-dom";
import { useAuth } from "../lib/AuthContext.jsx";
import { Action, ActionList, Button, PageHeader } from "../ui/primitives.jsx";
import { IconEquipment, IconJobs, IconSafety } from "../ui/icons.jsx";

// The workshop touchscreen's home. Renders through the same
// <ActionList>/<Action> as KeysHome and MeterReadingHome, at size="kiosk"
// -- a walk-up screen needs much bigger targets, but it should not be a
// separate design language, which is what the old kioskTheme.js had made it.
export default function KioskMenu() {
  const navigate = useNavigate();
  const { profile, signOut } = useAuth();

  return (
    <div
      style={{
        padding: "var(--space-7)",
        display: "flex",
        flexDirection: "column",
        minHeight: "100vh",
        boxSizing: "border-box",
      }}
    >
      <PageHeader title={`Hi ${profile?.display_name || "there"}`} subtitle="What do you need?" />

      <ActionList layout="grid" size="kiosk" style={{ flex: 1, alignContent: "start" }}>
        <Action variant="primary" icon={<IconJobs size={24} />} onClick={() => navigate("/kiosk/jobs")}>
          View jobs
        </Action>
        <Action variant="primary" icon={<IconEquipment size={24} />} onClick={() => navigate("/kiosk/checkout")}>
          Check out kit
        </Action>
        <Action variant="primary" icon={<IconEquipment size={24} />} onClick={() => navigate("/kiosk/checkin")}>
          Check in kit
        </Action>
        <Action icon={<IconSafety size={24} />} onClick={() => navigate("/kiosk/safety")}>
          Health &amp; safety
        </Action>
      </ActionList>

      <Button variant="danger" size="lg" block onClick={() => signOut()} style={{ marginTop: "var(--space-5)" }}>
        Sign out
      </Button>
    </div>
  );
}
