import { useEffect, useState } from "react";
import { NavLink } from "react-router-dom";
import { useAuth } from "../lib/AuthContext.jsx";
import { usePermissions } from "../lib/permissions.js";
import { colors, fonts, pageStyle } from "../lib/theme.js";
import { subscribeToPush, setDNDEnabled } from "../platform/notifications.js";
import { flushQueue, getQueueStatus, flushReadingQueue, getReadingQueueStatus } from "../platform/syncQueue.js";
import { useIsMobile } from "../lib/useIsMobile.js";
import { ViewAsPicker, ViewAsBanner } from "./ViewAsControl.jsx";
import Menu, { MenuHeader, MenuItem, MenuSeparator } from "../ui/Menu.jsx";
import { Switch } from "../ui/primitives.jsx";
import {
  IconEquipment,
  IconJobs,
  IconKeys,
  IconMeters,
  IconOffline,
  IconOverview,
  IconSafety,
  IconSync,
} from "../ui/icons.jsx";
import "./Layout.css";

// Initials for the avatar and the app mark. Two words gives "AW"; one
// gives "A".
function initials(name) {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] || "") + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase() || "?";
}

export default function Layout({ children }) {
  const { profile, viewingAs, org, activeSite, signOut } = useAuth();
  const permissions = usePermissions();
  const isMobile = useIsMobile();
  const [dnd, setDnd] = useState(Boolean(profile?.dnd_enabled));
  const [pushStatus, setPushStatus] = useState("idle"); // idle | subscribing | on | error
  const [queueStatus, setQueueStatus] = useState({ pendingCount: 0, online: navigator.onLine });
  const [readingQueueStatus, setReadingQueueStatus] = useState({ pendingCount: 0, online: navigator.onLine });

  // syncQueue.js documents flush-on-load and flush-on-reconnect as its
  // intended behaviour, but nothing previously called flushQueue() except
  // queueJob() itself right after queuing -- a job created offline that
  // never triggers another offline save would sit queued forever. Layout
  // mounts for the whole authenticated app, so this is the one place to
  // drive both the flush and the queued-work indicator below.
  useEffect(() => {
    let cancelled = false;
    function refreshStatus() {
      getQueueStatus().then((status) => {
        if (!cancelled) setQueueStatus(status);
      });
      getReadingQueueStatus().then((status) => {
        if (!cancelled) setReadingQueueStatus(status);
      });
    }
    refreshStatus();
    flushQueue().then(refreshStatus);
    flushReadingQueue().then(refreshStatus);
    const interval = setInterval(refreshStatus, 5000);
    function handleOnline() {
      flushQueue().then(refreshStatus);
      flushReadingQueue().then(refreshStatus);
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

  async function handleDndToggle(next) {
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

  // One list drives the desktop nav row, the mobile tab bar and the
  // overflow in the account menu, so the permission gating is written once.
  //
  // `tabBar` marks the destinations that earn a slot on a phone's bottom
  // bar. Dashboard is deliberately not one: it is a manager's summary
  // rather than somewhere anyone works, and five tabs is the most a phone
  // can carry before the labels stop being readable. It stays one tap away
  // in the account menu, and keeps its place in the desktop nav.
  const navItems = [
    { to: "/", label: "Jobs", end: true, Icon: IconJobs, tabBar: true },
    { to: "/dashboard", label: "Dashboard", Icon: IconOverview, tabBar: false },
    { to: "/equipment", label: "Equipment", shortLabel: "Kit", Icon: IconEquipment, tabBar: true },
    ...(permissions.has("can_use_key_system")
      ? [{ to: "/key-register", label: "Keys", Icon: IconKeys, tabBar: true }]
      : []),
    { to: "/meter-reading", label: "Meters", Icon: IconMeters, tabBar: true },
    { to: "/safety", label: "Safety", Icon: IconSafety, tabBar: true },
  ];

  const canSeeAdmin =
    permissions.has("can_manage_reference_data") || permissions.has("can_manage_roles_and_permissions");

  const tabBarItems = isMobile ? navItems.filter((i) => i.tabBar).slice(0, 5) : [];
  const inTabBar = new Set(tabBarItems.map((i) => i.to));
  // Anything the current surface can't show gets a row in the account menu,
  // so no destination is ever unreachable however the nav is arranged.
  const overflowItems = isMobile ? navItems.filter((i) => !inTabBar.has(i.to)) : [];

  return (
    <div style={{ ...pageStyle, height: "100vh", display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <div style={{ flexShrink: 0 }}>
        <ViewAsBanner />
      </div>

      <header className={`tt-appbar${isMobile ? " tt-appbar--mobile" : ""}`}>
        <div className="tt-appbar__identity">
          <span className="tt-appbar__mark" aria-hidden="true">
            {initials(org?.name || "Tree Tops")}
          </span>
          <div style={{ minWidth: 0 }}>
            <div className="tt-appbar__org">{org?.name || "Tree Tops Maintenance"}</div>
            {activeSite && <div className="tt-appbar__site">{activeSite.name}</div>}
          </div>
        </div>

        {!isMobile && (
          <nav className="tt-appbar__nav" aria-label="Main">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) => `tt-navlink${isActive ? " tt-navlink--active" : ""}`}
              >
                <item.Icon size={15} />
                {item.label}
              </NavLink>
            ))}
          </nav>
        )}

        <div className="tt-appbar__right">
          <SyncStatus jobs={queueStatus} readings={readingQueueStatus} />
          <ViewAsPicker />
          <AccountMenu
            displayName={profile?.display_name}
            roleName={profile?.roles?.name}
            showControls={!viewingAs}
            dnd={dnd}
            onToggleDnd={handleDndToggle}
            pushStatus={pushStatus}
            onEnablePush={handleEnablePush}
            onSignOut={signOut}
            canSeeAdmin={canSeeAdmin}
            overflowItems={overflowItems}
            showVersion={isMobile}
          />
        </div>
      </header>

      <main className={`tt-main${isMobile ? " tt-main--mobile" : ""}`}>{children}</main>

      {isMobile && (
        <nav className="tt-tabbar" aria-label="Main">
          {tabBarItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) => `tt-tab${isActive ? " tt-tab--active" : ""}`}
            >
              <item.Icon size={19} />
              <span className="tt-tab__label">{item.shortLabel || item.label}</span>
            </NavLink>
          ))}
        </nav>
      )}

      {!isMobile && (
        <footer className="tt-appfoot">
          v{__APP_VERSION__} · {__GIT_SHA__} · built {new Date(__BUILD_TIME__).toLocaleString()}
        </footer>
      )}
    </div>
  );
}

