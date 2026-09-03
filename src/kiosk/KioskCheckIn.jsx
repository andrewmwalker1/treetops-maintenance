import { useNavigate } from "react-router-dom";
import { useEquipmentCheckin } from "../lib/useEquipmentCheckin.js";
import ReportIssueForm from "./ReportIssueForm.jsx";
import SafetyDocumentLink from "../components/SafetyDocumentLink.jsx";
import { colors } from "../lib/theme.js";
import { Alert, Button, EmptyState, IconArrowLeft, PageHeader } from "../ui/index.js";

export default function KioskCheckIn() {
  const navigate = useNavigate();
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
      <div style={{ padding: "var(--space-6)", maxWidth: "640px", margin: "0 auto" }}>
        <Button onClick={backToList} icon={<IconArrowLeft size={16} />} style={{ marginBottom: "var(--space-5)" }}>
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
            <p style={{ fontSize: "var(--text-md)", color: colors.inkSoft }}>
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
              <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)", marginBottom: "var(--space-4)" }}>
                {selected.map((c) => (
                  <div
                    key={c.id}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      gap: "var(--space-3)",
                      padding: "var(--space-2) 0",
                      borderBottom: `1px solid ${colors.line}`,
                    }}
                  >
                    <span style={{ fontSize: "var(--text-md)" }}>{c.equipment.name}</span>
                    <Button variant="danger" size="sm" onClick={() => setReportingIssueFor(c.id)} disabled={busy}>
                      Report issue
                    </Button>
                  </div>
                ))}
              </div>
            )}

            <p style={{ fontSize: "var(--text-md)", color: colors.ink, marginTop: 0 }}>Is the Kit clean and free from issues?</p>
            <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
              <Button variant="primary" size="kiosk" onClick={handleConfirmClean} loading={busy}>
                {busy ? "Checking in…" : selected.length > 1 ? `Yes, check in all (${selected.length})` : "Yes"}
              </Button>
              {selected.length === 1 && (
                <Button variant="danger" size="kiosk" onClick={() => setReportingIssueFor(selected[0].id)} disabled={busy}>
                  Report an Issue
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
    <div
      style={{
        padding: "var(--space-6)",
        maxWidth: "640px",
        margin: "0 auto",
        paddingBottom: selectedIds.size > 0 ? "110px" : "var(--space-6)",
        boxSizing: "border-box",
      }}
    >
      <Button onClick={() => navigate("/kiosk")} icon={<IconArrowLeft size={16} />} style={{ marginBottom: "var(--space-5)" }}>
        Menu
      </Button>
      <PageHeader title="Check-in Kit" />
      {error && (
        <Alert tone="danger" title="Something went wrong">
          {error}
        </Alert>
      )}
      {checkouts.length === 0 && <EmptyState title="Nothing to check in">Nothing is currently checked out to you.</EmptyState>}
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
        {checkouts.map((c) =>
          c.equipment.equipment_type?.allow_multi_checkout ? (
            // A multi-checkout type ticks many, then continues, so its row
            // is a label wrapping a checkbox rather than a button -- but it
            // wears the same kiosk button sizing so the list reads as one
            // set of targets.
            <label
              key={c.id}
              className={`tt-btn tt-btn--kiosk ${selectedIds.has(c.id) ? "tt-btn--primary" : "tt-btn--secondary"}`}
              style={{ justifyContent: "flex-start", gap: "var(--space-4)", cursor: "pointer" }}
            >
              <input
                type="checkbox"
                checked={selectedIds.has(c.id)}
                onChange={() => toggleSelect(c.id)}
                style={{ width: "26px", height: "26px", flexShrink: 0 }}
              />
              {c.equipment.name}
            </label>
          ) : (
            <Button key={c.id} variant="primary" size="kiosk" onClick={() => openSingle(c)}>
              {c.equipment.name}
            </Button>
          )
        )}
      </div>

      {documents.length > 0 && (
        <div style={{ marginTop: "var(--space-6)" }}>
          <PageHeader title="Health & safety" level={2} />
          {documents.map((doc) => (
            <SafetyDocumentLink key={doc.id} doc={doc} variant="kiosk-button" />
          ))}
        </div>
      )}

      {selectedIds.size > 0 && (
        <div
          style={{
            position: "fixed",
            left: 0,
            right: 0,
            bottom: 0,
            padding: "var(--space-4) var(--space-6)",
            background: colors.paper,
            borderTop: `1px solid ${colors.line}`,
            boxSizing: "border-box",
          }}
        >
          <Button
            variant="primary"
            size="kiosk"
            onClick={proceedWithSelected}
            style={{ maxWidth: "592px", margin: "0 auto", display: "flex" }}
          >
            Continue ({selectedIds.size})
          </Button>
        </div>
      )}
    </div>
  );
}
