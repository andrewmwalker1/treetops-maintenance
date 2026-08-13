import { useState } from "react";
import { NavLink } from "react-router-dom";
import { useAuth } from "../lib/AuthContext.jsx";
import { usePermissions } from "../lib/permissions.js";
import { colors, fonts, pageStyle } from "../lib/theme.js";
import { subscribeToPush, setDNDEnabled } from "../platform/notifications.js";
import { ViewAsPicker, ViewAsBanner } from "./ViewAsControl.jsx";

const navLinkStyle = ({ isActive }) => ({
  color: isActive ? colors.mossDark : colors.inkSoft,
  fontWeight: isActive ? 700 : 500,
  textDecoration: "none",
  fontFamily: fonts.body,
  padding: "8px 4px",
  borderBottom: isActive ? `2px solid ${colors.mossDark}` : "2px solid transparent",
});

export default function Layout({ children }) {
  const { profile, viewingAs, org, activeSite, signOut } = useAuth();
  const permissions = usePermissions();
  const [dnd, setDnd] = useState(Boolean(profile?.dnd_enabled));
  const [pushStatus, setPushStatus] = useState("idle"); // idle | subscribing | on | error

  async function handleDndToggle() {
    const next = !dnd;
    setDnd(next);
    try {
      await setDNDEnabled(next);
    } catch {
      setDnd(!next); // revert on failure
    }
  }

  async function handleEnablePush() {
    setPushStatus("subscribing");
    try {
      await subscribeToPush();
      setPushStatus("on");
    } catch (err) {
      console.error(err);
      setPushStatus("error");
    }
  }

  return (
    <div style={pageStyle}>
      <ViewAsBanner />
      <header
        style={{
          background: colors.paper,
          borderBottom: `1px solid ${colors.line}`,
          padding: "12px 20px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: "12px",
        }}
      >
        <div>
          <div style={{ fontFamily: fonts.display, fontWeight: 700, color: colors.mossDark, fontSize: "18px" }}>
            {org?.name || "Tree Tops Maintenance"}
          </div>
          {activeSite && (
            <div style={{ fontFamily: fonts.mono, fontSize: "12px", color: colors.inkSoft }}>{activeSite.name}</div>
          )}
        </div>
        <nav style={{ display: "flex", gap: "20px", alignItems: "center" }}>
          <NavLink to="/" end style={navLinkStyle}>Jobs</NavLink>
          <NavLink to="/equipment" style={navLinkStyle}>Equipment</NavLink>
          <NavLink to="/dashboard" style={navLinkStyle}>Dashboard</NavLink>
          <NavLink to="/safety" style={navLinkStyle}>Safety</NavLink>
          {(permissions.has("can_manage_reference_data") || permissions.has("can_manage_roles_and_permissions")) && (
            <NavLink to="/admin" style={navLinkStyle}>Admin</NavLink>
          )}
        </nav>
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <ViewAsPicker />
          {!viewingAs && (
            <>
              <label style={{ fontSize: "13px", color: colors.inkSoft, display: "flex", alignItems: "center", gap: "6px" }}>
                <input type="checkbox" checked={dnd} onChange={handleDndToggle} /> Do not disturb
              </label>
              {pushStatus !== "on" && (
                <button
                  onClick={handleEnablePush}
                  disabled={pushStatus === "subscribing"}
                  style={{ background: "transparent", border: `1px solid ${colors.lineStrong}`, borderRadius: "999px", padding: "6px 14px", cursor: "pointer", fontFamily: fonts.body, color: colors.inkSoft, fontSize: "13px" }}
                >
                  {pushStatus === "subscribing" ? "Enabling…" : "Enable notifications"}
                </button>
              )}
            </>
          )}
          <span style={{ fontSize: "14px", color: colors.ink }}>{profile?.display_name}</span>
          <button
            onClick={signOut}
            style={{
              background: "transparent",
              border: `1px solid ${colors.lineStrong}`,
              borderRadius: "999px",
              padding: "6px 14px",
              cursor: "pointer",
              fontFamily: fonts.body,
              color: colors.inkSoft,
            }}
          >
            Sign out
          </button>
        </div>
      </header>
      <main style={{ padding: "20px" }}>{children}</main>
      <footer style={{ padding: "10px 20px", textAlign: "center" }}>
        <span style={{ fontFamily: fonts.mono, fontSize: "11px", color: colors.inkSoft }}>
          v{__APP_VERSION__} · {__GIT_SHA__} · built {new Date(__BUILD_TIME__).toLocaleString()}
        </span>
      </footer>
    </div>
  );
}
