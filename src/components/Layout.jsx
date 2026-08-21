import { useEffect, useState } from "react";
import { NavLink } from "react-router-dom";
import { useAuth } from "../lib/AuthContext.jsx";
import { usePermissions } from "../lib/permissions.js";
import { colors, fonts, pageStyle } from "../lib/theme.js";
import { subscribeToPush, setDNDEnabled } from "../platform/notifications.js";
import { flushQueue, getQueueStatus } from "../platform/syncQueue.js";
import { useIsMobile } from "../lib/useIsMobile.js";
import { ViewAsPicker, ViewAsBanner } from "./ViewAsControl.jsx";

const navLinkStyle = ({ isActive }) => ({
  color: isActive ? colors.mossDark : colors.inkSoft,
  fontWeight: isActive ? 700 : 500,
  textDecoration: "none",
  fontFamily: fonts.body,
  padding: "8px 4px",
  borderBottom: isActive ? `2px solid ${colors.mossDark}` : "2px solid transparent",
});

const mobileNavLinkStyle = ({ isActive }) => ({
  display: "block",
  color: isActive ? colors.mossDark : colors.ink,
  fontWeight: isActive ? 700 : 500,
  textDecoration: "none",
  fontFamily: fonts.body,
  fontSize: "15px",
  padding: "10px 4px",
});

