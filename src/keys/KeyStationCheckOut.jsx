import { useNavigate, useLocation } from "react-router-dom";
import { useKeyCheckout, OTHER_CONTRACTOR } from "../lib/useKeyCheckout.js";
import KeySelector, { locationLabel } from "./KeySelector.jsx";
import { colors } from "../lib/theme.js";
import { Alert, Button, Card, Chip, IconArrowLeft, Input, PageHeader, Select } from "../ui/index.js";

export default function KeyStationCheckOut() {
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
      <div style={{ padding: "var(--space-6)", maxWidth: "var(--width-2xl)", margin: "0 auto" }}>
        <PageHeader title="Checked out" />
        <p style={{ fontSize: "var(--text-md)" }}>{locationLabel(selectedTag)} — logged.</p>
        <Button variant="primary" size="kiosk" onClick={() => navigate("/keys")}>Done</Button>
      </div>
    );
  }

  if (view === "confirm") {
    return (
      <div style={{ padding: "var(--space-6)", maxWidth: "var(--width-2xl)", margin: "0 auto" }}>
        <Button onClick={backToSelect} icon={<IconArrowLeft size={16} />} style={{ marginBottom: "var(--space-5)" }}>
          Back
        </Button>
        <PageHeader title={locationLabel(selectedTag)} />

        <Card pad="lg" style={{ marginBottom: "var(--space-4)" }}>
          {myContractor ? (
            <p style={{ margin: 0, fontSize: "var(--text-md)" }}>
              Checking out for <strong>{myContractor.name}</strong>.
            </p>
          ) : (
            <>
              <p style={{ fontWeight: 600, marginTop: 0, marginBottom: "var(--space-3)" }}>Who's taking it?</p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--space-2)", marginBottom: "var(--space-2)" }}>
                {[
                  { value: "self", label: "Me" },
                  { value: "contractor", label: "Contractor" },
                  { value: "customer", label: "Customer" },
                  { value: "guest", label: "Guest" },
                ].map((opt) => (
                  <Chip key={opt.value} active={issuedToKind === opt.value} onClick={() => setIssuedToKind(opt.value)}>
                    {opt.label}
                  </Chip>
                ))}
              </div>

              {issuedToKind === "contractor" && (
                <>
                  <Select
                    value={contractorChoice}
                    onChange={(e) => setContractorChoice(e.target.value)}
                    aria-label="Contractor"
                    className="tt-input--kiosk"
                    style={{ marginBottom: "var(--space-4)" }}
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
                      className="tt-input--kiosk"
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
                  className="tt-input--kiosk"
                />
              )}

              {issuedToKind === "guest" && (
                <label style={{ display: "flex", alignItems: "center", gap: "var(--space-3)", color: colors.inkSoft }}>
                  <input type="checkbox" checked={guestConfirmed} onChange={(e) => setGuestConfirmed(e.target.checked)} />
                  Confirmed with the caravan owner
                </label>
              )}
            </>
          )}
        </Card>

        <Card pad="lg" style={{ marginBottom: "var(--space-4)" }}>
          <p style={{ fontWeight: 600, marginTop: 0, marginBottom: "var(--space-3)" }}>Reason</p>
          {reasonPresets.length > 0 && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--space-2)", marginBottom: "var(--space-3)" }}>
              {reasonPresets.map((r) => (
                <Chip key={r.id} active={reason === r.label} onClick={() => setReason(r.label)}>
                  {r.label}
                </Chip>
              ))}
            </div>
          )}
          <Input
            type="text"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Reason for taking this key"
            aria-label="Reason for taking this key"
            className="tt-input--kiosk"
          />
        </Card>

        {error && (
          <Alert tone="danger" title="Something went wrong">
            {error}
          </Alert>
        )}

        <Button variant="primary" size="kiosk" onClick={handleSubmit} loading={submitting} disabled={!canSubmit}>
          {submitting ? "Checking out…" : "Check out"}
        </Button>
      </div>
    );
  }

  return (
    <div style={{ padding: "var(--space-6)", maxWidth: "var(--width-2xl)", margin: "0 auto" }}>
      <Button onClick={() => navigate("/keys")} icon={<IconArrowLeft size={16} />} style={{ marginBottom: "var(--space-5)" }}>
        Menu
      </Button>
      <PageHeader title="Check out a key" />
      <KeySelector
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
