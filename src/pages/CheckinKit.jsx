import { useEquipmentCheckin } from "../lib/useEquipmentCheckin.js";
import ReportIssueForm from "../kiosk/ReportIssueForm.jsx";
import SafetyDocumentLink from "../components/SafetyDocumentLink.jsx";
import { colors } from "../lib/theme.js";
import { Alert, Button, Card, EmptyState, IconArrowLeft, PageHeader } from "../ui/index.js";

// Same equipment check-in logic as the workshop kiosk (useEquipmentCheckin.js),
// so someone like Hazel can check a strimmer back in from her own phone
// without needing to be stood at the kiosk terminal -- matches CheckoutKit.jsx
// (equipment checkout/check-in has never been role-gated, unlike keys).
// Styled for the normal app rather than the kiosk, since this lives
// inside Layout's ordinary chrome, not a full-screen kiosk takeover.
export default function CheckinKit() {
  const {
    view,
    checkouts,
    selectedIds,
    reportingIssueFor,
    setReportingIssueFor,
    busy,
    error,
    toggleSelect,
    openSingle,
    proceedWithSelected,
    backToList,
    handleConfirmClean,
    handleReportIssue,
  } = useEquipmentCheckin();

  if (view === "confirm") {
    const selected = checkouts.filter((c) => selectedIds.has(c.id));
    const reportingCheckout = reportingIssueFor ? selected.find((c) => c.id === reportingIssueFor) : null;

    return (
      <div style={{ maxWidth: "var(--width-xl)" }}>
        <Button onClick={backToList} icon={<IconArrowLeft size={15} />}>
          Back
        </Button>
        <PageHeader title={selected.length > 1 ? `Checking in ${selected.length}` : selected[0]?.equipment.name} />

        {error && (
          <Alert tone="danger" title="Something went wrong">
            {error}
          </Alert>
        )}

        {reportingCheckout ? (
          <>
            <p style={{ color: colors.inkSoft }}>
              Reporting an issue with <strong>{reportingCheckout.equipment.name}</strong>
            </p>
            <ReportIssueForm
              equipmentTypeId={reportingCheckout.equipment.equipment_type_id}
              onSubmit={(description) => handleReportIssue(reportingCheckout.id, description)}
              onCancel={() => setReportingIssueFor(null)}
              submitting={busy}
            />
          </>
        ) : (
          <>
            {selected.length > 1 && (
              <Card pad="md" style={{ marginBottom: "var(--space-4)" }}>
                <PageHeader title={`Checking in ${selected.length}`} level={2} />
                {selected.map((c) => (
                  <div
                    key={c.id}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      padding: "var(--space-2) 0",
                      borderBottom: `1px solid ${colors.line}`,
                    }}
                  >
                    <span style={{ fontSize: "var(--text-base)" }}>{c.equipment.name}</span>
                    <Button variant="danger" size="sm" onClick={() => setReportingIssueFor(c.id)} disabled={busy}>
                      Report issue
                    </Button>
                  </div>
                ))}
              </Card>
            )}

            <p style={{ color: colors.ink, marginTop: 0 }}>Is the kit clean and free from issues?</p>
            <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
              <Button variant="primary" onClick={handleConfirmClean} loading={busy}>
                {busy ? "Checking in…" : selected.length > 1 ? `Yes, check in all (${selected.length})` : "Yes"}
              </Button>
              {selected.length === 1 && (
                <Button variant="danger" onClick={() => setReportingIssueFor(selected[0].id)} disabled={busy}>
                  Report an issue
                </Button>
              )}
            </div>
          </>
        )}
      </div>
    );
  }

  const documents = [
    ...new Map(checkouts.flatMap((c) => c.equipment.equipment_type?.documents || []).map((d) => [d.id, d])).values(),
  ].sort((a, b) => a.title.localeCompare(b.title));

  return (
    <div style={{ maxWidth: "var(--width-xl)" }}>
      <PageHeader title="Check-in kit" />
      {error && (
          <Alert tone="danger" title="Something went wrong">
            {error}
          </Alert>
        )}
      {checkouts.length === 0 && <EmptyState title="Nothing to check in">Nothing is currently checked out to you.</EmptyState>}
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
        {checkouts.map((c) =>
          c.equipment.equipment_type?.allow_multi_checkout ? (
            <label
              key={c.id}
              className={`tt-btn tt-btn--block ${selectedIds.has(c.id) ? "tt-btn--primary" : "tt-btn--secondary"}`}
              style={{ justifyContent: "flex-start", gap: "var(--space-3)", cursor: "pointer" }}
            >
              <input
                type="checkbox"
                checked={selectedIds.has(c.id)}
                onChange={() => toggleSelect(c.id)}
                style={{ width: "20px", height: "20px", flexShrink: 0 }}
              />
              {c.equipment.name}
            </label>
          ) : (
            <Button key={c.id} block onClick={() => openSingle(c)} style={{ justifyContent: "flex-start" }}>
              {c.equipment.name}
            </Button>
          )
        )}
      </div>

      {documents.length > 0 && (
        <div style={{ marginTop: "var(--space-5)" }}>
          <PageHeader title="Health & safety" level={2} />
          {documents.map((doc) => (
            <SafetyDocumentLink key={doc.id} doc={doc} variant="button" />
          ))}
        </div>
      )}

      {selectedIds.size > 0 && (
        <Button variant="primary" block onClick={proceedWithSelected} style={{ marginTop: "var(--space-4)" }}>
          Continue ({selectedIds.size})
        </Button>
      )}
    </div>
  );
}
