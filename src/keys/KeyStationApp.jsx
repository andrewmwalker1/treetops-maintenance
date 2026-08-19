import { useEffect, useRef } from "react";
import { Routes, Route } from "react-router-dom";
import { useAuth } from "../lib/AuthContext.jsx";
import { usePermissions } from "../lib/permissions.js";
import KeyStationMenu from "./KeyStationMenu.jsx";
import KeyStationCheckOut from "./KeyStationCheckOut.jsx";
import KeyStationCheckIn from "./KeyStationCheckIn.jsx";
import KeyStationLookup from "./KeyStationLookup.jsx";
import KeyStationRelocate from "./KeyStationRelocate.jsx";
import KeyStationForceCheckIn from "./KeyStationForceCheckIn.jsx";
import { colors, fonts } from "../lib/theme.js";
import { kioskPageStyle, kioskDangerButtonStyle } from "../kiosk/kioskTheme.js";

// Same reasoning as KioskApp.jsx's idle timer -- a shared, unattended
// terminal shouldn't stay signed in under the wrong identity indefinitely.
const IDLE_TIMEOUT_MS = 3 * 60 * 1000;

export default function KeyStationApp() {
  const { signOut, activeSite } = useAuth();
  const permissions = usePermissions();
  const containerRef = useRef(null);
  const timeoutRef = useRef(null);

  useEffect(() => {
    function resetTimer() {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(() => signOut(), IDLE_TIMEOUT_MS);
    }
    resetTimer();
    const el = containerRef.current;
    el?.addEventListener("pointerdown", resetTimer);
    el?.addEventListener("keydown", resetTimer);
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      el?.removeEventListener("pointerdown", resetTimer);
      el?.removeEventListener("keydown", resetTimer);
    };
  }, [signOut]);

  if (!activeSite) {
    return (
      <div style={{ ...kioskPageStyle, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <p>Loading…</p>
      </div>
    );
  }

  // rfid-login doesn't check can_use_key_system at sign-in time (same as
  // the workshop kiosk not checking any permission of its own) -- anyone
  // with a fob can scan in, so this is where a role that was never meant
  // to use the key system gets turned away with a clear reason instead of
  // a broken/empty screen. permissions starts empty until it's fetched
  // (see usePermissions()'s own caveat), so this only shows once we
  // actually know the answer is no, not while it's still loading.
  if (permissions.size > 0 && !permissions.has("can_use_key_system")) {
    return (
      <div style={{ ...kioskPageStyle, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "24px", textAlign: "center" }}>
        <p style={{ fontFamily: fonts.body, fontSize: "18px", color: colors.inkSoft, maxWidth: "360px" }}>
          This account doesn't have access to the key system.
        </p>
        <button style={{ ...kioskDangerButtonStyle, marginTop: "20px", width: "auto", padding: "14px 28px" }} onClick={() => signOut()}>
          Sign out
        </button>
      </div>
    );
  }

  return (
    <div ref={containerRef} style={kioskPageStyle}>
      <Routes>
        <Route path="/keys" element={<KeyStationMenu />} />
        <Route path="/keys/checkout" element={<KeyStationCheckOut />} />
        <Route path="/keys/checkin" element={<KeyStationCheckIn />} />
        <Route path="/keys/find" element={<KeyStationLookup />} />
        <Route path="/keys/relocate" element={<KeyStationRelocate />} />
        <Route path="/keys/force-checkin" element={<KeyStationForceCheckIn />} />
      </Routes>
    </div>
  );
}
