import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useAuth } from "../lib/AuthContext.jsx";
import { supabase } from "../lib/supabaseClient.js";
import { colors } from "../lib/theme.js";
import { Button, Card, EmptyState, IconArrowLeft, IconChevronRight, PageHeader, Pill, SkeletonList } from "../ui/index.js";

const statusColors = {
  in_service: colors.moss,
  monitor: colors.gold,
  faulty: colors.immediate,
  in_repair: colors.gold,
  scrapped: colors.inkSoft,
  decommissioned: colors.inkSoft,
};

const statusLabels = {
  in_service: "In service",
  monitor: "Monitor",
  faulty: "Faulty",
  in_repair: "In repair",
  scrapped: "Scrapped",
  decommissioned: "Decommissioned",
};

// Anything other than "in service" is worth surfacing on a group's tile,
// before drilling in -- the whole point is spotting a problem machine
// without opening every group to look for it.
const ATTENTION_STATUSES = new Set(["monitor", "faulty", "in_repair"]);

// Sentinel for equipment with no equipment_type_id, since a real "" would
// be indistinguishable from "no ?type= param at all" (both falsy) when
// deciding whether to show the group picker or a drilled-in list.
const UNCATEGORISED_TYPE_ID = "none";

export default function EquipmentList() {
  const { org, activeSite } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const statusFilter = searchParams.get("status");
  const typeId = searchParams.get("type");
  const [equipment, setEquipment] = useState([]);
  const [types, setTypes] = useState([]);
  const [loading, setLoading] = useState(true);

  function refresh() {
    setLoading(true);
    Promise.all([
      supabase
        .from("equipment")
        .select(
          "id, name, make, model, status, equipment_type_id, site_id, held_by_profile_id, equipment_type:equipment_types(name), held_by:profiles!equipment_held_by_profile_id_fkey(display_name)"
        ),
      supabase.from("equipment_types").select("id, name").order("sort_order"),
    ]).then(([{ data: eq, error: eqErr }, { data: t, error: tErr }]) => {
      if (eqErr) console.error(eqErr);
      if (tErr) console.error(tErr);
      setEquipment(eq || []);
      setTypes(t || []);
      setLoading(false);
    });
  }

  useEffect(refresh, [org, activeSite]);

  // A status deep-link (from the Dashboard's "N faulty" etc.) means "every
  // machine with this status, regardless of type" -- same flat cross-group
  // list as before groups existed, so it skips the picker entirely.
  const showGroups = !statusFilter && !typeId;

  const visibleEquipment = equipment.filter((eq) => {
    if (statusFilter && eq.status !== statusFilter) return false;
    if (typeId && (eq.equipment_type_id || UNCATEGORISED_TYPE_ID) !== typeId) return false;
    return true;
  });

  const groups = showGroups
    ? [...types, { id: null, name: "Uncategorised" }]
        .map((t) => {
          const members = equipment.filter((eq) => (eq.equipment_type_id || UNCATEGORISED_TYPE_ID) === (t.id || UNCATEGORISED_TYPE_ID));
          return { ...t, count: members.length, attentionCount: members.filter((eq) => ATTENTION_STATUSES.has(eq.status)).length };
        })
        .filter((g) => g.count > 0)
    : [];

  const selectedType = typeId && typeId !== UNCATEGORISED_TYPE_ID ? types.find((t) => t.id === typeId) : null;

  return (
    <div>
      <PageHeader title="Equipment" />

      {typeId && (
        <Button
          size="sm"
          variant="ghost"
          icon={<IconArrowLeft size={15} />}
          onClick={() => setSearchParams({})}
          style={{ marginBottom: "var(--space-3)" }}
        >
          All groups
        </Button>
      )}

      {statusFilter && (
        <Card
          pad="sm"
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "var(--space-3)",
            marginBottom: "var(--space-3)",
          }}
        >
          <span style={{ fontSize: "var(--text-sm)", color: colors.mossDark }}>
            Showing: {statusLabels[statusFilter] || statusFilter}
          </span>
          <Button size="sm" variant="ghost" onClick={() => setSearchParams({})}>
            Clear
          </Button>
        </Card>
      )}

      {loading && <SkeletonList rows={4} height={70} />}

      {!loading && showGroups && groups.length === 0 && (
        <EmptyState title="No equipment yet">Equipment is added under Settings and admin.</EmptyState>
      )}

      {!loading &&
        showGroups &&
        groups.map((g) => (
          <Card
            key={g.id || "uncategorised"}
            as={Link}
            to={`/equipment?type=${g.id || UNCATEGORISED_TYPE_ID}`}
            pad="sm"
            interactive
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: "var(--space-3)",
              marginBottom: "var(--space-2)",
              textDecoration: "none",
              color: colors.ink,
            }}
          >
            <div>
              <div style={{ fontWeight: 600 }}>{g.name}</div>
              <div style={{ fontSize: "var(--text-sm)", color: colors.inkSoft }}>
                {g.count} machine{g.count === 1 ? "" : "s"}
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)" }}>
              {g.attentionCount > 0 && (
                <Pill tone="warn">
                  {g.attentionCount} need{g.attentionCount === 1 ? "s" : ""} attention
                </Pill>
              )}
              <IconChevronRight size={16} style={{ color: colors.inkSoft, flexShrink: 0 }} />
            </div>
          </Card>
        ))}

      {!loading && !showGroups && (
        <PageHeader title={selectedType ? selectedType.name : typeId === UNCATEGORISED_TYPE_ID ? "Uncategorised" : "Equipment"} level={2} />
      )}

      {!loading && !showGroups && visibleEquipment.length === 0 && (
        <EmptyState
          title={statusFilter ? "No equipment with that status" : "No machines in this group"}
          action={
            <Button variant="primary" onClick={() => setSearchParams({})}>
              {statusFilter ? "Show all equipment" : "All groups"}
            </Button>
          }
        >
          {statusFilter ? "Clear the filter to see the rest of the fleet." : null}
        </EmptyState>
      )}

      {!loading &&
        !showGroups &&
        visibleEquipment.map((eq) => (
          <Card
            key={eq.id}
            as={Link}
            to={`/equipment/${eq.id}`}
            pad="sm"
            interactive
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: "var(--space-3)",
              marginBottom: "var(--space-2)",
              textDecoration: "none",
              color: colors.ink,
            }}
          >
            <div>
              <div style={{ fontWeight: 600 }}>
                {eq.name}
                {eq.equipment_type && <span style={{ fontWeight: 400, color: colors.inkSoft }}> · {eq.equipment_type.name}</span>}
              </div>
              <div style={{ fontSize: "var(--text-sm)", color: colors.inkSoft }}>
                {[eq.make, eq.model].filter(Boolean).join(" ")}
                {eq.held_by && `${eq.make || eq.model ? " · " : ""}Held by ${eq.held_by.display_name}`}
              </div>
            </div>
            <Pill color={statusColors[eq.status]}>{statusLabels[eq.status]}</Pill>
          </Card>
        ))}
    </div>
  );
}
