import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../lib/AuthContext.jsx";
import { usePermissions } from "../lib/permissions.js";
import { queryOpenKeyCheckouts, keyLocationLabel, keyIssuedToLabel, timeAgo, KEY_GROUPS } from "../lib/keysOutSummary.js";
import StatDial from "../components/StatDial.jsx";
import { colors, fonts } from "../lib/theme.js";
import { kioskButtonStyle, kioskSecondaryButtonStyle, kioskDangerButtonStyle, kioskCardStyle } from "../kiosk/kioskTheme.js";

const smallButtonStyle = { ...kioskSecondaryButtonStyle, flex: 1, padding: "14px 8px", fontSize: "14px" };

export default function KeyStationMenu() {
  const navigate = useNavigate();
  const { profile, activeSite, signOut } = useAuth();
  const permissions = usePermissions();
  const [openCheckouts, setOpenCheckouts] = useState(null); // null = loading
  const [detailGroup, setDetailGroup] = useState(null); // { label, rows } | null

  // Andy's ask: the same "keys currently out" visibility the main app's
  // Dashboard has, but on the key station itself, since staff mostly live
  // here rather than the desktop app -- as a row of dials (StatDial.jsx,
  // same component the Dashboard uses) rather than text, to make better
  // use of a kiosk screen's limited height, and tappable to drill into
  // which keys make up that count. A trusted contractor's own login
  // (profile.contractor_id set -- 43-contractor-linked-profiles.sql) gets
  // a narrower view scoped to just their own company instead of the full
  // org breakdown, which isn't their business to see.
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

  if (detailGroup) {
    return (
      <div style={{ padding: "24px", maxWidth: "640px", margin: "0 auto" }}>
        <button
          style={{ ...kioskSecondaryButtonStyle, width: "auto", padding: "10px 20px", fontSize: "16px", marginBottom: "20px" }}
          onClick={() => setDetailGroup(null)}
        >
          ← Back
        </button>
        <h1 style={{ fontFamily: fonts.display, color: colors.mossDark, fontSize: "26px", marginTop: 0 }}>{detailGroup.label}</h1>
        {detailGroup.rows.map((c) => (
          <div key={c.id} style={{ ...kioskCardStyle, marginBottom: "12px" }}>
            <p style={{ margin: "0 0 4px", fontSize: "17px", fontWeight: 600 }}>{keyLocationLabel(c)}</p>
            <p style={{ margin: "0 0 4px", fontSize: "15px" }}>Out to {keyIssuedToLabel(c)}</p>
            {c.reason && <p style={{ margin: "0 0 4px", fontSize: "15px", color: colors.inkSoft }}>Reason: {c.reason}</p>}
            <p style={{ margin: 0, fontSize: "13px", color: colors.inkSoft }}>
              Checked out by {c.checked_out_by_profile?.display_name || "—"}, {timeAgo(c.checked_out_at)}
            </p>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div style={{ padding: "32px", display: "flex", flexDirection: "column", minHeight: "100vh", boxSizing: "border-box" }}>
      <h1 style={{ fontFamily: fonts.display, color: colors.mossDark, fontSize: "28px", marginBottom: "4px" }}>
        Hi {profile?.display_name || "there"}
      </h1>
      <p style={{ color: colors.inkSoft, fontSize: "16px", marginTop: 0, marginBottom: "20px" }}>What do you need?</p>

      {openCheckouts !== null && (
        <div style={{ display: "flex", gap: "10px", marginBottom: "20px" }}>
          <div style={{ flex: 1 }}>
            <StatDial label="Yours" value={myCheckouts.length} onClick={() => openDetail("Yours", myCheckouts)} />
          </div>
          {profile?.contractor_id ? (
            <div style={{ flex: 1 }}>
              <StatDial label="Your company" value={myCompanyCheckouts.length} onClick={() => openDetail("Your company", myCompanyCheckouts)} />
            </div>
          ) : (
            KEY_GROUPS.map((g) => {
              const rows = openCheckouts.filter(g.match);
              return (
                <div key={g.key} style={{ flex: 1 }}>
                  <StatDial label={g.label} value={rows.length} onClick={() => openDetail(g.label, rows)} />
                </div>
              );
            })
          )}
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: "20px", flex: 1 }}>
        <button style={kioskButtonStyle} onClick={() => navigate("/keys/checkout")}>Check out a key</button>
        <button style={kioskButtonStyle} onClick={() => navigate("/keys/checkin")}>Check in a key</button>
        <div style={{ display: "flex", gap: "8px" }}>
          <button style={smallButtonStyle} onClick={() => navigate("/keys/find")}>Find a key</button>
          {permissions.has("can_manage_keys") && (
            <>
              <button style={smallButtonStyle} onClick={() => navigate("/keys/relocate")}>Relocate</button>
              <button style={smallButtonStyle} onClick={() => navigate("/keys/force-checkin")}>Force check-in</button>
            </>
          )}
        </div>
      </div>
      <button style={{ ...kioskDangerButtonStyle, marginTop: "20px" }} onClick={() => signOut()}>Sign out</button>
    </div>
  );
}
