import { useEffect, useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { useAuth } from "../lib/AuthContext.jsx";
import { usePermissions } from "../lib/permissions.js";
import { colors, fonts, pageStyle } from "../lib/theme.js";
import { subscribeToPush, setDNDEnabled } from "../platform/notifications.js";
import { flushQueue, getQueueStatus, flushReadingQueue, getReadingQueueStatus } from "../platform/syncQueue.js";
import {
  useIsMobile,
  detectIsPhoneDevice,
  detectIsTabletDevice,
  getTabletUsesDesktopLayout,
  setTabletUsesDesktopLayout,
} from "../lib/useIsMobile.js";
import { useNavBadges } from "../lib/useNavBadges.js";
import { BUILD_LABEL } from "../lib/buildInfo.js";
import { ViewAsPicker, ViewAsBanner } from "./ViewAsControl.jsx";
import Menu, { MenuHeader, MenuItem, MenuSeparator } from "../ui/Menu.jsx";
import { Switch } from "../ui/primitives.jsx";
import {
  IconChevronRight,
  IconEquipment,
  IconFolder,
  IconHoliday,
  IconJobs,
  IconKeys,
  IconMeters,
  IconOffline,
  IconOverview,
  IconSafety,
  IconSettings,
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

// Per-device, like the tablet layout choice in useIsMobile.js: someone
// might want it collapsed on a small laptop and open on a big monitor.
const SIDEBAR_COLLAPSED_KEY = "tt.sidebarCollapsed";

function readSidebarCollapsed() {
  try {
    return window.localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === "1";
  } catch {
    return false;
  }
}

export default function Layout({ children }) {
  const { profile, viewingAs, org, activeSite, signOut } = useAuth();
  const permissions = usePermissions();
  const isMobile = useIsMobile();
  const location = useLocation();
  const [dnd, setDnd] = useState(Boolean(profile?.dnd_enabled));
  const [pushStatus, setPushStatus] = useState("idle"); // idle | subscribing | on | error
  const [queueStatus, setQueueStatus] = useState({ pendingCount: 0, online: navigator.onLine });
  const [readingQueueStatus, setReadingQueueStatus] = useState({ pendingCount: 0, online: navigator.onLine });
  const [collapsed, setCollapsed] = useState(readSidebarCollapsed);

  const canUseKeys = permissions.has("can_use_key_system");
  const badges = useNavBadges(isMobile ? null : activeSite?.id, { keys: canUseKeys, refreshKey: location.pathname });

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

  function toggleCollapsed() {
    const next = !collapsed;
    setCollapsed(next);
    try {
      if (next) window.localStorage.setItem(SIDEBAR_COLLAPSED_KEY, "1");
      else window.localStorage.removeItem(SIDEBAR_COLLAPSED_KEY);
    } catch {
      // Blocked storage: it still collapses, it just won't be remembered.
    }
  }

  // One list drives the desktop sidebar, the mobile tab bar and the
  // overflow in the account menu, so the permission gating is written once.
  //
  // `tabBar` marks the destinations that earn a slot on a phone's bottom
  // bar. Dashboard is deliberately not one: it is a manager's summary
  // rather than somewhere anyone works, and five tabs is the most a phone
  // can carry before the labels stop being readable. It stays one tap away
  // in the account menu, and keeps its place in the desktop sidebar.
  //
  // The sidebar mockup grouped these under headings ("Kit & site", "My
  // time"...); Andy left the headings out for now (2026-09-28) and may
  // bring them back once the Stock sheet and CRM join the app. The order is
  // unchanged from the old top bar, since it also decides which five
  // destinations make the phone tab bar.
  const navItems = [
    { to: "/", label: "Jobs", end: true, Icon: IconJobs, tabBar: true, badge: "overdue" },
    { to: "/dashboard", label: "Dashboard", Icon: IconOverview, tabBar: false },
    // License Agreement lives inside Office Hub as a tab, not its own
    // destination -- either permission earns a way in.
    ...(permissions.has("can_use_office_hub") || permissions.has("can_use_license_agreement") || permissions.has("can_manage_timesheets")
      ? [{ to: "/office-hub", label: "Office Hub", Icon: IconFolder, tabBar: false }]
      : []),
    { to: "/equipment", label: "Equipment", shortLabel: "Kit", Icon: IconEquipment, tabBar: true },
    ...(canUseKeys ? [{ to: "/key-register", label: "Keys", Icon: IconKeys, tabBar: true, badge: "keys" }] : []),
    ...(permissions.has("can_submit_timesheet")
      ? [{ to: "/timesheets", label: "Timesheet", Icon: IconOverview, tabBar: true }]
      : []),
    // Universal -- unlike Timesheet above, everyone can book/view their
    // own holiday regardless of permissions, so this is never conditional.
    { to: "/holidays", label: "Holiday", Icon: IconHoliday, tabBar: false },
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

  const accountMenuProps = {
    displayName: profile?.display_name,
    roleName: profile?.roles?.name,
    showControls: !viewingAs,
    dnd,
    onToggleDnd: handleDndToggle,
    pushStatus,
    onEnablePush: handleEnablePush,
    onSignOut: signOut,
    // On desktop, Settings & admin is a sidebar link instead.
    canSeeAdmin: canSeeAdmin && isMobile,
    overflowItems,
  };

  if (!isMobile) {
    return (
      <div style={{ ...pageStyle, height: "100vh", display: "flex", flexDirection: "column", overflow: "hidden" }}>
        <div style={{ flexShrink: 0 }}>
          <ViewAsBanner />
        </div>
        <div className="tt-shell">
          <Sidebar
            collapsed={collapsed}
            onToggleCollapsed={toggleCollapsed}
            orgName={org?.name}
            siteName={activeSite?.name}
            navItems={navItems}
            badges={badges}
            canSeeAdmin={canSeeAdmin}
            syncStatus={<SyncStatus jobs={queueStatus} readings={readingQueueStatus} align="side" />}
            accountMenu={<AccountMenu {...accountMenuProps} variant="sidebar" />}
          />
          <main className="tt-main">{children}</main>
        </div>
      </div>
    );
  }

  return (
    <div style={{ ...pageStyle, height: "100vh", display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <div style={{ flexShrink: 0 }}>
        <ViewAsBanner />
      </div>

      <header className="tt-appbar">
        <div className="tt-appbar__identity">
          <span className="tt-appbar__mark" aria-hidden="true">
            {initials(org?.name || "Tree Tops")}
          </span>
          <div style={{ minWidth: 0 }}>
            <div className="tt-appbar__org">{org?.name || "Tree Tops Maintenance"}</div>
            {activeSite && <div className="tt-appbar__site">{activeSite.name}</div>}
          </div>
        </div>

        <div className="tt-appbar__right">
          <SyncStatus jobs={queueStatus} readings={readingQueueStatus} />
          <AccountMenu {...accountMenuProps} />
        </div>
      </header>

      <main className="tt-main tt-main--mobile">{children}</main>

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
    </div>
  );
}

// The desktop navigation. Replaced a single row of links across the top
// of the screen that ran out of width on a laptop (2026-09-28): with nine
// possible destinations plus the org name, sync chip, View-As picker and
// avatar all sharing one row, a 1366px screen clipped links at both ends
// -- and because the row was centred, the ones clipped on the left (Jobs,
// Dashboard) couldn't even be scrolled back to. A column has room to grow.
//
// Collapses to icons only, for small laptops; each link then keeps its
// name as a tooltip and as screen-reader text.
function Sidebar({
  collapsed,
  onToggleCollapsed,
  orgName,
  siteName,
  navItems,
  badges,
  canSeeAdmin,
  syncStatus,
  accountMenu,
}) {
  const badgeFor = {
    overdue:
      badges.overdueJobs > 0 ? (
        <span className="tt-sidebar__badge tt-sidebar__badge--danger" title={`${badges.overdueJobs} overdue`}>
          {badges.overdueJobs}
          <span className="tt-sr-only"> overdue</span>
        </span>
      ) : null,
    keys:
      badges.keysOut > 0 ? (
        <span className="tt-sidebar__badge" title={`${badges.keysOut} out`}>
          {badges.keysOut}
          <span className="tt-sidebar__badge-word"> out</span>
        </span>
      ) : null,
  };

  const links = [
    ...navItems,
    ...(canSeeAdmin ? [{ to: "/admin", label: "Settings & admin", Icon: IconSettings }] : []),
  ];

  return (
    <aside className={`tt-sidebar${collapsed ? " tt-sidebar--collapsed" : ""}`}>
      <div className="tt-sidebar__brand">
        <span className="tt-sidebar__mark" aria-hidden="true">
          {initials(orgName || "Tree Tops")}
        </span>
        <div className="tt-sidebar__brandtext">
          <div className="tt-sidebar__org">{orgName || "Tree Tops Maintenance"}</div>
          {siteName && <div className="tt-sidebar__site">{siteName}</div>}
        </div>
      </div>

      <nav className="tt-sidebar__nav" aria-label="Main">
        {links.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            title={collapsed ? item.label : undefined}
            className={({ isActive }) => `tt-sidelink${isActive ? " tt-sidelink--active" : ""}`}
          >
            <item.Icon size={18} />
            <span className="tt-sidelink__label">{item.label}</span>
            {item.badge && badgeFor[item.badge]}
          </NavLink>
        ))}
      </nav>

      <div className="tt-sidebar__foot">
        {syncStatus}
        <button
          type="button"
          className="tt-sidebar__collapse"
          onClick={onToggleCollapsed}
          aria-label={collapsed ? "Expand menu" : "Collapse menu"}
          title={collapsed ? "Expand menu" : undefined}
        >
          <IconChevronRight size={18} className="tt-sidebar__collapse-icon" />
          <span className="tt-sidelink__label">Collapse menu</span>
        </button>
        {accountMenu}
      </div>
    </aside>
  );
}

// One chip for both queues, replacing the two separate pills that each
// appeared and disappeared independently and shoved the rest of the header
// sideways as they did. Click it for the breakdown.
function SyncStatus({ jobs, readings, align = "right" }) {
  const pending = jobs.pendingCount + readings.pendingCount;
  const online = jobs.online && readings.online;
  if (pending === 0 && online) return null;

  const offline = !online;
  const label = offline ? (pending > 0 ? `${pending} queued` : "Offline") : `Syncing ${pending}`;

  return (
    <Menu
      align={align}
      anchorClassName={align === "side" ? "tt-sidebar__syncanchor" : undefined}
      trigger={(p) => (
        <button
          type="button"
          className={`tt-statuschip tt-statuschip--${offline ? "offline" : "syncing"}`}
          aria-label={label}
          title={label}
          {...p}
        >
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
// name, Do not disturb, notifications, View as, sign out -- and on a phone,
// the destinations the bottom tab bar has no room for, plus admin.
//
// `variant="sidebar"` is the desktop form: your name and role at the foot
// of the sidebar, opening sideways. The default is the phone header's
// round avatar.
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
  variant = "avatar",
}) {
  const sidebar = variant === "sidebar";
  // Only a tablet gets the choice: a phone is too narrow for the desktop
  // layout, and a laptop already has it.
  const offerLayoutChoice = detectIsTabletDevice() && !detectIsPhoneDevice();
  const [desktopLayout, setDesktopLayout] = useState(getTabletUsesDesktopLayout);

  function handleLayoutToggle(next) {
    setDesktopLayout(next);
    setTabletUsesDesktopLayout(next);
  }

  return (
    <Menu
      align={sidebar ? "side" : "right"}
      anchorClassName={sidebar ? "tt-sidebar__account" : undefined}
      trigger={(p) =>
        sidebar ? (
          <button type="button" className="tt-sidebar__me" aria-label="Account and settings" title={displayName} {...p}>
            <span className="tt-sidebar__avatar">{initials(displayName)}</span>
            <span className="tt-sidelink__label tt-sidebar__who">
              <span className="tt-sidebar__name">{displayName || "Signed in"}</span>
              {roleName && <span className="tt-sidebar__role">{roleName}</span>}
            </span>
          </button>
        ) : (
          <button type="button" className="tt-avatar" aria-label="Account and settings" {...p}>
            {initials(displayName)}
          </button>
        )
      }
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
              {/* Renders nothing for anyone without can_manage_users, and
                  the wrapper collapses with it (:empty in Layout.css). */}
              <div className="tt-menu__viewas">
                <ViewAsPicker />
              </div>
            </>
          )}

          {offerLayoutChoice && (
            <MenuItem
              as="div"
              meta={<Switch checked={desktopLayout} onChange={handleLayoutToggle} label="Desktop layout" />}
              style={{ cursor: "default" }}
            >
              Desktop layout
            </MenuItem>
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

          <div
            style={{
              padding: "var(--space-2) var(--space-3) var(--space-1)",
              fontFamily: fonts.mono,
              fontSize: "var(--text-xs)",
              color: colors.inkSoft,
            }}
          >
            {BUILD_LABEL}
          </div>
        </>
      )}
    </Menu>
  );
}
