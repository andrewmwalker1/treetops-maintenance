import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "../../lib/AuthContext.jsx";
import { supabase } from "../../lib/supabaseClient.js";
import { queryKeyCheckouts } from "../../lib/keyCheckoutsQuery.js";
import { formatKeyLocation } from "../../keys/KeySelector.jsx";
import { colors, fonts, cardStyle, buttonStyle } from "../../lib/theme.js";

const fieldStyle = {
  padding: "8px 12px",
  borderRadius: "8px",
  border: `1px solid ${colors.lineStrong}`,
  fontFamily: fonts.body,
  fontSize: "13px",
};

const thStyle = {
  textAlign: "left",
  padding: "8px 10px",
  fontSize: "12px",
  color: colors.inkSoft,
  whiteSpace: "nowrap",
};

const tdStyle = {
  padding: "8px 10px",
  fontSize: "13px",
  borderTop: `1px solid ${colors.line}`,
  verticalAlign: "top",
};

const STATUS_CHIPS = [
  { key: "all", label: "All" },
  { key: "open", label: "Currently out" },
  { key: "closed", label: "Returned" },
];

function formatDateTime(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  return `${d.toLocaleDateString("en-GB")} ${d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}`;
}

function locationLabel(checkout) {
  return formatKeyLocation(checkout.key_tags?.pitches?.pitch_number_or_name, checkout.key_tags?.key_special_locations?.label);
}

function issuedToLabel(checkout) {
  if (checkout.issued_to_kind === "self") return checkout.checked_out_by_profile?.display_name || "—";
  if (checkout.issued_to_kind === "contractor") return checkout.issued_to_contractor?.name || checkout.issued_to_name || "Contractor";
  return checkout.issued_to_name || (checkout.issued_to_kind === "guest" ? "Guest" : "Customer");
}

