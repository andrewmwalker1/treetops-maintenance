import { useRef, useState } from "react";
import { supabase } from "../lib/supabaseClient.js";
import RfidScanListener from "../components/RfidScanListener.jsx";
import { colors, fonts } from "../lib/theme.js";
import { Alert } from "../ui/index.js";

export default function KioskSignIn() {
  const [status, setStatus] = useState("idle"); // idle | checking | error
  const [error, setError] = useState(null);
  const containerRef = useRef(null);

  async function handleScan(tagUid) {
    setStatus("checking");
    setError(null);
    try {
      const { data, error: invokeError } = await supabase.functions.invoke("rfid-login", {
        body: { tagUid, redirectTo: `${window.location.origin}/kiosk`, context: "kiosk" },
      });
      if (invokeError) throw invokeError;
      if (data?.error) throw new Error(data.error);
      if (!data?.actionLink) throw new Error("No sign-in link returned.");
      // Tells AuthContext "register the session that lands from this
      // redirect as a kiosk session" -- see its consumePendingTerminalLogin.
      localStorage.setItem("auth:pendingTerminalLogin", JSON.stringify({ context: "kiosk", ts: Date.now() }));
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
      className="tt-kiosk-page"
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        textAlign: "center",
        padding: "var(--space-6)",
      }}
    >
      <RfidScanListener onScan={handleScan} disabled={status === "checking"} />

      <h1 style={{ fontFamily: fonts.display, color: colors.mossDark, fontSize: "var(--text-2xl)", marginBottom: "var(--space-3)" }}>
        Tree Tops Workshop
      </h1>

      <p style={{ fontSize: "var(--text-lg)", color: colors.inkSoft }}>
        {status === "checking" ? "Signing in…" : "Scan your fob to sign in"}
      </p>

      {error && (
        <Alert tone="danger" title="Sign-in failed" style={{ marginTop: "var(--space-4)", maxWidth: "var(--width-md)", textAlign: "left" }}>
          {error}
        </Alert>
      )}
    </div>
  );
}