export default function Layout({ children }) {
  const { profile, viewingAs, org, activeSite, signOut } = useAuth();
  const permissions = usePermissions();
  const isMobile = useIsMobile();
  const [dnd, setDnd] = useState(Boolean(profile?.dnd_enabled));
  const [pushStatus, setPushStatus] = useState("idle"); // idle | subscribing | on | error
  const [queueStatus, setQueueStatus] = useState({ pendingCount: 0, online: navigator.onLine });

  // syncQueue.js documents flush-on-load and flush-on-reconnect as its
  // intended behaviour, but nothing previously called flushQueue() except
  // queueJob() itself right after queuing -- a job created offline that
  // never triggers another offline save would sit queued forever. Layout
  // mounts for the whole authenticated app, so this is the one place to
  // drive both the flush and the "N jobs queued" indicator below.
  useEffect(() => {
    let cancelled = false;
    function refreshStatus() {
      getQueueStatus().then((status) => {
        if (!cancelled) setQueueStatus(status);
      });
    }
    refreshStatus();
    flushQueue().then(refreshStatus);
    const interval = setInterval(refreshStatus, 5000);
    function handleOnline() {
      flushQueue().then(refreshStatus);
    }
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", refreshStatus);
    return () => {
      cancelled = true;
      clearInterval(interval);
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", refreshStatus);
    };
  }, []);

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

  // One list drives both the desktop nav row and the mobile dropdown
  // (NavMenu below), so the permission gating on Keys/Admin only needs to
  // be written once.
  const navItems = [
    { to: "/", label: "Jobs", end: true },
    { to: "/equipment", label: "Equipment" },
    { to: "/dashboard", label: "Dashboard" },
    { to: "/safety", label: "Safety" },
    ...(permissions.has("can_use_key_system") ? [{ to: "/key-register", label: "Keys" }] : []),
    ...(permissions.has("can_manage_reference_data") || permissions.has("can_manage_roles_and_permissions")
      ? [{ to: "/admin", label: "Admin" }]
      : []),
  ];

  return (
    <div style={{ ...pageStyle, height: "100vh", display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <div style={{ flexShrink: 0 }}>
        <ViewAsBanner />
      </div>
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
          flexShrink: 0,
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
        {isMobile ? (
          <NavMenu items={navItems} />
        ) : (
          <nav style={{ display: "flex", gap: "20px", alignItems: "center" }}>
            {navItems.map((item) => (
              <NavLink key={item.to} to={item.to} end={item.end} style={navLinkStyle}>{item.label}</NavLink>
            ))}
          </nav>
        )}
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          {queueStatus.pendingCount > 0 && (
            <span
              style={{
                fontSize: "12px",
                fontWeight: 600,
                color: "#fff",
                background: queueStatus.online ? colors.gold : colors.clay,
                borderRadius: "999px",
                padding: "5px 12px",
              }}
            >
              {queueStatus.online
                ? `Syncing ${queueStatus.pendingCount} job${queueStatus.pendingCount === 1 ? "" : "s"}…`
                : `${queueStatus.pendingCount} job${queueStatus.pendingCount === 1 ? "" : "s"} queued — offline`}
            </span>
          )}
          <ViewAsPicker />
          {isMobile ? (
            <AccountMenu
              displayName={profile?.display_name}
              showControls={!viewingAs}
              dnd={dnd}
              onToggleDnd={handleDndToggle}
              pushStatus={pushStatus}
              onEnablePush={handleEnablePush}
              onSignOut={signOut}
            />
          ) : (
            <>
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
            </>
          )}
        </div>
      </header>
      {/* Horizontal padding only shrinks on mobile -- vertical stays 20px
          either way since JobsList's sticky filter header does its own
          -20px/-20px/20px offset math keyed to that exact value (see its
          own comment). A narrow phone can't spare 20px on each side just
          for margin -- e.g. the job checklist's item-description text
          needs that width more than the page needs symmetrical padding. */}
      <main style={{ flex: 1, overflowY: "auto", padding: isMobile ? "20px 8px" : "20px" }}>{children}</main>
      <footer style={{ flexShrink: 0, padding: "10px 20px", textAlign: "center" }}>
        <span style={{ fontFamily: fonts.mono, fontSize: "11px", color: colors.inkSoft }}>
          v{__APP_VERSION__} · {__GIT_SHA__} · built {new Date(__BUILD_TIME__).toLocaleString()}
        </span>
      </footer>
    </div>
  );
}

// Collapses the Jobs/Equipment/Dashboard/Safety/Keys/Admin row into a
// single "Menu" button on narrow screens -- same reasoning as AccountMenu
// below (that inline row wrapping onto its own line ate a full extra row
// of a mobile viewport), and the same open/backdrop/dropdown shape, just
// listing nav links instead of account controls.
function NavMenu({ items }) {
  const [open, setOpen] = useState(false);

  return (
    <div style={{ position: "relative" }}>
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label="Menu"
        style={{
          border: `1px solid ${colors.lineStrong}`,
          borderRadius: "999px",
          background: "transparent",
          padding: "8px 14px",
          cursor: "pointer",
          fontFamily: fonts.body,
          fontSize: "14px",
          color: colors.mossDark,
          display: "flex",
          alignItems: "center",
          gap: "6px",
        }}
      >
        <span aria-hidden="true">☰</span> Menu
      </button>
      {open && (
        <>
          <div onClick={() => setOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 15 }} />
          <div
            style={{
              position: "absolute",
              left: 0,
              top: "42px",
              background: colors.paper,
              border: `1px solid ${colors.line}`,
              borderRadius: "12px",
              padding: "8px",
              minWidth: "180px",
              boxShadow: "0 8px 24px rgba(0,0,0,0.18)",
              zIndex: 20,
              display: "flex",
              flexDirection: "column",
            }}
          >
            {items.map((item) => (
              <NavLink key={item.to} to={item.to} end={item.end} style={mobileNavLinkStyle} onClick={() => setOpen(false)}>
                {item.label}
              </NavLink>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// Collapses the DND toggle / push-notification button / display name /
// sign-out row into a single avatar button on narrow screens -- that
// row wrapping onto its own line was eating a full extra row of a
// mobile viewport above the actual job list.
function AccountMenu({ displayName, showControls, dnd, onToggleDnd, pushStatus, onEnablePush, onSignOut }) {
  const [open, setOpen] = useState(false);

  return (
    <div style={{ position: "relative" }}>
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label="Account menu"
        style={{
          width: "34px",
          height: "34px",
          borderRadius: "999px",
          border: `1px solid ${colors.lineStrong}`,
          background: "transparent",
          cursor: "pointer",
          fontFamily: fonts.body,
          fontWeight: 700,
          color: colors.mossDark,
          flexShrink: 0,
        }}
      >
        {displayName?.charAt(0)?.toUpperCase() || "?"}
      </button>
      {open && (
        <>
          {/* Full-screen invisible backdrop, not a blur/tint -- just
              somewhere to click that closes the menu. */}
          <div onClick={() => setOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 15 }} />
          <div
            style={{
              position: "absolute",
              right: 0,
              top: "42px",
              background: colors.paper,
              border: `1px solid ${colors.line}`,
              borderRadius: "12px",
              padding: "12px",
              minWidth: "220px",
              boxShadow: "0 8px 24px rgba(0,0,0,0.18)",
              zIndex: 20,
              display: "flex",
              flexDirection: "column",
              gap: "10px",
            }}
          >
            <span style={{ fontSize: "14px", fontWeight: 600, color: colors.ink }}>{displayName}</span>
            {showControls && (
              <>
                <label style={{ fontSize: "13px", color: colors.inkSoft, display: "flex", alignItems: "center", gap: "6px" }}>
                  <input type="checkbox" checked={dnd} onChange={onToggleDnd} /> Do not disturb
                </label>
                {pushStatus !== "on" && (
                  <button
                    onClick={onEnablePush}
                    disabled={pushStatus === "subscribing"}
                    style={{ background: "transparent", border: `1px solid ${colors.lineStrong}`, borderRadius: "999px", padding: "6px 14px", cursor: "pointer", fontFamily: fonts.body, color: colors.inkSoft, fontSize: "13px", textAlign: "left" }}
                  >
                    {pushStatus === "subscribing" ? "Enabling…" : "Enable notifications"}
                  </button>
                )}
              </>
            )}
            <button
              onClick={onSignOut}
              style={{
                background: "transparent",
                border: `1px solid ${colors.lineStrong}`,
                borderRadius: "999px",
                padding: "6px 14px",
                cursor: "pointer",
                fontFamily: fonts.body,
                color: colors.inkSoft,
                textAlign: "left",
              }}
            >
              Sign out
            </button>
          </div>
        </>
      )}
    </div>
  );
}
