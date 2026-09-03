import { useEffect, useMemo, useState, useCallback } from "react";
import { useAuth } from "../../lib/AuthContext.jsx";
import { supabase } from "../../lib/supabaseClient.js";
import { queryEquipmentHistory } from "../../lib/equipmentCheckoutsQuery.js";
import { exportEquipmentCheckoutsCsv } from "../../lib/csvExport.js";
import { colors, space } from "../../lib/theme.js";
import { Alert, Button, Card, Chip, EmptyState, IconArrowDown, IconArrowUp, Input, PageHeader, Select, SkeletonList, Table } from "../../ui/index.js";

const EVENT_TYPE = {
  checkout: { label: "Checkout", color: colors.gold },
  fault: { label: "Fault", color: colors.immediate },
  repair: { label: "Repair", color: colors.moss },
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
    if (sort.field !== field) return null;
    return sort.direction === "asc" ? <IconArrowUp size={13} /> : <IconArrowDown size={13} />;
  }

  // Screen readers announce a sortable column's current direction from
  // this, which the old click-handler-on-a-th version had no way to
  // express.
  function ariaSort(field) {
    if (sort.field !== field) return "none";
    return sort.direction === "asc" ? "ascending" : "descending";
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
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "var(--space-3)", marginBottom: "var(--space-2)", flexWrap: "wrap" }}>
        <PageHeader title="Equipment history" level={2} />
        <Button onClick={handleExport} disabled={exporting || loading}>
          {exporting ? "Exporting…" : "Export CSV"}
        </Button>
      </div>
      <p style={{ fontSize: "var(--text-sm)", color: colors.inkSoft, marginTop: 0 }}>
        Every checkout, fault, and repair, so you can see a machine's full history in one place.
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
        <label style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", fontSize: "var(--text-sm)", color: colors.inkSoft, marginLeft: "var(--space-1)" }}>
          <input type="checkbox" checked={faultsOnly} onChange={(e) => setFaultsOnly(e.target.checked)} />
          Faults &amp; repairs only
        </label>
      </div>

      <div style={{ display: "flex", gap: "var(--space-2)", flexWrap: "wrap", marginBottom: "var(--space-3)" }}>
        <Select value={equipmentTypeId} onChange={(e) => { setEquipmentTypeId(e.target.value); setEquipmentId(""); }}>
          <option value="">All equipment types</option>
          {equipmentTypes.map((t) => (
            <option key={t.id} value={t.id}>{t.name}</option>
          ))}
        </Select>

        <Select value={equipmentId} onChange={(e) => setEquipmentId(e.target.value)}>
          <option value="">All equipment</option>
          {visibleEquipment.map((e) => (
            <option key={e.id} value={e.id}>{e.name}</option>
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

        <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search…" style={{ flex: 1 }} />
      </div>

      {error && (
        <Alert tone="danger" title="Something went wrong">
          {error}
        </Alert>
      )}
      {loading && <SkeletonList rows={3} />}
      {!loading && visibleEvents.length === 0 && <EmptyState title="No history matches this view" />}

      {!loading && visibleEvents.length > 0 && (
        <Card pad="md" style={{ overflowX: "auto" }}>
          <Table>
            <thead>
              <tr>
                {[
                  ["equipment", "Equipment"],
                  ["type", "Event"],
                  ["details", "Details"],
                  ["person", "Person"],
                  ["date", "Date"],
                ].map(([field, label]) => (
                  <th key={field} aria-sort={ariaSort(field)}>
                    <button type="button" className="tt-sortbtn" onClick={() => toggleSort(field)}>
                      {label}
                      {sortIndicator(field)}
                    </button>
                  </th>
                ))}
                <th />
              </tr>
            </thead>
            <tbody>
              {visibleEvents.map((e) => (
                <tr key={e.id}>
                  <td>
                    <div style={{ fontWeight: 600 }}>{e.equipment?.name}</div>
                    {e.equipment?.equipment_type?.name && <div style={{ fontSize: "var(--text-xs)", color: colors.inkSoft }}>{e.equipment.equipment_type.name}</div>}
                  </td>
                  <td>
                    <span style={{ color: EVENT_TYPE[e.type]?.color, fontWeight: 600 }}>{EVENT_TYPE[e.type]?.label || e.type}</span>
                  </td>
                  <td title={e.details}>
                    {e.type === "checkout" && !e.raw.checked_in_at ? (
                      <span style={{ color: colors.clay, fontWeight: 600 }}>{e.details}</span>
                    ) : (
                      e.details || "—"
                    )}
                  </td>
                  <td>{e.person || "—"}</td>
                  <td>{formatDateTime(e.date)}</td>
                  <td>
                    {e.type === "checkout" && !e.raw.checked_in_at && (
                      <Button size="sm" onClick={() => handleForceCheckIn(e.raw.id)}>
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
