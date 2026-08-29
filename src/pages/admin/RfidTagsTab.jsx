import { useEffect, useState } from "react";
import { useAuth } from "../../lib/AuthContext.jsx";
import { supabase } from "../../lib/supabaseClient.js";
import RfidScanListener from "../../components/RfidScanListener.jsx";
import { colors, fonts, cardStyle, buttonStyle } from "../../lib/theme.js";

const fieldStyle = {
  width: "100%",
  boxSizing: "border-box",
  padding: "8px 12px",
  borderRadius: "8px",
  border: `1px solid ${colors.lineStrong}`,
  fontFamily: fonts.body,
  marginBottom: "10px",
};

export default function RfidTagsTab() {
  const { org } = useAuth();
  const [tags, setTags] = useState([]);
  const [people, setPeople] = useState([]);
  const [error, setError] = useState(null);
  const [scannedUid, setScannedUid] = useState(null);
  const [assignProfileId, setAssignProfileId] = useState("");

  function refresh() {
    Promise.all([
      supabase.from("rfid_tags").select("id, tag_uid, created_at, profiles(id, display_name)").order("created_at"),
      supabase.from("profiles").select("id, display_name").eq("org_id", org.id).order("display_name"),
    ]).then(([{ data: t, error: err }, { data: p }]) => {
      if (err) setError(err.message);
      else setTags(t || []);
      setPeople(p || []);
    });
  }

  useEffect(refresh, [org]);

  function handleScan(uid) {
    const existing = tags.find((t) => t.tag_uid === uid);
    if (existing) {
      setError(`This fob is already registered to ${existing.profiles?.display_name || "someone else"}.`);
      setScannedUid(null);
      setAssignProfileId("");
      return;
    }
    setError(null);
    setScannedUid(uid);
    setAssignProfileId("");
  }

  async function handleAssign(e) {
    e.preventDefault();
    if (!scannedUid || !assignProfileId) return;
    const { error: err } = await supabase.from("rfid_tags").insert({ tag_uid: scannedUid, profile_id: assignProfileId });
    if (err) {
      if (err.code === "23505") {
        const existing = tags.find((t) => t.tag_uid === scannedUid);
        setError(`This fob is already registered${existing ? ` to ${existing.profiles?.display_name}` : ""}.`);
      } else {
        setError(err.message);
      }
      return;
    }
    setScannedUid(null);
    setAssignProfileId("");
    refresh();
  }

  async function handleRevoke(id) {
    const { error: err } = await supabase.from("rfid_tags").delete().eq("id", id);
    if (err) setError(err.message);
    else refresh();
  }

  return (
    <div>
      <h2 style={{ fontFamily: fonts.display, fontSize: "16px", color: colors.mossDark, marginTop: 0 }}>RFID fobs</h2>
      <p style={{ fontSize: "13px", color: colors.inkSoft, marginTop: 0 }}>
        Registered fobs let staff sign in at the workshop kiosk by scanning instead of using a magic-link email.
      </p>

      {error && <p style={{ color: colors.immediate, fontSize: "13px" }}>{error}</p>}

      {tags.map((t) => (
        <div key={t.id} style={{ ...cardStyle, padding: "12px 16px", marginBottom: "8px", display: "flex", justifyContent: "space-between", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
          <div>
            <div style={{ fontWeight: 600 }}>{t.profiles?.display_name || "Unknown"}</div>
            <div style={{ fontSize: "12px", color: colors.inkSoft, fontFamily: fonts.mono }}>{t.tag_uid}</div>
          </div>
          <button onClick={() => handleRevoke(t.id)} style={{ ...buttonStyle.secondary, color: colors.immediate }}>Revoke</button>
        </div>
      ))}
      {tags.length === 0 && <p style={{ color: colors.inkSoft }}>No fobs registered yet.</p>}

      <div style={{ ...cardStyle, padding: "16px", maxWidth: "440px", marginTop: "16px" }}>
        <h3 style={{ fontFamily: fonts.display, fontSize: "14px", color: colors.mossDark, marginTop: 0 }}>Register a new fob</h3>
        <RfidScanListener onScan={handleScan} />
        {!scannedUid && (
          <p style={{ color: colors.inkSoft, fontSize: "13px" }}>
            Scan a fob on the reader connected to this computer.
          </p>
        )}
        {scannedUid && (
          <form onSubmit={handleAssign}>
            <p style={{ fontSize: "13px", fontFamily: fonts.mono }}>Scanned tag: {scannedUid}</p>
            <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: colors.inkSoft, marginBottom: "6px" }}>Assign to</label>
            <select required value={assignProfileId} onChange={(e) => setAssignProfileId(e.target.value)} style={fieldStyle}>
              <option value="">—</option>
              {people.map((p) => (
                <option key={p.id} value={p.id}>{p.display_name}</option>
              ))}
            </select>
            <div style={{ display: "flex", gap: "8px" }}>
              <button type="submit" style={buttonStyle.primary}>Save</button>
              <button type="button" onClick={() => setScannedUid(null)} style={buttonStyle.secondary}>Cancel</button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
