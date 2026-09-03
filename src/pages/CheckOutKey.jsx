import { useNavigate, useLocation } from "react-router-dom";
import { useKeyCheckout, OTHER_CONTRACTOR } from "../lib/useKeyCheckout.js";
import KeySelector, { locationLabel } from "../keys/KeySelector.jsx";
import { colors } from "../lib/theme.js";
import { Alert, Button, Card, IconArrowLeft, Input, PageHeader, Select } from "../ui/index.js";

// Same key check-out logic as the key-cupboard kiosk (useKeyCheckout.js),
// so someone like Hazel can check out a pitch key from her own phone
// without needing to be stood at the cupboard -- matches CheckoutKit.jsx's
// relationship to KioskCheckOut.jsx. Styled for the normal app (theme.js,
// not the kiosk) since this lives inside Layout's ordinary chrome, not
// a full-screen kiosk takeover.
export default function CheckOutKey() {
  const navigate = useNavigate();
  const location = useLocation();
  const {
    view,
    availableTags,
    openTagIds,
    contractors,
    selectedTag,
    issuedToKind,
    setIssuedToKind,
    contractorChoice,
    setContractorChoice,
    contractorFreeText,
    setContractorFreeText,
    personName,
    setPersonName,
    guestConfirmed,
    setGuestConfirmed,
    reason,
    setReason,
    submitting,
    error,
    setError,
    myContractor,
    reasonPresets,
    canSubmit,
    pickTag,
    backToSelect,
    handleSubmit,
  } = useKeyCheckout(location.state?.presetTagId);

  if (view === "done") {
    return (
      <div style={{ maxWidth: "var(--width-xl)" }}>
        <PageHeader title="Checked out" />
        <p style={{ fontSize: "var(--text-base)" }}>{locationLabel(selectedTag)} — logged.</p>
        <Button variant="primary" onClick={() => navigate("/key-register")}>Done</Button>
      </div>
    );
  }

  if (view === "confirm") {
    return (
      <div style={{ maxWidth: "var(--width-xl)" }}>
        <Button onClick={backToSelect} icon={<IconArrowLeft size={15} />}>
          Back
        </Button>
        <PageHeader title={locationLabel(selectedTag)} />

        <Card pad="md" style={{ marginBottom: "var(--space-4)" }}>
          {myContractor ? (
            <p style={{ margin: 0, fontSize: "var(--text-base)" }}>
              Checking out for <strong>{myContractor.name}</strong>.
            </p>
          ) : (
            <>
              <p style={{ fontWeight: 600, marginTop: 0, marginBottom: "var(--space-3)", fontSize: "var(--text-base)" }}>Who's taking it?</p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--space-2)", marginBottom: "var(--space-2)" }}>
                {[
                  { value: "self", label: "Me" },
                  { value: "contractor", label: "Contractor" },
                  { value: "customer", label: "Customer" },
                  { value: "guest", label: "Guest" },
                ].map((opt) => (
                  <Button key={opt.value} onClick={() => setIssuedToKind(opt.value)}>
                    {opt.label}
                  </Button>
                ))}
              </div>

              {issuedToKind === "contractor" && (
                <>
                  <Select
                    value={contractorChoice}
                    onChange={(e) => setContractorChoice(e.target.value)}
                    aria-label="Contractor"
                    style={{ marginBottom: "var(--space-3)" }}
                  >
                    <option value="">Select a contractor…</option>
                    {contractors.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                    <option value={OTHER_CONTRACTOR}>Other…</option>
                  </Select>
                  {contractorChoice === OTHER_CONTRACTOR && (
                    <Input
                      type="text"
                      value={contractorFreeText}
                      onChange={(e) => setContractorFreeText(e.target.value)}
                      placeholder="Contractor / company name"
                      aria-label="Contractor or company name"
                    />
                  )}
                </>
              )}

              {(issuedToKind === "customer" || issuedToKind === "guest") && (
                <Input
                  type="text"
                  value={personName}
                  onChange={(e) => setPersonName(e.target.value)}
                  placeholder={issuedToKind === "guest" ? "Guest's name" : "Customer's name"}
                  aria-label="Name"
                />
              )}

              {issuedToKind === "guest" && (
                <label style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", fontSize: "var(--text-sm)", color: colors.inkSoft }}>
                  <input type="checkbox" checked={guestConfirmed} onChange={(e) => setGuestConfirmed(e.target.checked)} style={{ width: "var(--checkbox-size-sm)", height: "var(--checkbox-size-sm)" }} />
                  Confirmed with the caravan owner
                </label>
              )}
            </>
          )}
        </Card>

        <Card pad="md" style={{ marginBottom: "var(--space-4)" }}>
          <p style={{ fontWeight: 600, marginTop: 0, marginBottom: "var(--space-3)", fontSize: "var(--text-base)" }}>Reason</p>
          {reasonPresets.length > 0 && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--space-2)", marginBottom: "var(--space-3)" }}>
              {reasonPresets.map((r) => (
                <Button key={r.id} onClick={() => setReason(r.label)}>
                  {r.label}
                </Button>
              ))}
            </div>
          )}
          <Input
            type="text"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Reason for taking this key"
            aria-label="Reason for taking this key"
          />
        </Card>

        {error && (
          <Alert tone="danger" title="Something went wrong">
            {error}
          </Alert>
        )}

        <Button variant="primary" block onClick={handleSubmit} disabled={!canSubmit || submitting}>
          {submitting ? "Checking out…" : "Check out"}
        </Button>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: "var(--width-xl)" }}>
      <Button onClick={() => navigate("/key-register")} icon={<IconArrowLeft size={15} />}>
        Keys
      </Button>
      <PageHeader title="Check out a key" />
      <KeySelector
        size="normal"
        tags={availableTags}
        onPick={(tag) => {
          if (openTagIds.has(tag.id)) {
            setError("This key is already checked out.");
            return;
          }
          pickTag(tag);
        }}
        notFoundMessage="That key isn't recognised, or it's already checked out."
      />
    </div>
  );
}
