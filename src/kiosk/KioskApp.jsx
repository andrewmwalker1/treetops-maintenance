import { useEffect, useRef } from "react";
import { Routes, Route } from "react-router-dom";
import { useAuth } from "../lib/AuthContext.jsx";
import KioskMenu from "./KioskMenu.jsx";
import KioskJobs from "./KioskJobs.jsx";
import KioskCheckOut from "./KioskCheckOut.jsx";
import KioskCheckIn from "./KioskCheckIn.jsx";
import KioskSafety from "./KioskSafety.jsx";
import { kioskPageStyle } from "./kioskTheme.js";

// Idle sign-out: staff don't have to re-tap between quick consecutive
// actions, but a forgotten sign-out on a shared kiosk doesn't stay open
// indefinitely under the wrong identity. 3 minutes of no touch/key
// activity anywhere in the kiosk signs out and returns to the scan screen.
const IDLE_TIMEOUT_MS = 3 * 60 * 1000;

export default function KioskApp() {
  const { signOut, activeSite } = useAuth();
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

  return (
    <div ref={containerRef} style={kioskPageStyle}>
      <Routes>
        <Route path="/kiosk" element={<KioskMenu />} />
        <Route path="/kiosk/jobs" element={<KioskJobs />} />
        <Route path="/kiosk/checkout" element={<KioskCheckOut />} />
        <Route path="/kiosk/checkin" element={<KioskCheckIn />} />
        <Route path="/kiosk/safety" element={<KioskSafety />} />
      </Routes>
    </div>
  );
}
