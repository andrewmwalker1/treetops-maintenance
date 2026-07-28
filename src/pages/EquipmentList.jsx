import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../lib/AuthContext.jsx";
import { supabase } from "../lib/supabaseClient.js";
import { colors, fonts, cardStyle } from "../lib/theme.js";

const statusColors = {
  in_service: colors.moss,
  faulty: colors.immediate,
  in_repair: colors.gold,
  scrapped: colors.inkSoft,
};

const statusLabels = {
  in_service: "In service",
  faulty: "Faulty",
  in_repair: "In repair",
  scrapped: "Scrapped",
};

export default function EquipmentList() {
  const { org, activeSite } = useAuth();
  const [equipment, setEquipment] = useState([]);
  const [loading, setLoading] = useState(true);

  function refresh() {
    setLoading(true);
    supabase
      .from("equipment")
      .select("id, name, make, model, status, site_id, held_by_profile_id, equipment_type:equipment_types(name), held_by:profiles!equipment_held_by_profile_id_fkey(display_name)")
      .then(({ data, error }) => {
        if (error) console.error(error);
        setEquipment(data || []);
        setLoading(false);
      });
  }

  useEffect(refresh, [org, activeSite]);

  return (
    <div>
      <h1 style={{ fontFamily: fonts.display, color: colors.mossDark, marginTop: 0 }}>Equipment</h1>

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
          <span style={{ display: "inline-block", padding: "3px 12px", borderRadius: "999px", background: statusColors[eq.status], color: "#FFF", fontSize: "12px", fontWeight: 600 }}>
            {statusLabels[eq.status]}
          </span>
        </Link>
      ))}
    </div>
  );
}
