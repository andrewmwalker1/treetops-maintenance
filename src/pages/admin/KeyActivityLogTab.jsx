import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "../../lib/AuthContext.jsx";
import { supabase } from "../../lib/supabaseClient.js";
import { queryKeyCheckouts } from "../../lib/keyCheckoutsQuery.js";
import { formatKeyLocation } from "../../keys/KeySelector.jsx";
import { colors } from "../../lib/theme.js";
import { Alert, Button, Card, Chip, EmptyState, Input, PageHeader, Select, SkeletonList, Table } from "../../ui/index.js";

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
      <PageHeader title="Key activity log" level={2} />
      <p style={{ fontSize: "var(--text-sm)", color: colors.inkSoft, marginTop: 0 }}>
        Every key check-out and check-in.
      </p>

      <div style={{ display: "flex", gap: "var(--space-2)", flexWrap: "wrap", marginBottom: "var(--space-3)" }}>
        {STATUS_CHIPS.map((s) => (
          <Chip
            key={s.key}
            active={status === s.key}
            onClick={() => setStatus(s.key)}
          >
            {s.label}
          </Chip>
        ))}
      </div>

      <div style={{ display: "flex", gap: "var(--space-2)", flexWrap: "wrap", marginBottom: "var(--space-3)" }}>
        <Select value={location} onChange={(e) => setLocation(e.target.value)}>
          <option value="">All locations</option>
          {pitches.map((p) => (
            <option key={p.id} value={`pitch:${p.id}`}>{p.pitch_number_or_name}</option>
          ))}
          {specialLocations.map((s) => (
            <option key={s.id} value={`special:${s.id}`}>{s.label}</option>
          ))}
        </Select>

        <Select value={profileId} onChange={(e) => setProfileId(e.target.value)}>
          <option value="">Everyone</option>
          {people.map((p) => (
            <option key={p.id} value={p.id}>{p.display_name}</option>
          ))}
        </Select>

        <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} title="From date" />
        <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} title="To date" />
      </div>

      {error && (
        <Alert tone="danger" title="Something went wrong">
          {error}
        </Alert>
      )}
      {loading && <SkeletonList rows={3} />}
      {!loading && checkouts.length === 0 && (
        <EmptyState
          title="No activity matches this view"
          action={
            <Button
              variant="primary"
              onClick={() => {
                setStatus("all");
                setLocation("");
                setProfileId("");
                setFrom("");
                setTo("");
              }}
            >
              Clear filters
            </Button>
          }
        />
      )}

      {!loading && checkouts.length > 0 && (
        <Card pad="md" style={{ overflowX: "auto" }}>
          <Table>
            <thead>
              <tr>
                <th>Pitch / location</th>
                <th>Issued to</th>
                <th>Reason</th>
                <th>Checked out</th>
                <th>Checked in</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {checkouts.map((c) => (
                <tr key={c.id}>
                  <td>{locationLabel(c)}</td>
                  <td>{issuedToLabel(c)}</td>
                  <td>{c.reason}</td>
                  <td>
                    {formatDateTime(c.checked_out_at)}
                    <div style={{ fontSize: "var(--text-xs)", color: colors.inkSoft }}>by {c.checked_out_by_profile?.display_name || "—"}</div>
                  </td>
                  <td>
                    {c.checked_in_at ? (
                      <>
                        {formatDateTime(c.checked_in_at)}
                        <div style={{ fontSize: "var(--text-xs)", color: colors.inkSoft }}>by {c.checked_in_by_profile?.display_name || "—"}</div>
                      </>
                    ) : (
                      <span style={{ color: colors.clay, fontWeight: 600 }}>Still out</span>
                    )}
                  </td>
                  <td>
                    {!c.checked_in_at && (
                      <Button size="sm" onClick={() => handleForceCheckIn(c.id)}>
                        Force check-in
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Card>
      )}
    </div>
  );
}
