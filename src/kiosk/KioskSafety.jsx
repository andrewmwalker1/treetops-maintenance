import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../lib/AuthContext.jsx";
import { supabase } from "../lib/supabaseClient.js";
import SafetyDocumentLink from "../components/SafetyDocumentLink.jsx";
import { colors, fonts } from "../lib/theme.js";
import { kioskSecondaryButtonStyle, kioskCardStyle } from "./kioskTheme.js";

const selectStyle = {
  width: "100%",
  boxSizing: "border-box",
  padding: "14px",
  borderRadius: "12px",
  border: `2px solid ${colors.lineStrong}`,
  fontFamily: fonts.body,
  fontSize: "16px",
  marginBottom: "12px",
};

// Standalone RA/MS browser, reachable from the kiosk home screen without
// going via a job or a checkout at all (Andy: "if they are asked to do a
// job that's not logged on the system they still have access to the
// RA's / MS's"). Filtering by activity type and/or equipment type is
// additive (either match shows the document), not a strict AND -- the
// point is finding the right document quickly, not narrowing precisely.
export default function KioskSafety() {
  const navigate = useNavigate();
  const { org } = useAuth();
  const [activityTypes, setActivityTypes] = useState([]);
  const [equipmentTypes, setEquipmentTypes] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [docsByActivityType, setDocsByActivityType] = useState({});
  const [docsByEquipmentType, setDocsByEquipmentType] = useState({});
  const [activityFilter, setActivityFilter] = useState("");
  const [equipmentFilter, setEquipmentFilter] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!org) return;
    Promise.all([
      supabase.from("task_types").select("id, name").eq("org_id", org.id).order("name"),
      supabase.from("equipment_types").select("id, name").eq("org_id", org.id).order("sort_order"),
      supabase.from("ra_ms_documents").select("id, type, title, description, pdf_storage_path").eq("org_id", org.id).order("title"),
      supabase.from("activity_type_documents").select("task_type_id, document_id"),
      supabase.from("equipment_type_documents").select("equipment_type_id, document_id"),
    ]).then(([{ data: at }, { data: et }, { data: docs }, { data: actLinks }, { data: eqLinks }]) => {
      setActivityTypes(at || []);
      setEquipmentTypes(et || []);
      setDocuments(docs || []);

      const byActivity = {};
      for (const link of actLinks || []) {
        (byActivity[link.task_type_id] ||= new Set()).add(link.document_id);
      }
      setDocsByActivityType(byActivity);

      const byEquipment = {};
      for (const link of eqLinks || []) {
        (byEquipment[link.equipment_type_id] ||= new Set()).add(link.document_id);
      }
      setDocsByEquipmentType(byEquipment);

      setLoading(false);
    });
  }, [org]);

  const activityDocIds = activityFilter ? docsByActivityType[activityFilter] : null;
  const equipmentDocIds = equipmentFilter ? docsByEquipmentType[equipmentFilter] : null;
  const visibleDocuments =
    !activityDocIds && !equipmentDocIds
      ? documents
      : documents.filter((d) => (activityDocIds && activityDocIds.has(d.id)) || (equipmentDocIds && equipmentDocIds.has(d.id)));

  return (
    <div style={{ padding: "24px", maxWidth: "640px", margin: "0 auto" }}>
      <button style={{ ...kioskSecondaryButtonStyle, width: "auto", padding: "10px 20px", fontSize: "16px", marginBottom: "20px" }} onClick={() => navigate("/kiosk")}>
        ← Menu
      </button>
      <h1 style={{ fontFamily: fonts.display, color: colors.mossDark, fontSize: "26px", marginTop: 0 }}>Health &amp; Safety</h1>
      <p style={{ color: colors.inkSoft, fontSize: "15px", marginTop: 0 }}>
        Every risk assessment and method statement — narrow by activity or equipment type if you know it.
      </p>

      {loading && <p style={{ color: colors.inkSoft }}>Loading…</p>}

      {!loading && (
        <>
          <select value={activityFilter} onChange={(e) => setActivityFilter(e.target.value)} style={selectStyle}>
            <option value="">All activity types</option>
            {activityTypes.map((t) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
          <select value={equipmentFilter} onChange={(e) => setEquipmentFilter(e.target.value)} style={selectStyle}>
            <option value="">All equipment types</option>
            {equipmentTypes.map((t) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>

          <div style={{ ...kioskCardStyle, marginTop: "12px" }}>
            {visibleDocuments.length === 0 && <p style={{ color: colors.inkSoft, fontSize: "16px" }}>No documents match.</p>}
            {visibleDocuments.map((doc) => (
              <SafetyDocumentLink key={doc.id} doc={doc} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
