import { useRef, useState } from "react";
import { supabase } from "../lib/supabaseClient.js";
import RfidScanListener from "../components/RfidScanListener.jsx";
import { colors, fonts } from "../lib/theme.js";
import { kioskPageStyle } from "../kiosk/kioskTheme.js";

// Identical shape to KioskSignIn.jsx, just posting context: "key_station"
// so rfid-login stamps the matching claim -- see App.jsx for how that
// claim, not this URL, is what actually keeps a scanned-in session here.
export default function KeyStationSignIn() {
  const [status, setStatus] = useState("idle"); // idle | checking | error
  const [error, setError] = useState(null);
  const containerRef = useRef(null);

  async function handleScan(tagUid) {
    setStatus("checking");
    setError(null);
    try {
      const { data, error: invokeError } = await supabase.functions.invoke("rfid-login", {
        body: { tagUid, redirectTo: `${window.location.origin}/keys`, context: "key_station" },
      });
      if (invokeError) throw invokeError;
      if (data?.error) throw new Error(data.error);
      if (!data?.actionLink) throw new Error("No sign-in link returned.");
      window.location.href = data.actionLink;
    } catch (err) {
      setError(err.message || "Sign-in failed. Try scanning again.");
      setStatus("error");
    }
  }

  return (
    <div
      ref={containerRef}
      onClick={() => containerRef.current?.querySelector("input")?.focus()}
      style={{
        ...kioskPageStyle,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        textAlign: "center",
        padding: "24px",
      }}
    >
      <RfidScanListener onScan={handleScan} disabled={status === "checking"} />

      <h1 style={{ fontFamily: fonts.display, color: colors.mossDark, fontSize: "32px", marginBottom: "12px" }}>
        Tree Tops Key Station
      </h1>

      {status === "checking" ? (
        <p style={{ fontSize: "20px", color: colors.inkSoft }}>Signing in…</p>
      ) : (
        <p style={{ fontSize: "20px", color: colors.inkSoft }}>Scan your fob to sign in</p>
      )}

      {error && (
        <p style={{ fontSize: "16px", color: colors.immediate, marginTop: "16px", maxWidth: "480px" }}>{error}</p>
      )}
    </div>
  );
}
