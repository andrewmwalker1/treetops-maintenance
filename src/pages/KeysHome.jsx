import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../lib/AuthContext.jsx";
import { supabase } from "../lib/supabaseClient.js";
import { usePermissions } from "../lib/permissions.js";
import { queryOpenKeyCheckouts, keyLocationLabel, keyIssuedToLabel, timeAgo, KEY_GROUPS } from "../lib/keysOutSummary.js";
import RfidScanListener from "../components/RfidScanListener.jsx";
import StatDial from "../components/StatDial.jsx";
import { colors, fonts, cardStyle, buttonStyle } from "../lib/theme.js";

// The in-app landing for the "Keys" nav link -- lives at /key-register
// rather than /keys because App.jsx's isKeyStation check treats any
// /keys/* path as the physical key-cupboard kiosk and would hijack this
// into a full-screen takeover. Mirrors KeyStationMenu.jsx in full (Andy's
// ask, 2026-08-25): the same "keys currently out" dashboard row (yours /
// your company if a contractor, otherwise the staff/contractors/customers
// breakdown, tap to drill in), and Relocate/Force check-in alongside
// check-out/check-in/find, gated the same way -- can_manage_keys, not just
// can_use_key_system (already enforced one level up by KeysGate).
const listButtonStyle = {
  ...buttonStyle.secondary,
  width: "100%",
  textAlign: "left",
  padding: "14px 16px",
  fontSize: "15px",
};

export default function KeysHome() {
  const navigate = useNavigate();
  const { profile, activeSite } = useAuth();
  const permissions = usePermissions();
  const [openCheckouts, setOpenCheckouts] = useState(null); // null = loading
  const [detailGroup, setDetailGroup] = useState(null); // { label, rows } | null
  const [scanError, setScanError] = useState(null);

  useEffect(() => {
    if (!activeSite) return;
    queryOpenKeyCheckouts(activeSite.id).then(setOpenCheckouts);
  }, [activeSite]);

  const myCheckouts = (openCheckouts || []).filter((c) => c.checked_out_by_profile?.id === profile?.id);
  const myCompanyCheckouts = profile?.contractor_id
    ? (openCheckouts || []).filter((c) => c.issued_to_contractor?.id === profile.contractor_id)
    : [];

  function openDetail(label, rows) {
    if (rows.length === 0) return;
    setDetailGroup({ label, rows });
  }

  // Same scan-to-the-right-screen shortcut as KeyStationMenu.jsx's
  // handleScan -- staff on their own phone (not necessarily stood at the
  // cupboard, but a fob reader could still be attached) get the same
  // "scan it, go straight to check-out/check-in" behaviour.
  async function handleScan(uid) {
    setScanError(null);
    const { data: tag, error: err } = await supabase
      .from("key_tags")
      .select("id, status, pitch_id, special_location_id")
      .eq("site_id", activeSite.id)
      .eq("tag_uid", uid)
      .maybeSingle();
    if (err) {
      setScanError(err.message);
      return;
    }
    if (!tag) {
      setScanError("That tag isn't registered here.");
      return;
    }
    if (tag.status !== "active") {
      setScanError(tag.status === "lost" ? "This tag is marked lost." : "This key has already been handed over to its owner.");
      return;
    }
    if (!tag.pitch_id && !tag.special_location_id) {
      setScanError("This tag isn't allocated to a pitch yet — see Admin ▸ Key Tags.");
      return;
    }
    const { data: openCheckout, error: coErr } = await supabase
      .from("key_checkouts")
      .select("id")
      .eq("key_tag_id", tag.id)
      .is("checked_in_at", null)
      .maybeSingle();
    if (coErr) {
      setScanError(coErr.message);
      return;
    }
    navigate(openCheckout ? "/key-register/checkin" : "/key-register/checkout", { state: { presetTagId: tag.id } });
  }

  if (detailGroup) {
    return (
      <div style={{ maxWidth: "560px" }}>
        <button style={{ ...buttonStyle.secondary, marginBottom: "16px" }} onClick={() => setDetailGroup(null)}>
          ← Back
        </button>
        <h1 style={{ fontFamily: fonts.display, color: colors.mossDark, marginTop: 0 }}>{detailGroup.label}</h1>
        {detailGroup.rows.map((c) => (
          <div key={c.id} style={{ ...cardStyle, padding: "14px 16px", marginBottom: "10px" }}>
            <p style={{ margin: "0 0 4px", fontSize: "15px", fontWeight: 600 }}>{keyLocationLabel(c)}</p>
            <p style={{ margin: "0 0 4px", fontSize: "14px" }}>Out to {keyIssuedToLabel(c)}</p>
            {c.reason && <p style={{ margin: "0 0 4px", fontSize: "14px", color: colors.inkSoft }}>Reason: {c.reason}</p>}
            <p style={{ margin: 0, fontSize: "12px", color: colors.inkSoft }}>
              Checked out by {c.checked_out_by_profile?.display_name || "—"}, {timeAgo(c.checked_out_at)}
            </p>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div style={{ maxWidth: "560px" }}>
      <RfidScanListener onScan={handleScan} />
      <h1 style={{ fontFamily: fonts.display, color: colors.mossDark, marginTop: 0 }}>Keys</h1>
      <p style={{ color: colors.inkSoft, fontSize: "14px", marginTop: "-8px" }}>
        Scan a key (if a reader's attached) to check it out or in, or pick what you need below.
      </p>
      {scanError && <p style={{ color: colors.immediate, fontSize: "14px" }}>{scanError}</p>}

      {openCheckouts !== null && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: "10px", marginBottom: "18px" }}>
          <StatDial label="Yours" value={myCheckouts.length} onClick={() => openDetail("Yours", myCheckouts)} />
          {profile?.contractor_id ? (
            <StatDial label="Your company" value={myCompanyCheckouts.length} onClick={() => openDetail("Your company", myCompanyCheckouts)} />
          ) : (
            KEY_GROUPS.map((g) => {
              const rows = openCheckouts.filter(g.match);
              return <StatDial key={g.key} label={g.label} value={rows.length} onClick={() => openDetail(g.label, rows)} />;
            })
          )}
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
        <Link to="/key-register/checkout" style={{ ...buttonStyle.primary, textDecoration: "none", textAlign: "center" }}>
          Check out a key
        </Link>
        <Link to="/key-register/checkin" style={{ ...buttonStyle.primary, textDecoration: "none", textAlign: "center" }}>
          Check in a key
        </Link>
        <Link to="/key-register/find" style={listButtonStyle}>
          Find a key
        </Link>
        {permissions.has("can_manage_keys") && (
          <>
            <Link to="/key-register/relocate" style={listButtonStyle}>
              Relocate a key
            </Link>
            <Link to="/key-register/force-checkin" style={listButtonStyle}>
              Force check-in
            </Link>
            <Link to="/key-register/handover" style={listButtonStyle}>
              Handover a key
            </Link>
          </>
        )}
      </div>
    </div>
  );
}