export default function KeyActivityLogTab() {
  const { org, activeSite } = useAuth();
  const [pitches, setPitches] = useState([]);
  const [specialLocations, setSpecialLocations] = useState([]);
  const [people, setPeople] = useState([]);
  const [checkouts, setCheckouts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [status, setStatus] = useState("all");
  const [location, setLocation] = useState(""); // "" | "pitch:<id>" | "special:<id>"
  const [profileId, setProfileId] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  useEffect(() => {
    if (!org || !activeSite) return;
    supabase.from("pitches").select("id, pitch_number_or_name").eq("site_id", activeSite.id).order("pitch_number_or_name").then(({ data }) => setPitches(data || []));
    supabase.from("key_special_locations").select("id, label").eq("site_id", activeSite.id).order("label").then(({ data }) => setSpecialLocations(data || []));
    supabase.from("profiles").select("id, display_name").eq("org_id", org.id).order("display_name").then(({ data }) => setPeople(data || []));
  }, [org, activeSite]);

  const [locationKind, locationId] = location.split(":");

  const filters = useMemo(
    () => ({
      siteId: activeSite?.id,
      status: status === "all" ? undefined : status,
      pitchId: locationKind === "pitch" ? locationId : undefined,
      specialLocationId: locationKind === "special" ? locationId : undefined,
      profileId: profileId || undefined,
      from: from ? new Date(from).toISOString() : undefined,
      // End-of-day so a "to" date includes checkouts made that day.
      to: to ? new Date(`${to}T23:59:59.999`).toISOString() : undefined,
    }),
    [activeSite, status, locationKind, locationId, profileId, from, to]
  );

  const refresh = useCallback(() => {
    if (!activeSite) return;
    setLoading(true);
    setError(null);
    queryKeyCheckouts(filters)
      .then(setCheckouts)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [filters, activeSite]);

  useEffect(refresh, [refresh]);

  async function handleForceCheckIn(checkoutId) {
    if (!window.confirm("Force check this key in? Use this if it's a stuck or forgotten checkout.")) return;
    const { error: err } = await supabase.rpc("admin_force_check_in_key", { p_checkout_id: checkoutId });
    if (err) setError(err.message);
    else refresh();
  }

  return (
    <div>
      <h2 style={{ fontFamily: fonts.display, fontSize: "16px", color: colors.mossDark, marginTop: 0 }}>Key activity log</h2>
      <p style={{ fontSize: "13px", color: colors.inkSoft, marginTop: 0 }}>
        Every key check-out and check-in.
      </p>

      <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginBottom: "10px" }}>
        {STATUS_CHIPS.map((s) => (
          <button
            key={s.key}
            onClick={() => setStatus(s.key)}
            style={{
              border: `1px solid ${status === s.key ? colors.mossDark : colors.lineStrong}`,
              background: status === s.key ? colors.mossDark : "transparent",
              color: status === s.key ? "#FFFFFF" : colors.inkSoft,
              borderRadius: "999px",
              padding: "6px 14px",
              fontFamily: fonts.body,
              fontSize: "13px",
              cursor: "pointer",
            }}
          >
            {s.label}
          </button>
        ))}
      </div>

      <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginBottom: "10px" }}>
        <select value={location} onChange={(e) => setLocation(e.target.value)} style={fieldStyle}>
          <option value="">All locations</option>
          {pitches.map((p) => (
            <option key={p.id} value={`pitch:${p.id}`}>{p.pitch_number_or_name}</option>
          ))}
          {specialLocations.map((s) => (
            <option key={s.id} value={`special:${s.id}`}>{s.label}</option>
          ))}
        </select>

        <select value={profileId} onChange={(e) => setProfileId(e.target.value)} style={fieldStyle}>
          <option value="">Everyone</option>
          {people.map((p) => (
            <option key={p.id} value={p.id}>{p.display_name}</option>
          ))}
        </select>

        <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} style={fieldStyle} title="From date" />
        <input type="date" value={to} onChange={(e) => setTo(e.target.value)} style={fieldStyle} title="To date" />
      </div>

      {error && <p style={{ color: colors.immediate, fontSize: "13px" }}>{error}</p>}
      {loading && <p style={{ color: colors.inkSoft }}>Loading…</p>}
      {!loading && checkouts.length === 0 && <p style={{ color: colors.inkSoft }}>No activity matches this view.</p>}

      {!loading && checkouts.length > 0 && (
        <div style={{ ...cardStyle, overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={thStyle}>Pitch / location</th>
                <th style={thStyle}>Issued to</th>
                <th style={thStyle}>Reason</th>
                <th style={thStyle}>Checked out</th>
                <th style={thStyle}>Checked in</th>
                <th style={thStyle} />
              </tr>
            </thead>
            <tbody>
              {checkouts.map((c) => (
                <tr key={c.id}>
                  <td style={tdStyle}>{locationLabel(c)}</td>
                  <td style={tdStyle}>{issuedToLabel(c)}</td>
                  <td style={tdStyle}>{c.reason}</td>
                  <td style={tdStyle}>
                    {formatDateTime(c.checked_out_at)}
                    <div style={{ fontSize: "11px", color: colors.inkSoft }}>by {c.checked_out_by_profile?.display_name || "—"}</div>
                  </td>
                  <td style={tdStyle}>
                    {c.checked_in_at ? (
                      <>
                        {formatDateTime(c.checked_in_at)}
                        <div style={{ fontSize: "11px", color: colors.inkSoft }}>by {c.checked_in_by_profile?.display_name || "—"}</div>
                      </>
                    ) : (
                      <span style={{ color: colors.clay, fontWeight: 600 }}>Still out</span>
                    )}
                  </td>
                  <td style={tdStyle}>
                    {!c.checked_in_at && (
                      <button onClick={() => handleForceCheckIn(c.id)} style={{ ...buttonStyle.secondary, padding: "4px 12px", fontSize: "12px" }}>
                        Force check-in
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
