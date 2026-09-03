import { useNavigate } from "react-router-dom";
import { usePermissions } from "../lib/permissions.js";
import { useKeyForceCheckIn } from "../lib/useKeyForceCheckIn.js";
import { issuedToSummary } from "../lib/useKeyCheckin.js";
import KeySelector, { locationLabel } from "../keys/KeySelector.jsx";
import { colors, fonts } from "../lib/theme.js";
import { Alert, Button, Card, IconArrowLeft, PageHeader } from "../ui/index.js";

// Same force-check-in logic as the key-cupboard kiosk
// (useKeyForceCheckIn.js), matching CheckInKey.jsx's relationship to
// KeyStationCheckIn.jsx -- can_manage_keys-gated same as the kiosk's own
// version, not open to everyone with can_use_key_system the way ordinary
// check-in is.
export default function ForceCheckInKey() {
  const navigate = useNavigate();
  const permissions = usePermissions();
  const { view, openTags, selected, submitting, error, pickTag, backToSelect, handleConfirm } = useKeyForceCheckIn();

  if (permissions.size > 0 && !permissions.has("can_manage_keys")) {
    return (
      <div style={{ textAlign: "center", padding: "var(--space-8) var(--space-5)" }}>
        <p style={{ fontFamily: fonts.body, fontSize: "var(--text-base)", color: colors.inkSoft, maxWidth: "360px", margin: "0 auto" }}>
          This account doesn't have access to force a key check-in.
        </p>
      </div>
    );
  }

  if (view === "done") {
    return (
      <div style={{ maxWidth: "560px" }}>
        <PageHeader title="Checked in" />
        <p style={{ fontSize: "var(--text-base)" }}>{locationLabel(selected)} — force checked in.</p>
        <Button variant="primary" onClick={() => navigate("/key-register")}>Done</Button>
      </div>
    );
  }

  if (view === "confirm") {
    const c = selected.checkout;
    return (
      <div style={{ maxWidth: "560px" }}>
        <Button onClick={backToSelect} icon={<IconArrowLeft size={15} />}>
          Back
        </Button>
        <PageHeader title={locationLabel(selected)} />

        <Card pad="md" style={{ marginBottom: "var(--space-4)" }}>
          <p style={{ margin: "var(--space-1) 0", fontSize: "var(--text-base)" }}>Out to <strong>{issuedToSummary(c)}</strong></p>
          <p style={{ margin: "var(--space-1) 0", fontSize: "var(--text-base)" }}>Reason: {c.reason}</p>
          <p style={{ margin: "var(--space-1) 0", fontSize: "var(--text-sm)", color: colors.inkSoft }}>
            Checked out {new Date(c.checked_out_at).toLocaleString("en-GB")} by {c.checked_out_by_profile?.display_name || "—"}
          </p>
        </Card>

        {error && (
          <Alert tone="danger" title="Something went wrong">
            {error}
          </Alert>
        )}

        <Button variant="primary" block onClick={handleConfirm} disabled={submitting}>
          {submitting ? "Checking in…" : "Force check-in"}
        </Button>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: "560px" }}>
      <Button onClick={() => navigate("/key-register")}>
        ← Keys
      </Button>
      <PageHeader title="Force check-in" />
      {error && (
          <Alert tone="danger" title="Something went wrong">
            {error}
          </Alert>
        )}
      <KeySelector size="normal" tags={openTags} onPick={pickTag} notFoundMessage="That key isn't currently checked out." />
      {openTags.length === 0 && <p style={{ color: colors.inkSoft }}>No keys are currently checked out.</p>}
    </div>
  );
}
