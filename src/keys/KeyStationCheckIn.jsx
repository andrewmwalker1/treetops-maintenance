import { useNavigate, useLocation } from "react-router-dom";
import { useKeyCheckin, issuedToSummary } from "../lib/useKeyCheckin.js";
import KeySelector, { locationLabel } from "./KeySelector.jsx";
import { colors } from "../lib/theme.js";
import { Alert, Button, Card, EmptyState, IconArrowLeft, PageHeader } from "../ui/index.js";

export default function KeyStationCheckIn() {
  const navigate = useNavigate();
  const location = useLocation();
  const { view, openTags, selected, submitting, error, pickTag, backToSelect, handleConfirm } = useKeyCheckin(location.state?.presetTagId);

  if (view === "done") {
    return (
      <div style={{ padding: "var(--space-6)", maxWidth: "640px", margin: "0 auto" }}>
        <PageHeader title="Checked in" />
        <p style={{ fontSize: "var(--text-md)" }}>{locationLabel(selected)} — logged.</p>
        <Button variant="primary" size="kiosk" onClick={() => navigate("/keys")}>Done</Button>
      </div>
    );
  }

  if (view === "confirm") {
    const c = selected.checkout;
    return (
      <div style={{ padding: "var(--space-6)", maxWidth: "640px", margin: "0 auto" }}>
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
          {submitting ? "Checking in…" : "Confirm check-in"}
        </Button>
      </div>
    );
  }

  return (
    <div style={{ padding: "var(--space-6)", maxWidth: "640px", margin: "0 auto" }}>
      <Button onClick={() => navigate("/keys")} icon={<IconArrowLeft size={16} />} style={{ marginBottom: "var(--space-5)" }}>
        Menu
      </Button>
      <PageHeader title="Check in a key" />
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
