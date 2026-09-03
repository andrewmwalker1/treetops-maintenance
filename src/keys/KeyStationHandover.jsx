import { useNavigate } from "react-router-dom";
import { usePermissions } from "../lib/permissions.js";
import { useKeyHandover } from "../lib/useKeyHandover.js";
import KeySelector, { locationLabel } from "./KeySelector.jsx";
import { colors } from "../lib/theme.js";
import { Alert, Button, Card, Field, IconArrowLeft, Input, PageHeader, Textarea } from "../ui/index.js";

// can_manage_keys-gated, same as Relocate/Force check-in -- lets someone
// like Sam complete a handover from the key station itself instead of
// walking it to Admin ▸ Key Tags on a desktop (Andy, 2026-08-28: that
// wasn't holding up in real use).
export default function KeyStationHandover() {
  const navigate = useNavigate();
  const permissions = usePermissions();
  const {
    view,
    keyTags,
    openTagIds,
    selectedTag,
    handoverTo,
    setHandoverTo,
    notes,
    setNotes,
    fobConfirmed,
    setFobConfirmed,
    submitting,
    error,
    canSubmit,
    pickTag,
    backToSelect,
    handleSubmit,
  } = useKeyHandover();

  if (permissions.size > 0 && !permissions.has("can_manage_keys")) {
    return (
      <div style={{ padding: "var(--space-6)", maxWidth: "640px", margin: "0 auto" }}>
        <p style={{ color: colors.inkSoft, fontSize: "var(--text-md)" }}>This account doesn't have access to hand over keys.</p>
        <Button onClick={() => navigate("/keys")} icon={<IconArrowLeft size={16} />}>Menu</Button>
      </div>
    );
  }

  if (view === "done") {
    return (
      <div style={{ padding: "var(--space-6)", maxWidth: "640px", margin: "0 auto" }}>
        <PageHeader title="Handed over" />
        <p style={{ fontSize: "var(--text-md)" }}>{locationLabel(selectedTag)} — handed over to {handoverTo.trim()}.</p>
        <Button variant="primary" size="kiosk" onClick={() => navigate("/keys")}>Done</Button>
      </div>
    );
  }

  if (view === "confirm") {
    return (
      <div style={{ padding: "var(--space-6)", maxWidth: "640px", margin: "0 auto" }}>
        <Button onClick={backToSelect} icon={<IconArrowLeft size={16} />} style={{ marginBottom: "var(--space-5)" }}>
          Back
        </Button>
        <PageHeader title={locationLabel(selectedTag)} />

        <Card pad="lg" style={{ marginBottom: "var(--space-4)" }}>
          <p style={{ margin: 0, fontSize: "var(--text-base)" }}>
            This key is leaving for good, to the new owner — it'll drop off every checkout/relocate screen and won't come back into the cupboard.
          </p>
          {openTagIds.has(selectedTag.id) && (
            <p style={{ margin: "var(--space-3) 0 0", fontSize: "var(--text-base)" }}>
              This key is currently checked out — completing the handover will automatically check it back in, since it's not coming back.
            </p>
          )}
        </Card>

        <Field label="Handed over to" required style={{ marginBottom: "var(--space-4)" }}>
          {({ id }) => (
            <Input
              id={id}
              type="text"
              required
              autoFocus
              value={handoverTo}
              onChange={(e) => setHandoverTo(e.target.value)}
              placeholder="Customer name"
              className="tt-input--kiosk"
            />
          )}
        </Field>
        <Field label="Notes (optional)" style={{ marginBottom: "var(--space-4)" }}>
          {({ id }) => (
            <Textarea id={id} value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className="tt-input--kiosk" />
          )}
        </Field>

        <label
          style={{
            display: "flex",
            alignItems: "flex-start",
            gap: "var(--space-3)",
            fontSize: "var(--text-base)",
            padding: "var(--space-3)",
            marginBottom: "var(--space-4)",
            borderRadius: "var(--radius-sm)",
            border: `1px solid ${colors.gold}`,
            background: colors.paper,
          }}
        >
          <input
            type="checkbox"
            checked={fobConfirmed}
            onChange={(e) => setFobConfirmed(e.target.checked)}
            style={{ width: "22px", height: "22px", marginTop: "var(--space-1)" }}
          />
          I've removed the RFID fob from this key — only the physical key goes to the customer, the fob stays with us.
        </label>

        {error && (
          <Alert tone="danger" title="Something went wrong">
            {error}
          </Alert>
        )}

        <Button variant="primary" size="kiosk" onClick={handleSubmit} loading={submitting} disabled={!canSubmit}>
          {submitting ? "Handing over…" : "Complete handover"}
        </Button>
      </div>
    );
  }

  return (
    <div style={{ padding: "var(--space-6)", maxWidth: "640px", margin: "0 auto" }}>
      <Button onClick={() => navigate("/keys")} icon={<IconArrowLeft size={16} />} style={{ marginBottom: "var(--space-5)" }}>
        Menu
      </Button>
      <PageHeader title="Handover a key" />
      <KeySelector tags={keyTags} onPick={pickTag} notFoundMessage="That tag isn't recognised, or has no home pitch yet." />
      {keyTags.length === 0 && <p style={{ color: colors.inkSoft }}>No keys are currently eligible for handover.</p>}
    </div>
  );
}