// One chip for both queues, replacing the two separate pills that each
// appeared and disappeared independently and shoved the rest of the header
// sideways as they did. Click it for the breakdown.
function SyncStatus({ jobs, readings }) {
  const pending = jobs.pendingCount + readings.pendingCount;
  const online = jobs.online && readings.online;
  if (pending === 0 && online) return null;

  const offline = !online;
  const label = offline ? (pending > 0 ? `${pending} queued` : "Offline") : `Syncing ${pending}`;

  return (
    <Menu
      align="right"
      trigger={(p) => (
        <button type="button" className={`tt-statuschip tt-statuschip--${offline ? "offline" : "syncing"}`} {...p}>
          {offline ? <IconOffline size={13} /> : <IconSync size={13} />}
          <span className="tt-statuschip__label">{label}</span>
        </button>
      )}
    >
      <MenuHeader>
        <div style={{ fontSize: "var(--text-sm)", fontWeight: 600 }}>{offline ? "You're offline" : "Syncing"}</div>
        <div className="tt-menu__meta">
          {offline
            ? "Work is saved on this device and sends when you're back on signal."
            : "Sending queued work to the server."}
        </div>
      </MenuHeader>
      <div className="tt-menu__item" style={{ cursor: "default" }}>
        <span>Jobs</span>
        <span className="tt-menu__meta">{jobs.pendingCount === 0 ? "Up to date" : `${jobs.pendingCount} queued`}</span>
      </div>
      <div className="tt-menu__item" style={{ cursor: "default" }}>
        <span>Meter readings</span>
        <span className="tt-menu__meta">
          {readings.pendingCount === 0 ? "Up to date" : `${readings.pendingCount} queued`}
        </span>
      </div>
    </Menu>
  );
}

// Holds everything that is about *you* rather than about the work: your
// name, Do not disturb, notifications, admin, sign out -- and on a phone,
// the destinations the bottom tab bar has no room for.
//
// On desktop these controls used to sit loose in the header row, including
// a raw <input type="checkbox"> next to pill buttons. They were already in
// a menu on mobile; this makes desktop match, rather than the reverse.
function AccountMenu({
  displayName,
  roleName,
  showControls,
  dnd,
  onToggleDnd,
  pushStatus,
  onEnablePush,
  onSignOut,
  canSeeAdmin,
  overflowItems,
  showVersion,
}) {
  return (
    <Menu
      align="right"
      trigger={(p) => (
        <button type="button" className="tt-avatar" aria-label="Account and settings" {...p}>
          {initials(displayName)}
        </button>
      )}
    >
      {({ close }) => (
        <>
          <MenuHeader>
            <div style={{ fontSize: "var(--text-sm)", fontWeight: 600 }}>{displayName || "Signed in"}</div>
            {roleName && (
              <div className="tt-menu__meta" style={{ fontFamily: "var(--font-mono)", textTransform: "uppercase" }}>
                {roleName}
              </div>
            )}
          </MenuHeader>

          {overflowItems.length > 0 && (
            <>
              {overflowItems.map((item) => (
                <MenuItem key={item.to} as={NavLink} to={item.to} end={item.end} onSelect={close}>
                  {item.label}
                </MenuItem>
              ))}
              <MenuSeparator />
            </>
          )}

          {showControls && (
            <>
              <MenuItem
                as="div"
                meta={<Switch checked={dnd} onChange={onToggleDnd} label="Do not disturb" />}
                style={{ cursor: "default" }}
              >
                Do not disturb
              </MenuItem>
              <MenuItem
                onSelect={pushStatus === "on" ? undefined : onEnablePush}
                disabled={pushStatus === "subscribing" || pushStatus === "on"}
                meta={
                  pushStatus === "on"
                    ? "On"
                    : pushStatus === "subscribing"
                    ? "Turning on…"
                    : pushStatus === "error"
                    ? "Failed"
                    : "Off"
                }
              >
                Notifications
              </MenuItem>
            </>
          )}

          {canSeeAdmin && (
            <>
              <MenuSeparator />
              <MenuItem as={NavLink} to="/admin" onSelect={close}>
                Settings &amp; admin
              </MenuItem>
            </>
          )}

          <MenuSeparator />
          <MenuItem danger onSelect={onSignOut}>
            Sign out
          </MenuItem>

          {showVersion && (
            <div
              style={{
                padding: "var(--space-2) var(--space-3) var(--space-1)",
                fontFamily: fonts.mono,
                fontSize: "var(--text-xs)",
                color: colors.inkSoft,
              }}
            >
              v{__APP_VERSION__} · {__GIT_SHA__}
            </div>
          )}
        </>
      )}
    </Menu>
  );
}
