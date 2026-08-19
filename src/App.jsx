import { useEffect } from "react";
import { Routes, Route, useLocation } from "react-router-dom";
import { AuthProvider, useAuth } from "./lib/AuthContext.jsx";
import Layout from "./components/Layout.jsx";
import Login from "./pages/Login.jsx";
import JobsList from "./pages/JobsList.jsx";
import NewJob from "./pages/NewJob.jsx";
import JobDetail from "./pages/JobDetail.jsx";
import EquipmentList from "./pages/EquipmentList.jsx";
import EquipmentDetail from "./pages/EquipmentDetail.jsx";
import CheckoutKit from "./pages/CheckoutKit.jsx";
import Dashboard from "./pages/Dashboard.jsx";
import HealthAndSafety from "./pages/HealthAndSafety.jsx";
import Admin from "./pages/Admin.jsx";
import KioskSignIn from "./kiosk/KioskSignIn.jsx";
import KioskApp from "./kiosk/KioskApp.jsx";
import KeyStationSignIn from "./keys/KeyStationSignIn.jsx";
import KeyStationApp from "./keys/KeyStationApp.jsx";
import { colors, pageStyle } from "./lib/theme.js";

function AppShell() {
  const { session, loading, deactivated, canAccessDesktop, signOut } = useAuth();
  const location = useLocation();
  const isKiosk = location.pathname.startsWith("/kiosk");
  const isKeyStation = location.pathname.startsWith("/keys");

  // A session minted by an RFID scan carries login_context in its JWT
  // app_metadata (stamped server-side by supabase/functions/rfid-login --
  // the client can never set or edit this, unlike the pathname): "kiosk"
  // for the workshop terminal, "key_station" for the key-cupboard one. If
  // that claim doesn't match the terminal path we're currently on, this
  // session has been navigated away from its terminal by hand -- the
  // escape this exists to close. An earlier version of this check tried
  // to force such a session back onto its own branch, but that required
  // distinguishing "a live terminal session, escaping" from "an old, now-
  // stale claim on an otherwise normal session" using only this same
  // pathname+claim state, which is impossible -- the two look identical
  // from here. Signing out instead needs no such distinction: it's always
  // the safe response, and a genuinely stale claim gets cleared for good
  // on the next real login anyway (see AuthContext's
  // consumePendingNormalLogin).
  const loginContext = session?.user?.app_metadata?.login_context;
  const onOwnTerminal = (loginContext === "kiosk" && isKiosk) || (loginContext === "key_station" && isKeyStation);
  const terminalSessionEscaped = Boolean(loginContext) && !onOwnTerminal;

  useEffect(() => {
    if (!terminalSessionEscaped) return;
    // Re-check against the LIVE browser URL after a short settle delay,
    // not the react-router location snapshot that triggered this render --
    // signing out is a one-way trip, and the redirect chain a fresh RFID
    // sign-in goes through (Supabase's own magic-link verification, the
    // GitHub Pages SPA-fallback's public/404.html -> ?redirect= ->
    // history.replaceState dance, and supabase-js's own hash cleanup) can
    // leave react-router's location transiently out of step with
    // window.location while it all settles. A single render catching that
    // in-between moment used to be enough to permanently kill a session
    // that was actually fine -- reproduced as "scan -> Signing in... ->
    // bounced back to sign in again" on the key station.
    const timer = setTimeout(() => {
      const realPath = window.location.pathname;
      const stillOnOwnTerminal =
        (loginContext === "kiosk" && realPath.startsWith("/kiosk")) ||
        (loginContext === "key_station" && realPath.startsWith("/keys"));
      if (!stillOnOwnTerminal) signOut();
    }, 500);
    return () => clearTimeout(timer);
  }, [terminalSessionEscaped, loginContext, signOut]);

  if (terminalSessionEscaped) {
    return (
      <div style={{ ...pageStyle, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <p style={{ color: colors.inkSoft }}>Signing out…</p>
      </div>
    );
  }

  // Both terminals need their own routing branch reachable BEFORE the
  // normal !session -> <Login/> check below, since RFID sign-in is how a
  // terminal session gets created in the first place -- it must be
  // reachable with no session yet. Once signed in each renders its own
  // full-screen app, never the normal <Layout> chrome/nav.
  if (isKiosk) {
    if (loading) {
      return (
        <div style={{ ...pageStyle, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <p style={{ color: colors.inkSoft }}>Loading…</p>
        </div>
      );
    }
    if (deactivated) {
      return (
        <div style={{ ...pageStyle, display: "flex", alignItems: "center", justifyContent: "center", padding: "24px" }}>
          <p style={{ color: colors.immediate, textAlign: "center", maxWidth: "360px" }}>
            This account has been deactivated.
          </p>
        </div>
      );
    }
    if (!session) return <KioskSignIn />;
    return <KioskApp />;
  }

  if (isKeyStation) {
    if (loading) {
      return (
        <div style={{ ...pageStyle, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <p style={{ color: colors.inkSoft }}>Loading…</p>
        </div>
      );
    }
    if (deactivated) {
      return (
        <div style={{ ...pageStyle, display: "flex", alignItems: "center", justifyContent: "center", padding: "24px" }}>
          <p style={{ color: colors.immediate, textAlign: "center", maxWidth: "360px" }}>
            This account has been deactivated.
          </p>
        </div>
      );
    }
    if (!session) return <KeyStationSignIn />;
    return <KeyStationApp />;
  }

  if (loading) {
    return (
      <div style={{ ...pageStyle, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <p style={{ color: colors.inkSoft }}>Loading…</p>
      </div>
    );
  }

  if (deactivated) {
    return (
      <div style={{ ...pageStyle, display: "flex", alignItems: "center", justifyContent: "center", padding: "24px" }}>
        <p style={{ color: colors.immediate, textAlign: "center", maxWidth: "360px" }}>
          Your account has been deactivated. Contact your admin if you think this is a mistake.
        </p>
      </div>
    );
  }

  if (!session) return <Login />;

  // A role-level gate, separate from the session-provenance one above:
  // that one confines a *kiosk-tapped-in* session regardless of role; this
  // one confines a role that should never see the desktop app at all, no
  // matter how it signed in (a normal email login included) -- e.g. a
  // future Contractor role. Set per-role on the Roles & Permissions admin
  // screen, defaulted on for every existing role by
  // 35-desktop-access-permission.sql so nobody's current access changes.
  if (!canAccessDesktop) {
    return (
      <div style={{ ...pageStyle, display: "flex", alignItems: "center", justifyContent: "center", padding: "24px" }}>
        <p style={{ color: colors.inkSoft, textAlign: "center", maxWidth: "360px" }}>
          This account doesn't have access to the desktop app.
        </p>
      </div>
    );
  }

  return (
    <Layout>
      <Routes>
        <Route path="/" element={<JobsList />} />
        <Route path="/jobs/new" element={<NewJob />} />
        <Route path="/jobs/:id" element={<JobDetail />} />
        <Route path="/equipment" element={<EquipmentList />} />
        <Route path="/equipment/:id" element={<EquipmentDetail />} />
        <Route path="/checkout-kit" element={<CheckoutKit />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/safety" element={<HealthAndSafety />} />
        <Route path="/admin" element={<Admin />} />
      </Routes>
    </Layout>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppShell />
    </AuthProvider>
  );
}
