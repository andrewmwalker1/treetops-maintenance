import { useNavigate } from "react-router-dom";
import { useEquipmentCheckout } from "../lib/useEquipmentCheckout.js";
import ChecklistBuilder from "../components/ChecklistBuilder.jsx";
import ReportIssueForm from "../kiosk/ReportIssueForm.jsx";
import SafetyDocumentLink from "../components/SafetyDocumentLink.jsx";
import { colors } from "../lib/theme.js";
import { Alert, Button, Card, EmptyState, IconArrowLeft, Input, PageHeader, Pill } from "../ui/index.js";

// Same equipment check-out logic as the workshop kiosk (useEquipmentCheckout.js),
// so someone like Hazel can check out a strimmer from her own phone without
// needing to be stood at the kiosk terminal -- no permission gate here
// either, matching the kiosk (equipment checkout has never been role-gated,
// unlike keys). Styled for the normal app rather than the kiosk
// since this lives inside Layout's ordinary chrome, not a full-screen
// kiosk takeover.
export default function CheckoutKit() {
  const navigate = useNavigate();
  const {
    view,
    setView,
    categories,
    selectedType,
    units,
    selectedIds,
    hoursByUnitId,
    setUnitHours,
    reportingIssueFor,
    setReportingIssueFor,
    checkoutOutcome,
    busy,
    error,
    openCategory,
    selectUnit,
    toggleUnit,
    backToCategories,
    handleCheckOut,
    handleReportIssue,
  } = useEquipmentCheckout();

  if (view === "results" && checkoutOutcome) {
    return (
      <div style={{ maxWidth: "560px" }}>
        <PageHeader title="Check-out results" />

        {checkoutOutcome.succeeded.length > 0 && (
          <Card pad="md" style={{ marginBottom: "var(--space-4)" }}>
            <PageHeader title="Checked out" level={2} />
            {checkoutOutcome.succeeded.map((u) => (
              <p key={u.id} style={{ fontSize: "var(--text-base)", margin: "var(--space-2) 0" }}>{u.name}</p>
            ))}
          </Card>
        )}

        {checkoutOutcome.failed.length > 0 && (
          <Alert tone="danger" title="Not checked out" style={{ marginBottom: "var(--space-5)" }}>
            {checkoutOutcome.failed.map((f) => (
              <p key={f.unit?.id || f.message} style={{ fontSize: "var(--text-base)", margin: "var(--space-2) 0" }}>
                {f.unit?.name || "Unit"} — {f.message}
              </p>
            ))}
          </Alert>
        )}

        <Button variant="primary" onClick={() => navigate("/")}>
          Done
        </Button>
      </div>
    );
  }

  if (view === "confirm") {
    const selected = units.filter((u) => selectedIds.has(u.id));
    const reportingUnit = reportingIssueFor ? selected.find((u) => u.id === reportingIssueFor) : null;
    const hoursUnits = selected.filter((u) => u.tracksHours);
    // Blocks the button client-side for the common case; record_equipment_hours
    // re-checks both rules server-side regardless (someone else could
    // check the same machine out with a higher reading in the gap
    // between loading this screen and submitting).
    const hoursOk = hoursUnits.every((u) => {
      const raw = hoursByUnitId[u.id];
      if (raw === undefined || raw === "") return !u.hoursRequired;
      const value = Number(raw);
      if (Number.isNaN(value)) return false;
      return u.last_hours_reading == null || value >= u.last_hours_reading;
    });

    return (
      <div style={{ maxWidth: "560px" }}>
        <Button onClick={() => setView("units")} icon={<IconArrowLeft size={15} />} style={{ marginBottom: "var(--space-4)" }}>
          Back
        </Button>
        <PageHeader title={selectedType.name} />

        {selectedType.preUseChecklist.length > 0 && (
          <Card pad="md" style={{ marginBottom: "var(--space-4)" }}>
            <PageHeader title="Before you take it" level={2} />
            <ChecklistBuilder items={selectedType.preUseChecklist} onChange={() => {}} readOnly />
          </Card>
        )}

        {/* Separate from the pre-use checklist above rather than merged into
            it -- the checklist is fixed per equipment type, this is a note
            specific to this one unit right now. Same review step, own card. */}
        {selected.some((u) => u.status === "monitor") && (
          <Alert tone="warn" title="Being monitored" style={{ marginBottom: "var(--space-4)" }}>
            {selected
              .filter((u) => u.status === "monitor")
              .map((u) => (
                <p key={u.id} style={{ fontSize: "var(--text-base)", margin: "0 0 var(--space-2)" }}>
                  {selected.length > 1 && <strong>{u.name}: </strong>}
                  {u.monitor_note}
                </p>
              ))}
          </Alert>
        )}

        {hoursUnits.length > 0 && (
          <Card pad="md" style={{ marginBottom: "var(--space-4)" }}>
            <PageHeader title="Hours reading" level={2} />
            {hoursUnits.map((u) => {
              const raw = hoursByUnitId[u.id] ?? "";
              const value = raw === "" ? null : Number(raw);
              const tooLow = value !== null && u.last_hours_reading != null && value < u.last_hours_reading;
              return (
                <div key={u.id} style={{ marginBottom: "var(--space-3)" }}>
                  {hoursUnits.length > 1 && <p style={{ fontWeight: 600, fontSize: "var(--text-base)", margin: "0 0 var(--space-1)" }}>{u.name}</p>}
                  <p style={{ fontSize: "var(--text-sm)", color: colors.inkSoft, margin: "0 0 var(--space-2)" }}>
                    {u.last_hours_reading != null
                      ? `Last reading: ${u.last_hours_reading} hrs (${new Date(u.last_hours_reading_at).toLocaleDateString("en-GB")})`
                      : "No previous reading on file"}
                  </p>
                  <Input
                    type="number"
                    inputMode="decimal"
                    value={raw}
                    onChange={(e) => setUnitHours(u.id, e.target.value)}
                    placeholder={u.hoursRequired ? "Hours (required)" : "Hours (optional)"}
                    aria-label={`Hours reading for ${u.name}`}
                    invalid={tooLow}
                  />
                  {tooLow && (
                    <p style={{ color: colors.immediate, fontSize: "var(--text-xs)", margin: "var(--space-1) 0 0" }}>
                      Can't be less than the last reading ({u.last_hours_reading} hrs)
                    </p>
                  )}
                </div>
              );
            })}
          </Card>
        )}

        {error && (
          <Alert tone="danger" title="Something went wrong">
            {error}
          </Alert>
        )}

        {reportingUnit ? (
          <>
            <p style={{ fontSize: "var(--text-base)", color: colors.inkSoft }}>
              Reporting an issue with <strong>{reportingUnit.name}</strong>
            </p>
            <ReportIssueForm
              equipmentTypeId={selectedType.id}
              onSubmit={(description) => handleReportIssue(reportingUnit.id, description)}
              onCancel={() => setReportingIssueFor(null)}
              submitting={busy}
            />
          </>
        ) : (
          <>
            {selected.length > 1 && (
              <Card pad="md" style={{ marginBottom: "var(--space-4)" }}>
                <PageHeader title={`Taking ${selected.length}`} level={2} />
                {selected.map((u) => (
                  <div
                    key={u.id}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      padding: "8px 0",
                      borderBottom: `1px solid ${colors.line}`,
                    }}
                  >
                    <span style={{ fontSize: "var(--text-base)" }}>{u.name}</span>
                    <button
                      onClick={() => setReportingIssueFor(u.id)}
                      disabled={busy}
                      style={{ background: "none", border: "none", color: colors.immediate, fontSize: "var(--text-sm)", textDecoration: "underline", cursor: "pointer" }}
                    >
                      Report issue
                    </button>
                  </div>
                ))}
              </Card>
            )}

            <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
              <Button variant="primary" onClick={() => handleCheckOut(() => navigate("/"))} disabled={busy || !hoursOk}>
                {busy ? "Checking out…" : selected.length > 1 ? `Check out selected (${selected.length})` : "Check out"}
              </Button>
              {selected.length === 1 && (
                <Button variant="danger" onClick={() => setReportingIssueFor(selected[0].id)} disabled={busy}>
                  Report an issue
                </Button>
              )}
              <Button onClick={() => setView("units")} disabled={busy}>
                Cancel
              </Button>
            </div>
          </>
        )}
      </div>
    );
  }

  if (view === "units") {
    const multi = selectedType.allowMultiCheckout;
    return (
      <div style={{ maxWidth: "560px" }}>
        <Button onClick={backToCategories} icon={<IconArrowLeft size={15} />}>
          Kit
        </Button>
        <PageHeader title={selectedType.name} />
        {multi && units.length > 0 && (
          <p style={{ color: colors.inkSoft, fontSize: "var(--text-base)", marginTop: "-4px" }}>Tick everything you need, then continue.</p>
        )}
        {units.length === 0 && (
          <EmptyState title="Nothing available right now">Every unit of this type is checked out or out of service.</EmptyState>
        )}
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
          {units.map((u) =>
            multi ? (
              <label
                key={u.id}
                className={`tt-btn tt-btn--block ${selectedIds.has(u.id) ? "tt-btn--primary" : "tt-btn--secondary"}`}
                style={{ justifyContent: "flex-start", gap: "var(--space-3)", cursor: "pointer" }}
              >
                <input
                  type="checkbox"
                  checked={selectedIds.has(u.id)}
                  onChange={() => toggleUnit(u.id)}
                  style={{ width: "20px", height: "20px", flexShrink: 0 }}
                />
                {u.name}
                {u.status === "monitor" && <Pill tone="warn">Monitor</Pill>}
              </label>
            ) : (
              <Button key={u.id} block onClick={() => selectUnit(u)} style={{ justifyContent: "flex-start" }}>
                {u.name}
                {u.status === "monitor" && <Pill tone="warn">Monitor</Pill>}
              </Button>
            )
          )}
        </div>

        {selectedType.documents.length > 0 && (
          <div style={{ marginTop: "var(--space-5)" }}>
            <PageHeader title="Health & safety" level={2} />
            {selectedType.documents.map((doc) => (
              <SafetyDocumentLink key={doc.id} doc={doc} variant="button" />
            ))}
          </div>
        )}

        {multi && (
          <Button variant="primary" block onClick={() => selectedIds.size > 0 && setView("confirm")} disabled={selectedIds.size === 0}>
            Continue{selectedIds.size > 0 ? ` (${selectedIds.size})` : ""}
          </Button>
        )}
      </div>
    );
  }

  return (
    <div style={{ maxWidth: "560px" }}>
      <PageHeader title="Checkout kit" />
      {categories.length === 0 && <EmptyState title="No equipment types set up yet" />}
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
        {categories.map((c) => (
          <Button
            key={c.id}
            block
            onClick={() => openCategory(c)}
            // A category with nothing free is still worth opening -- its
            // Health & safety documents live behind it -- so it dims
            // rather than disabling.
            style={{ justifyContent: "space-between", opacity: c.availableCount === 0 ? 0.6 : 1 }}
          >
            <span>{c.name}</span>
            <span style={{ fontSize: "var(--text-sm)", fontWeight: 400 }}>{c.availableCount} available</span>
          </Button>
        ))}
      </div>
    </div>
  );
}
