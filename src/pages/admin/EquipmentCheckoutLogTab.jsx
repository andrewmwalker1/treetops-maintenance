import { useEffect, useMemo, useState, useCallback } from "react";
import { useAuth } from "../../lib/AuthContext.jsx";
import { supabase } from "../../lib/supabaseClient.js";
import { queryEquipmentCheckouts } from "../../lib/equipmentCheckoutsQuery.js";
import { exportEquipmentCheckoutsCsv } from "../../lib/csvExport.js";
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
  cursor: "pointer",
  userSelect: "none",
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

export default function EquipmentCheckoutLogTab() {
  const { org, profile } = useAuth();
  const [equipmentTypes, setEquipmentTypes] = useState([]);
  const [equipment, setEquipment] = useState([]);
  const [people, setPeople] = useState([]);
  const [checkouts, setCheckouts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState(null);

  const [status, setStatus] = useState("all");
  const [equipmentTypeId, setEquipmentTypeId] = useState("");
  const [equipmentId, setEquipmentId] = useState("");
  const [profileId, setProfileId] = useState("");
  const [faultsOnly, setFaultsOnly] = useState(false);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState({ field: "checked_out_at", direction: "desc" });

  useEffect(() => {
    if (!org) return;
    supabase.from("equipment_types").select("id, name").eq("org_id", org.id).order("name").then(({ data }) => setEquipmentTypes(data || []));
    supabase.from("equipment").select("id, name, equipment_type_id").eq("org_id", org.id).order("name").then(({ data }) => setEquipment(data || []));
    supabase.from("profiles").select("id, display_name").eq("org_id", org.id).order("display_name").then(({ data }) => setPeople(data || []));
  }, [org]);

  const filters = useMemo(
    () => ({
      status: status === "all" ? undefined : status,
      equipmentTypeId: equipmentTypeId || undefined,
      equipmentId: equipmentId || undefined,
      profileId: profileId || undefined,
      faultsOnly: faultsOnly || undefined,
      from: from ? new Date(from).toISOString() : undefined,
      // End-of-day so a "to" date includes checkouts made that day.
      to: to ? new Date(`${to}T23:59:59.999`).toISOString() : undefined,
    }),
    [status, equipmentTypeId, equipmentId, profileId, faultsOnly, from, to]
  );

  const refresh = useCallback(() => {
    setLoading(true);
    setError(null);
    queryEquipmentCheckouts(filters)
      .then(setCheckouts)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [filters]);

  useEffect(refresh, [refresh]);

  const visibleEquipment = equipmentTypeId ? equipment.filter((e) => e.equipment_type_id === equipmentTypeId) : equipment;

  const visibleCheckouts = useMemo(() => {
    let rows = checkouts;
    const q = search.trim().toLowerCase();
    if (q) {
      rows = rows.filter((c) =>
        [c.equipment?.name, c.checked_out_by?.display_name, c.checked_in_by_profile?.display_name, c.fault?.description]
          .filter(Boolean)
          .some((v) => v.toLowerCase().includes(q))
      );
    }

    const dir = sort.direction === "asc" ? 1 : -1;
    const getValue = (c) => {
      switch (sort.field) {
        case "equipment":
          return c.equipment?.name || "";
        case "checked_out_by":
          return c.checked_out_by?.display_name || "";
        case "checked_in_at":
          return c.checked_in_at || "";
        case "fault":
          return c.fault ? 1 : 0;
        default:
          return c.checked_out_at || "";
      }
    };
    return [...rows].sort((a, b) => {
      const va = getValue(a);
      const vb = getValue(b);
      if (va < vb) return -1 * dir;
      if (va > vb) return 1 * dir;
      return 0;
    });
  }, [checkouts, search, sort]);

  function toggleSort(field) {
    setSort((prev) => (prev.field === field ? { field, direction: prev.direction === "asc" ? "desc" : "asc" } : { field, direction: "asc" }));
  }

  function sortIndicator(field) {
    if (sort.field !== field) return "";
    return sort.direction === "asc" ? " ↑" : " ↓";
  }

  async function handleForceCheckIn(checkoutId) {
    if (!window.confirm("Force check this item in? Use this if a team member forgot to check it in themselves.")) return;
    const { error: err } = await supabase.rpc("admin_force_check_in", { p_checkout_id: checkoutId });
    if (err) setError(err.message);
    else refresh();
  }

  async function handleExport() {
    setExporting(true);
    setError(null);
    try {
      await exportEquipmentCheckoutsCsv({ orgId: org.id, profileId: profile.id, filters });
    } catch (err) {
      setError(err.message);
    } finally {
      setExporting(false);
    }
  }

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "12px", marginBottom: "6px", flexWrap: "wrap" }}>
        <h2 style={{ fontFamily: fonts.display, fontSize: "16px", color: colors.mossDark, margin: 0 }}>Equipment checkout log</h2>
        <button onClick={handleExport} disabled={exporting || loading} style={buttonStyle.secondary}>
          {exporting ? "Exporting…" : "Export CSV"}
        </button>
      </div>
      <p style={{ fontSize: "13px", color: colors.inkSoft, marginTop: 0 }}>
        Who checked what out and back in, when, and any fault logged against a check-in.
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
        <label style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "13px", color: colors.inkSoft, marginLeft: "4px" }}>
          <input type="checkbox" checked={faultsOnly} onChange={(e) => setFaultsOnly(e.target.checked)} />
          Faults only
        </label>
      </div>

      <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginBottom: "10px" }}>
        <select
          value={equipmentTypeId}
          onChange={(e) => {
            setEquipmentTypeId(e.target.value);
            setEquipmentId("");
          }}
          style={fieldStyle}
        >
          <option value="">All equipment types</option>
          {equipmentTypes.map((t) => (
            <option key={t.id} value={t.id}>{t.name}</option>
          ))}
        </select>

        <select value={equipmentId} onChange={(e) => setEquipmentId(e.target.value)} style={fieldStyle}>
          <option value="">All equipment</option>
          {visibleEquipment.map((e) => (
            <option key={e.id} value={e.id}>{e.name}</option>
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

        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search…"
          style={{ ...fieldStyle, flex: 1, minWidth: "160px" }}
        />
      </div>

      {error && <p style={{ color: colors.immediate, fontSize: "13px" }}>{error}</p>}
      {loading && <p style={{ color: colors.inkSoft }}>Loading…</p>}
      {!loading && visibleCheckouts.length === 0 && <p style={{ color: colors.inkSoft }}>No checkouts match this view.</p>}

      {!loading && visibleCheckouts.length > 0 && (
        <div style={{ ...cardStyle, overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={thStyle} onClick={() => toggleSort("equipment")}>Equipment{sortIndicator("equipment")}</th>
                <th style={thStyle} onClick={() => toggleSort("checked_out_by")}>Checked out by{sortIndicator("checked_out_by")}</th>
                <th style={thStyle} onClick={() => toggleSort("checked_out_at")}>Checked out at{sortIndicator("checked_out_at")}</th>
                <th style={thStyle} onClick={() => toggleSort("checked_in_at")}>Checked in{sortIndicator("checked_in_at")}</th>
                <th style={thStyle} onClick={() => toggleSort("fault")}>Fault{sortIndicator("fault")}</th>
                <th style={thStyle} />
              </tr>
            </thead>
            <tbody>
              {visibleCheckouts.map((c) => (
                <tr key={c.id}>
                  <td style={tdStyle}>
                    <div style={{ fontWeight: 600 }}>{c.equipment?.name}</div>
                    {c.equipment?.equipment_type?.name && <div style={{ fontSize: "12px", color: colors.inkSoft }}>{c.equipment.equipment_type.name}</div>}
                  </td>
                  <td style={tdStyle}>{c.checked_out_by?.display_name || "—"}</td>
                  <td style={tdStyle}>{formatDateTime(c.checked_out_at)}</td>
                  <td style={tdStyle}>
                    {c.checked_in_at ? (
                      <>
                        {formatDateTime(c.checked_in_at)}
                        {c.checked_in_by_profile?.display_name && (
                          <div style={{ fontSize: "12px", color: colors.inkSoft }}>by {c.checked_in_by_profile.display_name}</div>
                        )}
                      </>
                    ) : (
                      <span style={{ color: colors.clay, fontWeight: 600 }}>Still out</span>
                    )}
                  </td>
                  <td style={tdStyle}>
                    {c.fault ? (
                      <span style={{ color: colors.immediate }} title={c.fault.description}>
                        {c.fault.description}
                      </span>
                    ) : (
                      "—"
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
