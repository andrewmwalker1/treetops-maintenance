import { useNavigate } from "react-router-dom";
import { usePermissions } from "../lib/permissions.js";
import { useKeyHandover } from "../lib/useKeyHandover.js";
import KeySelector, { locationLabel } from "../keys/KeySelector.jsx";
import { colors, fonts } from "../lib/theme.js";
import { Alert, Button, Card, Field, IconArrowLeft, Input, PageHeader, Textarea } from "../ui/index.js";

// Same key-handover logic as the key-cupboard kiosk (useKeyHandover.js),
// matching RelocateKey.jsx's relationship to KeyStationRelocate.jsx --
// can_manage_keys-gated same as the kiosk's own version, not open to
// everyone with can_use_key_system.
export default function HandoverKey() {
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
      <div style={{ textAlign: "center", padding: "var(--space-8) var(--space-5)" }}>
        <p style={{ fontFamily: fonts.body, fontSize: "var(--text-base)", color: colors.inkSoft, maxWidth: "360px", margin: "0 auto" }}>
          This account doesn't have access to hand over keys.
        </p>
      </div>
    );
  }

  if (view === "done") {
    return (
      <div style={{ maxWidth: "560px" }}>
        <PageHeader title="Handed over" />
        <p style={{ fontSize: "var(--text-base)" }}>{locationLabel(selectedTag)} — handed over to {handoverTo.trim()}.</p>
        <Button variant="primary" onClick={() => navigate("/key-register")}>Done</Button>
      </div>
    );
  }

  if (view === "confirm") {
    return (
      <div style={{ maxWidth: "560px" }}>
        <Button onClick={backToSelect} icon={<IconArrowLeft size={15} />}>
          Back
        </Button>
        <PageHeader title={locationLabel(selectedTag)} />

        <Card pad="md" style={{ marginBottom: "var(--space-4)" }}>
          <p style={{ margin: 0, fontSize: "var(--text-base)" }}>
            This key is leaving for good, to the new owner — it'll drop off every checkout/relocate screen and won't come back into the cupboard.
          </p>
          {openTagIds.has(selectedTag.id) && (
            <p style={{ margin: "var(--space-2) 0 0", fontSize: "var(--text-base)" }}>
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
            />
          )}
        </Field>
        <Field label="Notes (optional)" style={{ marginBottom: "var(--space-4)" }}>
          {({ id }) => <Textarea id={id} value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />}
        </Field>

        <label
          style={{
            display: "flex",
            alignItems: "flex-start",
            gap: "var(--space-2)",
            fontSize: "var(--text-sm)",
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
            style={{ width: "18px", height: "18px", marginTop: "var(--space-1)" }}
          />
          I've removed the RFID fob from this key — only the physical key goes to the customer, the fob stays with us.
        </label>

        {error && (
          <Alert tone="danger" title="Something went wrong">
            {error}
          </Alert>
        )}

        <Button variant="primary" block onClick={handleSubmit} loading={submitting} disabled={!canSubmit}>
          {submitting ? "Handing over…" : "Complete handover"}
        </Button>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: "560px" }}>
      <Button onClick={() => navigate("/key-register")}>
        ← Keys
      </Button>
      <PageHeader title="Handover a key" />
      <KeySelector size="normal" tags={keyTags} onPick={pickTag} notFoundMessage="That tag isn't recognised, or has no home pitch yet." />
      {keyTags.length === 0 && <p style={{ color: colors.inkSoft }}>No keys are currently eligible for handover.</p>}
    </div>
  );
}
