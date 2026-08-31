import { useEffect, lazy, Suspense } from "react";
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
import CheckinKit from "./pages/CheckinKit.jsx";
import KeysHome from "./pages/KeysHome.jsx";
import CheckOutKey from "./pages/CheckOutKey.jsx";
import CheckInKey from "./pages/CheckInKey.jsx";
import FindKey from "./pages/FindKey.jsx";
import RelocateKey from "./pages/RelocateKey.jsx";
import ForceCheckInKey from "./pages/ForceCheckInKey.jsx";
import HandoverKey from "./pages/HandoverKey.jsx";
import KeysGate from "./components/KeysGate.jsx";
import Dashboard from "./pages/Dashboard.jsx";
import HealthAndSafety from "./pages/HealthAndSafety.jsx";
import Admin from "./pages/Admin.jsx";
import KioskSignIn from "./kiosk/KioskSignIn.jsx";
import KioskApp from "./kiosk/KioskApp.jsx";
import KeyStationSignIn from "./keys/KeyStationSignIn.jsx";
import KeyStationApp from "./keys/KeyStationApp.jsx";
import { colors, pageStyle } from "./lib/theme.js";

// Lazy-loaded: html5-qrcode + tesseract.js pull in a sizeable chunk (OCR's
// WASM engine especially) that only the handful of people reading meters a
// few times a year actually need -- eagerly importing it here would put
// that weight on every page load for the whole team, every day.
const ScanMeter = lazy(() => import("./pages/meters/ScanMeter.jsx"));
const MeterProgress = lazy(() => import("./pages/meters/MeterProgress.jsx"));

function AppShell() {
  const { session, loading, deactivated, canAccessDesktop, signOut } = useAuth();
  const location = useLocation();
  const isKiosk = location.pathname.startsWith("/kiosk");
  const isKeyStation = location.pathname.startsWith("/keys");

  // A session minted by an RFID scan carries login_context in its JWT
  // app_metadata: "kiosk" for the workshop terminal, "key_station" for the
  // key-cupboard one. If that claim doesn't match the terminal path we're
  // currently on, this session has been navigated away from its terminal by
  // hand -- the escape this exists to close.
  //
  // This claim is session-scoped, not account-scoped (a Postgres Custom
  // Access Token Hook injects it per-session from terminal_sessions, keyed
  // on the JWT's own session_id -- see 46-terminal-session-scoped-login-
  // context.sql) -- so unlike the account-wide app_metadata write this
  // replaced, it can never leak onto some OTHER session for the same
  // person (e.g. their own phone, signed in separately). A previous version
  // stamped this onto auth.users directly, which meant a phone session
  // would eventually inherit a kiosk scan done on a completely different
  // device the next time its token refreshed, and get force-signed-out by
  // the exact check below -- that's what this file used to warn was
  // "impossible to distinguish from here." With the claim properly scoped
  // to the one session it belongs to, that ambiguity is gone: if it's
  // present and mismatched, this session really did wander off its own
  // terminal, and signing out is simply correct.
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
        <Route path="/checkin-kit" element={<CheckinKit />} />
        <Route path="/key-register" element={<KeysGate><KeysHome /></KeysGate>} />
        <Route path="/key-register/checkout" element={<KeysGate><CheckOutKey /></KeysGate>} />
        <Route path="/key-register/checkin" element={<KeysGate><CheckInKey /></KeysGate>} />
        <Route path="/key-register/find" element={<KeysGate><FindKey /></KeysGate>} />
        <Route path="/key-register/relocate" element={<KeysGate><RelocateKey /></KeysGate>} />
        <Route path="/key-register/force-checkin" element={<KeysGate><ForceCheckInKey /></KeysGate>} />
        <Route path="/key-register/handover" element={<KeysGate><HandoverKey /></KeysGate>} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/safety" element={<HealthAndSafety />} />
        <Route
          path="/meters/scan"
          element={
            <Suspense fallback={<p style={{ color: colors.inkSoft }}>Loading…</p>}>
              <ScanMeter />
            </Suspense>
          }
        />
        <Route
          path="/meters/progress"
          element={
            <Suspense fallback={<p style={{ color: colors.inkSoft }}>Loading…</p>}>
              <MeterProgress />
            </Suspense>
          }
        />
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
