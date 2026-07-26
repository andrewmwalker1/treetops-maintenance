import { useState } from "react";
import { NavLink } from "react-router-dom";
import { useAuth } from "../lib/AuthContext.jsx";
import { colors, fonts, pageStyle } from "../lib/theme.js";
import { subscribeToPush, setDNDEnabled } from "../platform/notifications.js";

const navLinkStyle = ({ isActive }) => ({
  color: isActive ? colors.mossDark : colors.inkSoft,
  fontWeight: isActive ? 700 : 500,
  textDecoration: "none",
  fontFamily: fonts.body,
  padding: "8px 4px",
  borderBottom: isActive ? `2px solid ${colors.mossDark}` : "2px solid transparent",
});

export default function Layout({ children }) {
  const { profile, org, activeSite, signOut } = useAuth();
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
        </nav>
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
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
    </div>
  );
}
