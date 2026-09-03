import { useNavigate } from "react-router-dom";
import { useEquipmentCheckout } from "../lib/useEquipmentCheckout.js";
import ChecklistBuilder from "../components/ChecklistBuilder.jsx";
import ReportIssueForm from "../kiosk/ReportIssueForm.jsx";
import SafetyDocumentLink from "../components/SafetyDocumentLink.jsx";
import { colors, fonts, cardStyle, buttonStyle } from "../lib/theme.js";

// Same equipment check-out logic as the workshop kiosk (useEquipmentCheckout.js),
// so someone like Hazel can check out a strimmer from her own phone without
// needing to be stood at the kiosk terminal -- no permission gate here
// either, matching the kiosk (equipment checkout has never been role-gated,
// unlike keys). Styled for the normal app rather than the kiosk
// since this lives inside Layout's ordinary chrome, not a full-screen
// kiosk takeover.
const listButtonStyle = {
  ...buttonStyle.secondary,
  width: "100%",
  textAlign: "left",
  padding: "14px 16px",
  fontSize: "15px",
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
};

const hoursFieldStyle = {
  width: "100%",
  boxSizing: "border-box",
  padding: "10px 12px",
  borderRadius: "8px",
  border: `1px solid ${colors.lineStrong}`,
  fontFamily: fonts.body,
  fontSize: "16px", // 16px+ keeps iOS Safari from auto-zooming into the field
};

