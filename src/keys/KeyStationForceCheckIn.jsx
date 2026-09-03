import { useNavigate } from "react-router-dom";
import { usePermissions } from "../lib/permissions.js";
import { useKeyForceCheckIn } from "../lib/useKeyForceCheckIn.js";
import { issuedToSummary } from "../lib/useKeyCheckin.js";
import KeySelector, { locationLabel } from "./KeySelector.jsx";
import { colors } from "../lib/theme.js";
import { Alert, Button, Card, EmptyState, IconArrowLeft, PageHeader } from "../ui/index.js";

// A separate, can_manage_keys-gated path from ordinary check-in
// (KeyStationCheckIn.jsx, open to anyone with can_use_key_system) --
// calls admin_force_check_in_key directly, the same RPC the desktop Key
// Activity Log's "Force check-in" button uses, so someone like Sam has
// the same override at the key station itself, not just from the office.
export default function KeyStationForceCheckIn() {
  const navigate = useNavigate();
  const permissions = usePermissions();
  const { view, openTags, selected, submitting, error, pickTag, backToSelect, handleConfirm } = useKeyForceCheckIn();

  if (permissions.size > 0 && !permissions.has("can_manage_keys")) {
    return (
      <div style={{ padding: "var(--space-6)", maxWidth: "var(--width-2xl)", margin: "0 auto" }}>
        <p style={{ color: colors.inkSoft, fontSize: "var(--text-md)" }}>This account doesn't have access to force a key check-in.</p>
        <Button onClick={() => navigate("/keys")} icon={<IconArrowLeft size={16} />}>Menu</Button>
      </div>
    );
  }

  if (view === "done") {
    return (
      <div style={{ padding: "var(--space-6)", maxWidth: "var(--width-2xl)", margin: "0 auto" }}>
        <PageHeader title="Checked in" />
        <p style={{ fontSize: "var(--text-md)" }}>{locationLabel(selected)} — force checked in.</p>
        <Button variant="primary" size="kiosk" onClick={() => navigate("/keys")}>Done</Button>
      </div>
    );
  }

  if (view === "confirm") {
    const c = selected.checkout;
    return (
      <div style={{ padding: "var(--space-6)", maxWidth: "var(--width-2xl)", margin: "0 auto" }}>
        <Button onClick={backToSelect} icon={<IconArrowLeft size={16} />} style={{ marginBottom: "var(--space-5)" }}>
          Back
        </Button>
        <PageHeader title={locationLabel(selected)} />

        <Card pad="lg" style={{ marginBottom: "var(--space-5)" }}>
          <p style={{ margin: "var(--space-1) 0", fontSize: "var(--text-md)" }}>Out to <strong>{issuedToSummary(c)}</strong></p>
          <p style={{ margin: "var(--space-1) 0", fontSize: "var(--text-md)" }}>Reason: {c.reason}</p>
          <p style={{ margin: "var(--space-1) 0", fontSize: "var(--text-base)", color: colors.inkSoft }}>
            Checked out {new Date(c.checked_out_at).toLocaleString("en-GB")} by {c.checked_out_by_profile?.display_name || "—"}
          </p>
        </Card>

        {error && (
          <Alert tone="danger" title="Something went wrong">
            {error}
          </Alert>
        )}

        <Button variant="primary" size="kiosk" onClick={handleConfirm} loading={submitting}>
          {submitting ? "Checking in…" : "Force check-in"}
        </Button>
      </div>
    );
  }

  return (
    <div style={{ padding: "var(--space-6)", maxWidth: "var(--width-2xl)", margin: "0 auto" }}>
      <Button onClick={() => navigate("/keys")} icon={<IconArrowLeft size={16} />} style={{ marginBottom: "var(--space-5)" }}>
        Menu
      </Button>
      <PageHeader title="Force check-in" />
      {error && (
          <Alert tone="danger" title="Something went wrong">
            {error}
          </Alert>
        )}
      <KeySelector tags={openTags} onPick={pickTag} notFoundMessage="That key isn't currently checked out." />
      {openTags.length === 0 && <EmptyState title="No keys are currently checked out" />}
    </div>
  );
}
