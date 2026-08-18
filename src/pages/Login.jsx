import { useState } from "react";
import { supabase } from "../lib/supabaseClient.js";
import { colors, fonts, pageStyle, cardStyle, buttonStyle } from "../lib/theme.js";

export default function Login() {
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [status, setStatus] = useState("idle"); // idle | sending | sent | verifying | error
  const [errorMessage, setErrorMessage] = useState("");

  async function handleSendCode(e) {
    e.preventDefault();
    setStatus("sending");
    setErrorMessage("");
    // A trailing space from mobile-keyboard autocomplete makes the typed
    // email a silent non-match for an existing account -- Supabase then
    // treats it as a brand new signup attempt and rejects it with
    // "Signups not allowed for this instance", which looks nothing like
    // a typo problem from the error message alone.
    const trimmedEmail = email.trim();
    setEmail(trimmedEmail);
    const { error } = await supabase.auth.signInWithOtp({
      email: trimmedEmail,
      options: { emailRedirectTo: window.location.origin },
    });
    if (error) {
      setStatus("error");
      setErrorMessage(error.message);
      return;
    }
    setStatus("sent");
  }

  // Home-screen PWAs on iOS can't hand a link tapped in Mail back to the
  // installed app -- it always opens in Safari instead, leaving the PWA
  // itself signed out. Typing the code in directly avoids ever leaving the
  // app, so it works the same everywhere. A successful verifyOtp fires
  // SIGNED_IN through the same onAuthStateChange listener AuthContext
  // already uses for the link flow -- nothing else to wire up here.
  async function handleVerifyCode(e) {
    e.preventDefault();
    setStatus("verifying");
    setErrorMessage("");
    const { error } = await supabase.auth.verifyOtp({ email, token: code, type: "email" });
    if (error) {
      setStatus("sent");
      setErrorMessage(error.message);
    }
  }

  function handleUseDifferentEmail() {
    setStatus("idle");
    setCode("");
    setErrorMessage("");
  }

  return (
    <div style={{ ...pageStyle, display: "flex", alignItems: "center", justifyContent: "center", padding: "24px" }}>
      <div style={{ ...cardStyle, padding: "32px", maxWidth: "380px", width: "100%" }}>
        <h1 style={{ fontFamily: fonts.display, fontWeight: 700, color: colors.mossDark, margin: "0 0 8px" }}>
          Tree Tops Maintenance
        </h1>
        <p style={{ color: colors.inkSoft, marginTop: 0 }}>Sign in with your work email — we'll send you a link and a code.</p>

        {status === "sent" || status === "verifying" ? (
          <>
            <p style={{ color: colors.moss, fontWeight: 600, marginBottom: "4px" }}>
              Check your email — tap the link, or enter the 8-digit code below.
            </p>
            <p style={{ color: colors.inkSoft, fontSize: "13px", marginTop: 0 }}>
              Using the app from your home screen? Use the code — the link opens in a
              separate browser tab instead of the app.
            </p>
            <form onSubmit={handleVerifyCode}>
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                required
                autoFocus
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="12345678"
                style={{
                  width: "100%",
                  boxSizing: "border-box",
                  padding: "10px 14px",
                  borderRadius: "10px",
                  border: `1px solid ${colors.lineStrong}`,
                  fontFamily: fonts.mono,
                  fontSize: "20px",
                  letterSpacing: "4px",
                  textAlign: "center",
                  marginBottom: "12px",
                }}
              />
              <button type="submit" disabled={status === "verifying"} style={{ ...buttonStyle.primary, width: "100%" }}>
                {status === "verifying" ? "Verifying…" : "Verify code"}
              </button>
              {errorMessage && <p style={{ color: colors.immediate, fontSize: "14px" }}>{errorMessage}</p>}
              <button type="button" onClick={handleUseDifferentEmail} style={{ ...buttonStyle.secondary, width: "100%", marginTop: "8px" }}>
                Use a different email
              </button>
            </form>
          </>
        ) : (
          <form onSubmit={handleSendCode}>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@treetopscaravanpark.co.uk"
              style={{
                width: "100%",
                boxSizing: "border-box",
                padding: "10px 14px",
                borderRadius: "10px",
                border: `1px solid ${colors.lineStrong}`,
                fontFamily: fonts.body,
                fontSize: "16px",
                marginBottom: "12px",
              }}
            />
            <button type="submit" disabled={status === "sending"} style={{ ...buttonStyle.primary, width: "100%" }}>
              {status === "sending" ? "Sending…" : "Send sign-in link & code"}
            </button>
            {status === "error" && (
              <p style={{ color: colors.immediate, fontSize: "14px" }}>{errorMessage}</p>
            )}
          </form>
        )}
      </div>
    </div>
  );
}