const monitorBadgeStyle = {
  fontSize: "11px",
  fontWeight: 700,
  color: colors.gold,
  border: `1px solid ${colors.gold}`,
  borderRadius: "999px",
  padding: "1px 8px",
  flexShrink: 0,
};

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
        <h1 style={{ fontFamily: fonts.display, color: colors.mossDark, marginTop: 0 }}>Check-out results</h1>

        {checkoutOutcome.succeeded.length > 0 && (
          <div style={{ ...cardStyle, padding: "16px", marginBottom: "14px" }}>
            <PageHeader title="Checked out" level={2} />
            {checkoutOutcome.succeeded.map((u) => (
              <p key={u.id} style={{ fontSize: "15px", margin: "6px 0" }}>{u.name}</p>
            ))}
          </div>
        )}

        {checkoutOutcome.failed.length > 0 && (
          <div style={{ ...cardStyle, padding: "16px", marginBottom: "20px", border: `2px solid ${colors.immediate}` }}>
            <h2 style={{ fontFamily: fonts.display, fontSize: "16px", color: colors.immediate, marginTop: 0 }}>Not checked out</h2>
            {checkoutOutcome.failed.map((f) => (
              <p key={f.unit?.id || f.message} style={{ fontSize: "15px", margin: "6px 0" }}>
                {f.unit?.name || "Unit"} — {f.message}
              </p>
            ))}
          </div>
        )}

        <button style={buttonStyle.primary} onClick={() => navigate("/")}>Done</button>
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
        <button style={{ ...buttonStyle.secondary, marginBottom: "16px" }} onClick={() => setView("units")}>
          ← Back
        </button>
        <h1 style={{ fontFamily: fonts.display, color: colors.mossDark, marginTop: 0 }}>{selectedType.name}</h1>

        {selectedType.preUseChecklist.length > 0 && (
          <div style={{ ...cardStyle, padding: "16px", marginBottom: "16px" }}>
            <PageHeader title="Before you take it" level={2} />
            <ChecklistBuilder items={selectedType.preUseChecklist} onChange={() => {}} readOnly />
          </div>
        )}

        {/* Separate from the pre-use checklist above rather than merged into
            it -- the checklist is fixed per equipment type, this is a note
            specific to this one unit right now. Same review step, own card. */}
        {selected.some((u) => u.status === "monitor") && (
          <div style={{ ...cardStyle, padding: "16px", marginBottom: "16px", background: colors.warnSurface, border: `1px solid ${colors.warnBorder}` }}>
            <h2 style={{ fontFamily: fonts.display, fontSize: "15px", color: colors.gold, marginTop: 0 }}>Being monitored</h2>
            {selected
              .filter((u) => u.status === "monitor")
              .map((u) => (
                <p key={u.id} style={{ fontSize: "14px", margin: "0 0 8px" }}>
                  {selected.length > 1 && <strong>{u.name}: </strong>}
                  {u.monitor_note}
                </p>
              ))}
          </div>
        )}

        {hoursUnits.length > 0 && (
          <div style={{ ...cardStyle, padding: "16px", marginBottom: "16px" }}>
            <PageHeader title="Hours reading" level={2} />
            {hoursUnits.map((u) => {
              const raw = hoursByUnitId[u.id] ?? "";
              const value = raw === "" ? null : Number(raw);
              const tooLow = value !== null && u.last_hours_reading != null && value < u.last_hours_reading;
              return (
                <div key={u.id} style={{ marginBottom: "12px" }}>
                  {hoursUnits.length > 1 && <p style={{ fontWeight: 600, fontSize: "14px", margin: "0 0 4px" }}>{u.name}</p>}
                  <p style={{ fontSize: "13px", color: colors.inkSoft, margin: "0 0 6px" }}>
                    {u.last_hours_reading != null
                      ? `Last reading: ${u.last_hours_reading} hrs (${new Date(u.last_hours_reading_at).toLocaleDateString("en-GB")})`
                      : "No previous reading on file"}
                  </p>
                  <input
                    type="number"
                    inputMode="decimal"
                    value={raw}
                    onChange={(e) => setUnitHours(u.id, e.target.value)}
                    placeholder={u.hoursRequired ? "Hours (required)" : "Hours (optional)"}
                    style={hoursFieldStyle}
                  />
                  {tooLow && (
                    <p style={{ color: colors.immediate, fontSize: "12px", margin: "4px 0 0" }}>
                      Can't be less than the last reading ({u.last_hours_reading} hrs)
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {error && (
          <Alert tone="danger" title="Something went wrong">
            {error}
          </Alert>
        )}

        {reportingUnit ? (
          <>
            <p style={{ fontSize: "14px", color: colors.inkSoft }}>
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
              <div style={{ ...cardStyle, padding: "16px", marginBottom: "16px" }}>
                <PageHeader title="Taking {selected.length}" level={2} />
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
                    <span style={{ fontSize: "15px" }}>{u.name}</span>
                    <button
                      onClick={() => setReportingIssueFor(u.id)}
                      disabled={busy}
                      style={{ background: "none", border: "none", color: colors.immediate, fontSize: "13px", textDecoration: "underline", cursor: "pointer" }}
                    >
                      Report issue
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              <button
                style={{ ...buttonStyle.primary, opacity: hoursOk ? 1 : 0.5 }}
                onClick={() => handleCheckOut(() => navigate("/"))}
                disabled={busy || !hoursOk}
              >
                {busy ? "Checking out…" : selected.length > 1 ? `Check out selected (${selected.length})` : "Check out"}
              </button>
              {selected.length === 1 && (
                <button
                  style={{ ...buttonStyle.secondary, color: colors.immediate, borderColor: colors.immediate }}
                  onClick={() => setReportingIssueFor(selected[0].id)}
                  disabled={busy}
                >
                  Report an issue
                </button>
              )}
              <button style={buttonStyle.secondary} onClick={() => setView("units")} disabled={busy}>
                Cancel
              </button>
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
        <button style={{ ...buttonStyle.secondary, marginBottom: "16px" }} onClick={backToCategories}>
          ← Kit
        </button>
        <h1 style={{ fontFamily: fonts.display, color: colors.mossDark, marginTop: 0 }}>{selectedType.name}</h1>
        {multi && units.length > 0 && (
          <p style={{ color: colors.inkSoft, fontSize: "14px", marginTop: "-4px" }}>Tick everything you need, then continue.</p>
        )}
        {units.length === 0 && <p style={{ color: colors.inkSoft }}>Nothing available right now.</p>}
        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          {units.map((u) =>
            multi ? (
              <label
                key={u.id}
                style={{
                  ...listButtonStyle,
                  background: selectedIds.has(u.id) ? colors.mossDark : "transparent",
                  color: selectedIds.has(u.id) ? colors.onDark : colors.mossDark,
                  cursor: "pointer",
                }}
              >
                <span style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                  <input
                    type="checkbox"
                    checked={selectedIds.has(u.id)}
                    onChange={() => toggleUnit(u.id)}
                    style={{ width: "20px", height: "20px", flexShrink: 0 }}
                  />
                  {u.name}
                  {u.status === "monitor" && <span style={monitorBadgeStyle}>Monitor</span>}
                </span>
              </label>
            ) : (
              <button key={u.id} style={listButtonStyle} onClick={() => selectUnit(u)}>
                <span style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  {u.name}
                  {u.status === "monitor" && <span style={monitorBadgeStyle}>Monitor</span>}
                </span>
              </button>
            )
          )}
        </div>

        {selectedType.documents.length > 0 && (
          <div style={{ marginTop: "20px" }}>
            <h2 style={{ fontFamily: fonts.display, fontSize: "15px", color: colors.mossDark, marginBottom: "8px" }}>Health &amp; Safety</h2>
            {selectedType.documents.map((doc) => (
              <SafetyDocumentLink key={doc.id} doc={doc} variant="button" />
            ))}
          </div>
        )}

        {multi && (
          <button
            style={{ ...buttonStyle.primary, width: "100%", marginTop: "16px", opacity: selectedIds.size === 0 ? 0.5 : 1 }}
            onClick={() => selectedIds.size > 0 && setView("confirm")}
            disabled={selectedIds.size === 0}
          >
            Continue{selectedIds.size > 0 ? ` (${selectedIds.size})` : ""}
          </button>
        )}
      </div>
    );
  }

  return (
    <div style={{ maxWidth: "560px" }}>
      <h1 style={{ fontFamily: fonts.display, color: colors.mossDark, marginTop: 0 }}>Checkout kit</h1>
      {categories.length === 0 && <p style={{ color: colors.inkSoft }}>No equipment types set up yet.</p>}
      <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
        {categories.map((c) => (
          <button
            key={c.id}
            onClick={() => openCategory(c)}
            style={{ ...listButtonStyle, opacity: c.availableCount === 0 ? 0.6 : 1 }}
          >
            <span>{c.name}</span>
            <span style={{ fontSize: "13px", color: colors.inkSoft }}>{c.availableCount} available</span>
          </button>
        ))}
      </div>
    </div>
  );
}
