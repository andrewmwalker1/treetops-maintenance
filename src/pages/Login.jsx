import { useState } from "react";
import { supabase } from "../lib/supabaseClient.js";
import { colors, fonts, pageStyle, cardStyle, buttonStyle } from "../lib/theme.js";

export default function Login() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState("idle"); // idle | sending | sent | error
  const [errorMessage, setErrorMessage] = useState("");

  async function handleSubmit(e) {
    e.preventDefault();
    setStatus("sending");
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: window.location.origin },
    });
    if (error) {
      setStatus("error");
      setErrorMessage(error.message);
      return;
    }
    setStatus("sent");
  }

  return (
    <div style={{ ...pageStyle, display: "flex", alignItems: "center", justifyContent: "center", padding: "24px" }}>
      <div style={{ ...cardStyle, padding: "32px", maxWidth: "380px", width: "100%" }}>
        <h1 style={{ fontFamily: fonts.display, fontWeight: 700, color: colors.mossDark, margin: "0 0 8px" }}>
          Tree Tops Maintenance
        </h1>
        <p style={{ color: colors.inkSoft, marginTop: 0 }}>Sign in with your work email — we'll send you a link.</p>

        {status === "sent" ? (
          <p style={{ color: colors.moss, fontWeight: 600 }}>
            Check your email for a sign-in link.
          </p>
        ) : (
          <form onSubmit={handleSubmit}>
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
              {status === "sending" ? "Sending…" : "Send sign-in link"}
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
