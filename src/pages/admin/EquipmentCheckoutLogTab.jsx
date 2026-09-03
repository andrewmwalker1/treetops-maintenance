import { useEffect, useMemo, useState, useCallback } from "react";
import { useAuth } from "../../lib/AuthContext.jsx";
import { supabase } from "../../lib/supabaseClient.js";
import { queryEquipmentHistory } from "../../lib/equipmentCheckoutsQuery.js";
import { exportEquipmentCheckoutsCsv } from "../../lib/csvExport.js";
import { colors, fonts, cardStyle, buttonStyle } from "../../lib/theme.js";

const EVENT_TYPE = {
  checkout: { label: "Checkout", color: colors.gold },
  fault: { label: "Fault", color: colors.immediate },
  repair: { label: "Repair", color: colors.moss },
};

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
  const [events, setEvents] = useState([]);
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
  const [sort, setSort] = useState({ field: "date", direction: "desc" });

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
    queryEquipmentHistory(filters)
      .then(setEvents)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [filters]);

  useEffect(refresh, [refresh]);

  const visibleEquipment = equipmentTypeId ? equipment.filter((e) => e.equipment_type_id === equipmentTypeId) : equipment;

  const visibleEvents = useMemo(() => {
    let rows = events;
    const q = search.trim().toLowerCase();
    if (q) {
      rows = rows.filter((e) =>
        [e.equipment?.name, e.person, e.details]
          .filter(Boolean)
          .some((v) => v.toLowerCase().includes(q))
      );
    }

    const dir = sort.direction === "asc" ? 1 : -1;
    const getValue = (e) => {
      switch (sort.field) {
        case "equipment":
          return e.equipment?.name || "";
        case "type":
          return EVENT_TYPE[e.type]?.label || "";
        case "details":
          return e.details || "";
        case "person":
          return e.person || "";
        default:
          return e.date || "";
      }
    };
    return [...rows].sort((a, b) => {
      const va = getValue(a);
      const vb = getValue(b);
      if (va < vb) return -1 * dir;
      if (va > vb) return 1 * dir;
      return 0;
    });
  }, [events, search, sort]);

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

  // Exports visibleEvents (this tab's own filtered/searched/sorted list),
  // not a fresh query off `filters` alone -- otherwise a search term or
  // column sort applied on screen wouldn't carry through to the file, and
  // the export would silently include rows the table isn't even showing.
  async function handleExport() {
    setExporting(true);
    setError(null);
    try {
      await exportEquipmentCheckoutsCsv({
        orgId: org.id,
        profileId: profile.id,
        filters: { ...filters, search: search.trim() || undefined, sort },
        events: visibleEvents,
      });
    } catch (err) {
      setError(err.message);
    } finally {
      setExporting(false);
    }
  }

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "12px", marginBottom: "6px", flexWrap: "wrap" }}>
        <h2 style={{ fontFamily: fonts.display, fontSize: "16px", color: colors.mossDark, margin: 0 }}>Equipment history</h2>
        <button onClick={handleExport} disabled={exporting || loading} style={buttonStyle.secondary}>
          {exporting ? "Exporting…" : "Export CSV"}
        </button>
      </div>
      <p style={{ fontSize: "13px", color: colors.inkSoft, marginTop: 0 }}>
        Every checkout, fault, and repair, so you can see a machine's full history in one place.
      </p>

      <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginBottom: "10px" }}>
        {STATUS_CHIPS.map((s) => (
          <button
            key={s.key}
            onClick={() => setStatus(s.key)}
            style={{
              border: `1px solid ${status === s.key ? colors.mossDark : colors.lineStrong}`,
              background: status === s.key ? colors.mossDark : "transparent",
              color: status === s.key ? colors.onDark : colors.inkSoft,
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
          Faults &amp; repairs only
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
      {!loading && visibleEvents.length === 0 && <p style={{ color: colors.inkSoft }}>No history matches this view.</p>}

      {!loading && visibleEvents.length > 0 && (
        <div style={{ ...cardStyle, overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={thStyle} onClick={() => toggleSort("equipment")}>Equipment{sortIndicator("equipment")}</th>
                <th style={thStyle} onClick={() => toggleSort("type")}>Event{sortIndicator("type")}</th>
                <th style={thStyle} onClick={() => toggleSort("details")}>Details{sortIndicator("details")}</th>
                <th style={thStyle} onClick={() => toggleSort("person")}>Person{sortIndicator("person")}</th>
                <th style={thStyle} onClick={() => toggleSort("date")}>Date{sortIndicator("date")}</th>
                <th style={thStyle} />
              </tr>
            </thead>
            <tbody>
              {visibleEvents.map((e) => (
                <tr key={e.id}>
                  <td style={tdStyle}>
                    <div style={{ fontWeight: 600 }}>{e.equipment?.name}</div>
                    {e.equipment?.equipment_type?.name && <div style={{ fontSize: "12px", color: colors.inkSoft }}>{e.equipment.equipment_type.name}</div>}
                  </td>
                  <td style={tdStyle}>
                    <span style={{ color: EVENT_TYPE[e.type]?.color, fontWeight: 600 }}>{EVENT_TYPE[e.type]?.label || e.type}</span>
                  </td>
                  <td style={tdStyle} title={e.details}>
                    {e.type === "checkout" && !e.raw.checked_in_at ? (
                      <span style={{ color: colors.clay, fontWeight: 600 }}>{e.details}</span>
                    ) : (
                      e.details || "—"
                    )}
                  </td>
                  <td style={tdStyle}>{e.person || "—"}</td>
                  <td style={tdStyle}>{formatDateTime(e.date)}</td>
                  <td style={tdStyle}>
                    {e.type === "checkout" && !e.raw.checked_in_at && (
                      <button onClick={() => handleForceCheckIn(e.raw.id)} style={{ ...buttonStyle.secondary, padding: "4px 12px", fontSize: "12px" }}>
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
