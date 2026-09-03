import { useNavigate, useLocation } from "react-router-dom";
import { useKeyCheckout, OTHER_CONTRACTOR } from "../lib/useKeyCheckout.js";
import KeySelector, { locationLabel } from "../keys/KeySelector.jsx";
import { colors, fonts, cardStyle, buttonStyle } from "../lib/theme.js";

// Same key check-out logic as the key-cupboard kiosk (useKeyCheckout.js),
// so someone like Hazel can check out a pitch key from her own phone
// without needing to be stood at the cupboard -- matches CheckoutKit.jsx's
// relationship to KioskCheckOut.jsx. Styled for the normal app (theme.js,
// not the kiosk) since this lives inside Layout's ordinary chrome, not
// a full-screen kiosk takeover.
const listButtonStyle = {
  ...buttonStyle.secondary,
  width: "100%",
  textAlign: "left",
  padding: "14px 16px",
  fontSize: "15px",
};

const fieldStyle = {
  width: "100%",
  boxSizing: "border-box",
  padding: "10px 14px",
  borderRadius: "10px",
  border: `1px solid ${colors.lineStrong}`,
  fontFamily: fonts.body,
  fontSize: "15px",
  marginBottom: "12px",
};

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
      <div style={{ maxWidth: "560px" }}>
        <h1 style={{ fontFamily: fonts.display, color: colors.mossDark, marginTop: 0 }}>Checked out</h1>
        <p style={{ fontSize: "15px" }}>{locationLabel(selectedTag)} — logged.</p>
        <button style={buttonStyle.primary} onClick={() => navigate("/key-register")}>Done</button>
      </div>
    );
  }

  if (view === "confirm") {
    return (
      <div style={{ maxWidth: "560px" }}>
        <button style={{ ...buttonStyle.secondary, marginBottom: "16px" }} onClick={backToSelect}>
          ← Back
        </button>
        <h1 style={{ fontFamily: fonts.display, color: colors.mossDark, marginTop: 0 }}>{locationLabel(selectedTag)}</h1>

        <div style={{ ...cardStyle, padding: "16px", marginBottom: "16px" }}>
          {myContractor ? (
            <p style={{ margin: 0, fontSize: "15px" }}>
              Checking out for <strong>{myContractor.name}</strong>.
            </p>
          ) : (
            <>
              <p style={{ fontWeight: 600, marginTop: 0, marginBottom: "10px", fontSize: "14px" }}>Who's taking it?</p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", marginBottom: "6px" }}>
                {[
                  { value: "self", label: "Me" },
                  { value: "contractor", label: "Contractor" },
                  { value: "customer", label: "Customer" },
                  { value: "guest", label: "Guest" },
                ].map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setIssuedToKind(opt.value)}
                    style={{
                      ...buttonStyle.secondary,
                      padding: "8px 14px",
                      fontSize: "13px",
                      background: issuedToKind === opt.value ? colors.mossDark : "transparent",
                      color: issuedToKind === opt.value ? colors.onDark : colors.mossDark,
                    }}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>

              {issuedToKind === "contractor" && (
                <>
                  <select value={contractorChoice} onChange={(e) => setContractorChoice(e.target.value)} style={fieldStyle}>
                    <option value="">Select a contractor…</option>
                    {contractors.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                    <option value={OTHER_CONTRACTOR}>Other…</option>
                  </select>
                  {contractorChoice === OTHER_CONTRACTOR && (
                    <input
                      type="text"
                      value={contractorFreeText}
                      onChange={(e) => setContractorFreeText(e.target.value)}
                      placeholder="Contractor / company name"
                      style={fieldStyle}
                    />
                  )}
                </>
              )}

              {(issuedToKind === "customer" || issuedToKind === "guest") && (
                <input
                  type="text"
                  value={personName}
                  onChange={(e) => setPersonName(e.target.value)}
                  placeholder={issuedToKind === "guest" ? "Guest's name" : "Customer's name"}
                  style={fieldStyle}
                />
              )}

              {issuedToKind === "guest" && (
                <label style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "13px", color: colors.inkSoft }}>
                  <input type="checkbox" checked={guestConfirmed} onChange={(e) => setGuestConfirmed(e.target.checked)} style={{ width: "18px", height: "18px" }} />
                  Confirmed with the caravan owner
                </label>
              )}
            </>
          )}
        </div>

        <div style={{ ...cardStyle, padding: "16px", marginBottom: "16px" }}>
          <p style={{ fontWeight: 600, marginTop: 0, marginBottom: "10px", fontSize: "14px" }}>Reason</p>
          {reasonPresets.length > 0 && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", marginBottom: "10px" }}>
              {reasonPresets.map((r) => (
                <button
                  key={r.id}
                  onClick={() => setReason(r.label)}
                  style={{ ...buttonStyle.secondary, padding: "6px 12px", fontSize: "13px" }}
                >
                  {r.label}
                </button>
              ))}
            </div>
          )}
          <input type="text" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason for taking this key" style={fieldStyle} />
        </div>

        {error && (
          <Alert tone="danger" title="Something went wrong">
            {error}
          </Alert>
        )}

        <button style={{ ...buttonStyle.primary, width: "100%", opacity: canSubmit ? 1 : 0.5 }} onClick={handleSubmit} disabled={!canSubmit || submitting}>
          {submitting ? "Checking out…" : "Check out"}
        </button>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: "560px" }}>
      <button style={{ ...buttonStyle.secondary, marginBottom: "16px" }} onClick={() => navigate("/key-register")}>
        ← Keys
      </button>
      <h1 style={{ fontFamily: fonts.display, color: colors.mossDark, marginTop: 0 }}>Check out a key</h1>
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
