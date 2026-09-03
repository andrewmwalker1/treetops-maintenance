import { useNavigate } from "react-router-dom";
import { useEquipmentCheckout } from "../lib/useEquipmentCheckout.js";
import ChecklistBuilder from "../components/ChecklistBuilder.jsx";
import ReportIssueForm from "./ReportIssueForm.jsx";
import SafetyDocumentLink from "../components/SafetyDocumentLink.jsx";
import { colors } from "../lib/theme.js";
import { Alert, Button, Card, EmptyState, IconArrowLeft, Input, PageHeader, Pill } from "../ui/index.js";

export default function KioskCheckOut() {
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
      <div style={{ padding: "var(--space-6)", maxWidth: "640px", margin: "0 auto" }}>
        <PageHeader title="Check-out results" />

        {checkoutOutcome.succeeded.length > 0 && (
          <Card pad="lg" style={{ marginBottom: "var(--space-4)" }}>
            <PageHeader title="Checked out" level={2} />
            {checkoutOutcome.succeeded.map((u) => (
              <p key={u.id} style={{ fontSize: "var(--text-md)", margin: "var(--space-2) 0" }}>
                {u.name}
              </p>
            ))}
          </Card>
        )}

        {checkoutOutcome.failed.length > 0 && (
          <Alert tone="danger" title="Not checked out" style={{ marginBottom: "var(--space-5)" }}>
            {checkoutOutcome.failed.map((f) => (
              <p key={f.unit?.id || f.message}>
                {f.unit?.name || "Unit"} — {f.message}
              </p>
            ))}
          </Alert>
        )}

        <Button variant="primary" size="kiosk" onClick={() => navigate("/kiosk")}>
          Done
        </Button>
      </div>
    );
  }

  if (view === "confirm") {
    const selected = units.filter((u) => selectedIds.has(u.id));
    const reportingUnit = reportingIssueFor ? selected.find((u) => u.id === reportingIssueFor) : null;
    const hoursUnits = selected.filter((u) => u.tracksHours);
    const hoursOk = hoursUnits.every((u) => {
      const raw = hoursByUnitId[u.id];
      if (raw === undefined || raw === "") return !u.hoursRequired;
      const value = Number(raw);
      if (Number.isNaN(value)) return false;
      return u.last_hours_reading == null || value >= u.last_hours_reading;
    });

    return (
      <div style={{ padding: "var(--space-6)", maxWidth: "640px", margin: "0 auto" }}>
        <Button onClick={() => setView("units")} icon={<IconArrowLeft size={16} />} style={{ marginBottom: "var(--space-5)" }}>
          Back
        </Button>
        <PageHeader title={selectedType.name} />

        {selectedType.preUseChecklist.length > 0 && (
          <Card pad="lg" style={{ marginBottom: "var(--space-5)" }}>
            <PageHeader title="Before you take it" level={2} />
            <ChecklistBuilder items={selectedType.preUseChecklist} onChange={() => {}} readOnly />
          </Card>
        )}

        {selected.some((u) => u.status === "monitor") && (
          <Alert tone="warn" title="Being monitored" style={{ marginBottom: "var(--space-5)" }}>
            {selected
              .filter((u) => u.status === "monitor")
              .map((u) => (
                <p key={u.id}>
                  {selected.length > 1 && <strong>{u.name}: </strong>}
                  {u.monitor_note}
                </p>
              ))}
          </Alert>
        )}

        {hoursUnits.length > 0 && (
          <Card pad="lg" style={{ marginBottom: "var(--space-5)" }}>
            <PageHeader title="Hours reading" level={2} />
            {hoursUnits.map((u) => {
              const raw = hoursByUnitId[u.id] ?? "";
              const value = raw === "" ? null : Number(raw);
              const tooLow = value !== null && u.last_hours_reading != null && value < u.last_hours_reading;
              return (
                <div key={u.id} style={{ marginBottom: "var(--space-4)" }}>
                  {hoursUnits.length > 1 && (
                    <p style={{ fontWeight: 600, fontSize: "var(--text-md)", margin: "0 0 var(--space-2)" }}>{u.name}</p>
                  )}
                  <p style={{ fontSize: "var(--text-base)", color: colors.inkSoft, margin: "0 0 var(--space-2)" }}>
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
                    className="tt-input--kiosk"
                  />
                  {tooLow && (
                    <p style={{ color: colors.immediate, fontSize: "var(--text-base)", margin: "var(--space-2) 0 0" }}>
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
            <p style={{ fontSize: "var(--text-md)", color: colors.inkSoft }}>
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
              <Card pad="lg" style={{ marginBottom: "var(--space-4)" }}>
                <PageHeader title={`Taking ${selected.length}`} level={2} />
                {selected.map((u) => (
                  <div
                    key={u.id}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      gap: "var(--space-3)",
                      padding: "var(--space-2) 0",
                      borderBottom: `1px solid ${colors.line}`,
                    }}
                  >
                    <span style={{ fontSize: "var(--text-md)" }}>{u.name}</span>
                    <Button variant="danger" size="sm" onClick={() => setReportingIssueFor(u.id)} disabled={busy}>
                      Report issue
                    </Button>
                  </div>
                ))}
              </Card>
            )}

            <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
              <Button
                variant="primary"
                size="kiosk"
                onClick={() => handleCheckOut(() => navigate("/kiosk"))}
                loading={busy}
                disabled={!hoursOk}
              >
                {busy ? "Checking out…" : selected.length > 1 ? `Check Out Selected (${selected.length})` : "Check Out"}
              </Button>
              {selected.length === 1 && (
                <Button variant="danger" size="kiosk" onClick={() => setReportingIssueFor(selected[0].id)} disabled={busy}>
                  Report an Issue
                </Button>
              )}
              <Button size="kiosk" onClick={() => setView("units")} disabled={busy}>
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
      <div
        style={{
          padding: "var(--space-6)",
          maxWidth: "640px",
          margin: "0 auto",
          paddingBottom: multi ? "110px" : "var(--space-6)",
          boxSizing: "border-box",
        }}
      >
        <Button onClick={backToCategories} icon={<IconArrowLeft size={16} />} style={{ marginBottom: "var(--space-5)" }}>
          Categories
        </Button>
        <PageHeader title={selectedType.name} subtitle={multi && units.length > 0 ? "Tick everything you need, then continue." : undefined} />
        {units.length === 0 && (
          <EmptyState title="Nothing available right now">Every unit of this type is checked out or out of service.</EmptyState>
        )}
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
          {units.map((u) =>
            multi ? (
              // Tick-many-then-continue, so the row is a label wrapping a
              // checkbox rather than a button -- but it wears the same kiosk
              // button sizing so the list reads as one set of targets.
              <label
                key={u.id}
                className={`tt-btn tt-btn--kiosk ${selectedIds.has(u.id) ? "tt-btn--primary" : "tt-btn--secondary"}`}
                style={{ justifyContent: "flex-start", gap: "var(--space-4)", cursor: "pointer" }}
              >
                <input
                  type="checkbox"
                  checked={selectedIds.has(u.id)}
                  onChange={() => toggleUnit(u.id)}
                  style={{ width: "26px", height: "26px", flexShrink: 0 }}
                />
                {u.name}
                {u.status === "monitor" && <Pill tone="warn">Monitor</Pill>}
              </label>
            ) : (
              <Button key={u.id} variant="primary" size="kiosk" onClick={() => selectUnit(u)} style={{ justifyContent: "flex-start" }}>
                {u.name}
                {u.status === "monitor" && <Pill tone="warn">Monitor</Pill>}
              </Button>
            )
          )}
        </div>

        {selectedType.documents.length > 0 && (
          <div style={{ marginTop: "var(--space-6)" }}>
            <PageHeader title="Health & safety" level={2} />
            {selectedType.documents.map((doc) => (
              <SafetyDocumentLink key={doc.id} doc={doc} variant="kiosk-button" />
            ))}
          </div>
        )}
        {multi && (
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
              onClick={() => selectedIds.size > 0 && setView("confirm")}
              disabled={selectedIds.size === 0}
              style={{ maxWidth: "592px", margin: "0 auto", display: "flex" }}
            >
              Continue{selectedIds.size > 0 ? ` (${selectedIds.size})` : ""}
            </Button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div style={{ padding: "var(--space-6)", maxWidth: "640px", margin: "0 auto" }}>
      <Button onClick={() => navigate("/kiosk")} icon={<IconArrowLeft size={16} />} style={{ marginBottom: "var(--space-5)" }}>
        Menu
      </Button>
      <PageHeader title="Check-out Kit" />
      {categories.length === 0 && <EmptyState title="No equipment types set up yet" />}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-4)" }}>
        {categories.map((c) => (
          <Button
            key={c.id}
            variant="primary"
            size="kiosk"
            onClick={() => openCategory(c)}
            // A category with nothing free is still worth opening -- the
            // Health & safety documents live behind it -- so it dims rather
            // than disabling.
            style={{ flexDirection: "column", gap: "var(--space-2)", opacity: c.availableCount === 0 ? 0.6 : 1 }}
          >
            <span>{c.name}</span>
            <span style={{ fontSize: "var(--text-base)", fontWeight: 400 }}>{c.availableCount} available</span>
          </Button>
        ))}
      </div>
    </div>
  );
}
