import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useAuth } from "../lib/AuthContext.jsx";
import { supabase } from "../lib/supabaseClient.js";
import { colors, fonts, cardStyle } from "../lib/theme.js";

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
      <h1 style={{ fontFamily: fonts.display, color: colors.mossDark, marginTop: 0 }}>Equipment</h1>

      {statusFilter && (
        <div
          style={{
            ...cardStyle,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "12px",
            padding: "8px 16px",
            marginBottom: "12px",
            fontFamily: fonts.body,
            fontSize: "13px",
            color: colors.mossDark,
          }}
        >
          <span style={{ textTransform: "capitalize" }}>Showing: {statusLabels[statusFilter] || statusFilter}</span>
          <button
            onClick={() => setSearchParams({})}
            style={{ border: "none", background: "none", color: colors.mossDark, textDecoration: "underline", cursor: "pointer", fontFamily: fonts.body, fontSize: "13px", padding: 0 }}
          >
            Clear
          </button>
        </div>
      )}

      {loading && <p style={{ color: colors.inkSoft }}>Loading…</p>}
      {!loading && equipment.length === 0 && <p style={{ color: colors.inkSoft }}>No equipment yet.</p>}

      {equipment.map((eq) => (
        <Link key={eq.id} to={`/equipment/${eq.id}`} style={{ ...cardStyle, display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 16px", marginBottom: "10px", textDecoration: "none", color: colors.ink }}>
          <div>
            <div style={{ fontWeight: 600 }}>{eq.name}{eq.equipment_type && <span style={{ fontWeight: 400, color: colors.inkSoft }}> · {eq.equipment_type.name}</span>}</div>
            <div style={{ fontSize: "13px", color: colors.inkSoft }}>
              {[eq.make, eq.model].filter(Boolean).join(" ")}
              {eq.held_by && `${eq.make || eq.model ? " · " : ""}Held by ${eq.held_by.display_name}`}
            </div>
          </div>
          <span style={{ display: "inline-block", padding: "3px 12px", borderRadius: "999px", background: statusColors[eq.status], color: colors.onDark, fontSize: "12px", fontWeight: 600 }}>
            {statusLabels[eq.status]}
          </span>
        </Link>
      ))}
    </div>
  );
}
