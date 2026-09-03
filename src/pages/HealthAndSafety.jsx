import { useEffect, useState } from "react";
import { useAuth } from "../lib/AuthContext.jsx";
import { supabase } from "../lib/supabaseClient.js";
import SafetyDocumentLink from "../components/SafetyDocumentLink.jsx";
import { colors } from "../lib/theme.js";
import { Card, PageHeader, SkeletonList } from "../ui/index.js";

export default function HealthAndSafety() {
  const { org } = useAuth();
  const [activityTypes, setActivityTypes] = useState([]);
  const [documentsByActivityType, setDocumentsByActivityType] = useState({});
  const [videosByActivityType, setVideosByActivityType] = useState({});
  const [equipmentOnlyVideos, setEquipmentOnlyVideos] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!org) return;

    Promise.all([
      supabase.from("task_types").select("id, name, equipment_category").eq("org_id", org.id),
      supabase.from("training_videos").select("id, title, youtube_url, task_type_id, equipment_category").eq("org_id", org.id),
    ]).then(async ([{ data: activityTypeRows, error: ttErr }, { data: videoRows, error: vErr }]) => {
      if (ttErr) console.error(ttErr);
      if (vErr) console.error(vErr);

      setActivityTypes(activityTypeRows || []);

      const videosByType = {};
      const equipmentOnly = [];
      for (const video of videoRows || []) {
        if (video.task_type_id) {
          videosByType[video.task_type_id] = [...(videosByType[video.task_type_id] || []), video];
        } else if (video.equipment_category) {
          equipmentOnly.push(video);
        }
      }
      setVideosByActivityType(videosByType);
      setEquipmentOnlyVideos(equipmentOnly);

      if ((activityTypeRows || []).length > 0) {
        const { data: docLinks } = await supabase
          .from("activity_type_documents")
          .select("task_type_id, document:ra_ms_documents(id, type, title, description, pdf_storage_path)")
          .in("task_type_id", activityTypeRows.map((t) => t.id));
        const grouped = {};
        for (const link of docLinks || []) {
          grouped[link.task_type_id] = [...(grouped[link.task_type_id] || []), link.document];
        }
        for (const docs of Object.values(grouped)) {
          docs.sort((a, b) => a.title.localeCompare(b.title));
        }
        setDocumentsByActivityType(grouped);
      }

      setLoading(false);
    });
  }, [org]);

  useEffect(() => {
    if (loading) return;
    const hash = window.location.hash;
    if (hash) {
      const el = document.querySelector(hash);
      if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [loading]);

  if (loading) return <SkeletonList rows={3} />;

  return (
    <div style={{ maxWidth: "700px" }}>
      <PageHeader title="Health & Safety" />

      {activityTypes.length === 0 && (
        <p style={{ color: colors.inkSoft }}>No activity types have been set up yet — manage these, and their RA/MS documents, from Admin → Activity Types.</p>
      )}

      {activityTypes.map((t) => (
        <Card pad="lg" key={t.id} id={`task-${t.id}`} style={{ marginBottom: "var(--space-4)", scrollMarginTop: "var(--space-5)" }}>
          <PageHeader title={t.name} level={2} />
          {t.equipment_category && (
            <div style={{ fontSize: "var(--text-xs)", color: colors.inkSoft, marginBottom: "var(--space-3)" }}>Equipment category: {t.equipment_category}</div>
          )}

          <div style={{ fontWeight: 600, fontSize: "var(--text-sm)", color: colors.inkSoft, marginTop: "var(--space-3)" }}>Risk assessments / method statements</div>
          {(documentsByActivityType[t.id] || []).length === 0 && (
            <p style={{ color: colors.inkSoft, fontSize: "var(--text-sm)" }}>None linked yet.</p>
          )}
          {(documentsByActivityType[t.id] || []).map((doc) => (
            <SafetyDocumentLink key={doc.id} doc={doc} />
          ))}

          {(videosByActivityType[t.id] || []).length > 0 && (
            <>
              <div style={{ fontWeight: 600, fontSize: "var(--text-sm)", color: colors.inkSoft, marginTop: "var(--space-4)" }}>Training videos</div>
              {videosByActivityType[t.id].map((v) => (
                <div key={v.id} style={{ padding: "var(--space-1) 0" }}>
                  <a href={v.youtube_url} target="_blank" rel="noreferrer" style={{ color: colors.moss }}>
                    ▶ {v.title}
                  </a>
                </div>
              ))}
            </>
          )}
        </Card>
      ))}

      {equipmentOnlyVideos.length > 0 && (
        <Card pad="lg">
          <PageHeader title="Equipment training videos" level={2} />
          {equipmentOnlyVideos.map((v) => (
            <div key={v.id} style={{ padding: "var(--space-1) 0" }}>
              <span style={{ fontSize: "var(--text-xs)", color: colors.inkSoft, marginRight: "var(--space-2)" }}>{v.equipment_category}</span>
              <a href={v.youtube_url} target="_blank" rel="noreferrer" style={{ color: colors.moss }}>
                ▶ {v.title}
              </a>
            </div>
          ))}
        </Card>
      )}
    </div>
  );
}
