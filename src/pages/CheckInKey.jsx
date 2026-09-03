import { useNavigate, useLocation } from "react-router-dom";
import { useKeyCheckin, issuedToSummary } from "../lib/useKeyCheckin.js";
import KeySelector, { locationLabel } from "../keys/KeySelector.jsx";
import { colors } from "../lib/theme.js";
import { Alert, Button, Card, EmptyState, IconArrowLeft, PageHeader } from "../ui/index.js";

// Same key check-in logic as the key-cupboard kiosk (useKeyCheckin.js),
// matching CheckinKit.jsx's relationship to KioskCheckIn.jsx.
export default function CheckInKey() {
  const navigate = useNavigate();
  const location = useLocation();
  const { view, openTags, selected, submitting, error, pickTag, backToSelect, handleConfirm } = useKeyCheckin(location.state?.presetTagId);

  if (view === "done") {
    return (
      <div style={{ maxWidth: "560px" }}>
        <PageHeader title="Checked in" />
        <p style={{ fontSize: "var(--text-base)" }}>{locationLabel(selected)} — logged.</p>
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
          {submitting ? "Checking in…" : "Confirm check-in"}
        </Button>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: "560px" }}>
      <Button onClick={() => navigate("/key-register")} icon={<IconArrowLeft size={15} />}>
        Keys
      </Button>
      <PageHeader title="Check in a key" />
      {error && (
          <Alert tone="danger" title="Something went wrong">
            {error}
          </Alert>
        )}
      <KeySelector size="normal" tags={openTags} onPick={pickTag} notFoundMessage="That key isn't currently checked out." />
      {openTags.length === 0 && <EmptyState title="No keys are currently checked out" />}
    </div>
  );
}
