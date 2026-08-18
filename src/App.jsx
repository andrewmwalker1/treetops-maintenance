import { Routes, Route, useLocation } from "react-router-dom";
import { AuthProvider, useAuth } from "./lib/AuthContext.jsx";
import Layout from "./components/Layout.jsx";
import Login from "./pages/Login.jsx";
import JobsList from "./pages/JobsList.jsx";
import NewJob from "./pages/NewJob.jsx";
import JobDetail from "./pages/JobDetail.jsx";
import EquipmentList from "./pages/EquipmentList.jsx";
import EquipmentDetail from "./pages/EquipmentDetail.jsx";
import Dashboard from "./pages/Dashboard.jsx";
import HealthAndSafety from "./pages/HealthAndSafety.jsx";
import Admin from "./pages/Admin.jsx";
import KioskSignIn from "./kiosk/KioskSignIn.jsx";
import KioskApp from "./kiosk/KioskApp.jsx";
import { colors, pageStyle } from "./lib/theme.js";

function AppShell() {
  const { session, loading, deactivated } = useAuth();
  const location = useLocation();
  // A session minted by an RFID scan carries login_context in its JWT
  // app_metadata (stamped server-side by supabase/functions/rfid-login --
  // the client can never set or edit this). Once that's true the session
  // is kept on the kiosk branch regardless of pathname, so editing the URL
  // by hand after scanning in can no longer reach the full desktop app --
  // the /kiosk path check alone used to be the only gate, and was trivial
  // to bypass since a scanned-in session was otherwise indistinguishable
  // from a normal login.
  const isKiosk = location.pathname.startsWith("/kiosk") || session?.user?.app_metadata?.login_context === "kiosk";

  // The kiosk needs its own routing branch reachable BEFORE the normal
  // !session -> <Login/> check below, since RFID sign-in is how a kiosk
  // session gets created in the first place -- it must be reachable with
  // no session yet. Once signed in it renders its own full-screen
  // KioskApp, never the normal <Layout> chrome/nav.
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

  return (
    <Layout>
      <Routes>
        <Route path="/" element={<JobsList />} />
        <Route path="/jobs/new" element={<NewJob />} />
        <Route path="/jobs/:id" element={<JobDetail />} />
        <Route path="/equipment" element={<EquipmentList />} />
        <Route path="/equipment/:id" element={<EquipmentDetail />} />
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
