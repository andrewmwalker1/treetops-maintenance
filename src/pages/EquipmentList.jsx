import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useAuth } from "../lib/AuthContext.jsx";
import { supabase } from "../lib/supabaseClient.js";
import { colors } from "../lib/theme.js";
import { Button, Card, EmptyState, PageHeader, Pill, SkeletonList } from "../ui/index.js";

const statusColors = {
  in_service: colors.moss,
  faulty: colors.immediate,
  in_repair: colors.gold,
  scrapped: colors.inkSoft,
  decommissioned: colors.inkSoft,
};

const statusLabels = {
  in_service: "In service",
  faulty: "Faulty",
  in_repair: "In repair",
  scrapped: "Scrapped",
  decommissioned: "Decommissioned",
};

export default function EquipmentList() {
  const { org, activeSite } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const statusFilter = searchParams.get("status");
  const [equipment, setEquipment] = useState([]);
  const [loading, setLoading] = useState(true);

  function refresh() {
    setLoading(true);
    let query = supabase
      .from("equipment")
      .select("id, name, make, model, status, site_id, held_by_profile_id, equipment_type:equipment_types(name), held_by:profiles!equipment_held_by_profile_id_fkey(display_name)");
    if (statusFilter) query = query.eq("status", statusFilter);
    query.then(({ data, error }) => {
      if (error) console.error(error);
      setEquipment(data || []);
      setLoading(false);
    });
  }

  useEffect(refresh, [org, activeSite, statusFilter]);

  return (
    <div>
      <PageHeader title="Equipment" />

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
      {!loading && equipment.length === 0 && (
        <EmptyState
          title={statusFilter ? "No equipment with that status" : "No equipment yet"}
          action={
            statusFilter ? (
              <Button variant="primary" onClick={() => setSearchParams({})}>
                Show all equipment
              </Button>
            ) : null
          }
        >
          {statusFilter ? "Clear the filter to see the rest of the fleet." : "Equipment is added under Settings and admin."}
        </EmptyState>
      )}

      {equipment.map((eq) => (
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
