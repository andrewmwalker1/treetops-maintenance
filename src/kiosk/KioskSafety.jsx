import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../lib/AuthContext.jsx";
import { supabase } from "../lib/supabaseClient.js";
import SafetyDocumentLink from "../components/SafetyDocumentLink.jsx";
import { Button, Card, EmptyState, IconArrowLeft, PageHeader, Select, SkeletonList } from "../ui/index.js";

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
    <div style={{ padding: "var(--space-6)", maxWidth: "var(--width-2xl)", margin: "0 auto" }}>
      <Button onClick={() => navigate("/kiosk")} icon={<IconArrowLeft size={16} />} style={{ marginBottom: "var(--space-5)" }}>
        Menu
      </Button>
      <PageHeader
        title="Health & safety"
        subtitle="Every risk assessment and method statement — narrow by activity or equipment type if you know it."
      />

      {loading && <SkeletonList rows={4} />}

      {!loading && (
        <>
          <Select
            value={activityFilter}
            onChange={(e) => setActivityFilter(e.target.value)}
            aria-label="Filter by activity type"
            className="tt-input--kiosk"
            style={{ marginBottom: "var(--space-3)" }}
          >
            <option value="">All activity types</option>
            {activityTypes.map((t) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </Select>
          <Select
            value={equipmentFilter}
            onChange={(e) => setEquipmentFilter(e.target.value)}
            aria-label="Filter by equipment type"
            className="tt-input--kiosk"
            style={{ marginBottom: "var(--space-3)" }}
          >
            <option value="">All equipment types</option>
            {equipmentTypes.map((t) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </Select>

          <Card pad="lg" style={{ marginTop: "var(--space-3)" }}>
            {visibleDocuments.length === 0 && (
              <EmptyState
                title="No documents match"
                action={
                  activityFilter || equipmentFilter ? (
                    <Button
                      variant="primary"
                      onClick={() => {
                        setActivityFilter("");
                        setEquipmentFilter("");
                      }}
                    >
                      Clear filters
                    </Button>
                  ) : null
                }
              >
                Widen the filters above to see the rest of the library.
              </EmptyState>
            )}
            {visibleDocuments.map((doc) => (
              <SafetyDocumentLink key={doc.id} doc={doc} />
            ))}
          </Card>
        </>
      )}
    </div>
  );
}
