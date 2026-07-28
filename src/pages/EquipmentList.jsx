import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../lib/AuthContext.jsx";
import { usePermissions } from "../lib/permissions.js";
import { supabase } from "../lib/supabaseClient.js";
import { colors, fonts, cardStyle, buttonStyle } from "../lib/theme.js";

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
  const permissions = usePermissions();
  const [equipment, setEquipment] = useState([]);
  const [equipmentTypes, setEquipmentTypes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState("");
  const [newTypeId, setNewTypeId] = useState("");
  const [showAdd, setShowAdd] = useState(false);

  function refresh() {
    setLoading(true);
    Promise.all([
      supabase
        .from("equipment")
        .select("id, name, status, site_id, held_by_profile_id, equipment_type:equipment_types(name), held_by:profiles!equipment_held_by_profile_id_fkey(display_name)"),
      supabase.from("equipment_types").select("id, name").eq("org_id", org?.id).order("name"),
    ]).then(([{ data, error }, { data: types }]) => {
      if (error) console.error(error);
      setEquipment(data || []);
      setEquipmentTypes(types || []);
      setLoading(false);
    });
  }

  useEffect(refresh, [org, activeSite]);

  async function handleAdd(e) {
    e.preventDefault();
    if (!newName.trim()) return;
    const { error } = await supabase.from("equipment").insert({
      org_id: org.id,
      site_id: activeSite.id,
      name: newName,
      equipment_type_id: newTypeId || null,
      status: "in_service",
    });
    if (error) console.error(error);
    setNewName("");
    setNewTypeId("");
    setShowAdd(false);
    refresh();
  }

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
        <h1 style={{ fontFamily: fonts.display, color: colors.mossDark, margin: 0 }}>Equipment</h1>
        {permissions.has("can_manage_equipment_status") && (
          <button onClick={() => setShowAdd((v) => !v)} style={buttonStyle.primary}>+ Add equipment</button>
        )}
      </div>

      {showAdd && (
        <form onSubmit={handleAdd} style={{ ...cardStyle, padding: "14px", display: "flex", gap: "8px", marginBottom: "16px" }}>
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Code, e.g. ST1"
            style={{ flex: 1, padding: "8px 12px", borderRadius: "8px", border: `1px solid ${colors.lineStrong}`, fontFamily: fonts.body }}
          />
          <select
            value={newTypeId}
            onChange={(e) => setNewTypeId(e.target.value)}
            style={{ flex: 1, padding: "8px 12px", borderRadius: "8px", border: `1px solid ${colors.lineStrong}`, fontFamily: fonts.body }}
          >
            <option value="">No type</option>
            {equipmentTypes.map((t) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
          <button type="submit" style={buttonStyle.primary}>Add</button>
        </form>
      )}

      {loading && <p style={{ color: colors.inkSoft }}>Loading…</p>}
      {!loading && equipment.length === 0 && <p style={{ color: colors.inkSoft }}>No equipment yet.</p>}

      {equipment.map((eq) => (
        <Link key={eq.id} to={`/equipment/${eq.id}`} style={{ ...cardStyle, display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 16px", marginBottom: "10px", textDecoration: "none", color: colors.ink }}>
          <div>
            <div style={{ fontWeight: 600 }}>{eq.name}{eq.equipment_type && <span style={{ fontWeight: 400, color: colors.inkSoft }}> · {eq.equipment_type.name}</span>}</div>
            {eq.held_by && <div style={{ fontSize: "13px", color: colors.inkSoft }}>Held by {eq.held_by.display_name}</div>}
          </div>
          <span style={{ display: "inline-block", padding: "3px 12px", borderRadius: "999px", background: statusColors[eq.status], color: "#FFF", fontSize: "12px", fontWeight: 600 }}>
            {statusLabels[eq.status]}
          </span>
        </Link>
      ))}
    </div>
  );
}
