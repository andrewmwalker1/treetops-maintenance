import { useEffect, useState } from "react";
import { useAuth } from "../lib/AuthContext.jsx";
import { supabase } from "../lib/supabaseClient.js";
import SafetyDocumentLink from "../components/SafetyDocumentLink.jsx";
import { colors, fonts, cardStyle } from "../lib/theme.js";

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

  if (loading) return <p style={{ color: colors.inkSoft }}>Loading…</p>;

  return (
    <div style={{ maxWidth: "700px" }}>
      <h1 style={{ fontFamily: fonts.display, color: colors.mossDark, marginTop: 0 }}>Health &amp; Safety</h1>

      {activityTypes.length === 0 && (
        <p style={{ color: colors.inkSoft }}>No activity types have been set up yet — manage these, and their RA/MS documents, from Admin → Activity Types.</p>
      )}

      {activityTypes.map((t) => (
        <div key={t.id} id={`task-${t.id}`} style={{ ...cardStyle, padding: "18px", marginBottom: "16px", scrollMarginTop: "20px" }}>
          <h2 style={{ fontFamily: fonts.display, fontSize: "18px", color: colors.mossDark, marginTop: 0 }}>{t.name}</h2>
          {t.equipment_category && (
            <div style={{ fontSize: "12px", color: colors.inkSoft, marginBottom: "10px" }}>Equipment category: {t.equipment_category}</div>
          )}

          <div style={{ fontWeight: 600, fontSize: "13px", color: colors.inkSoft, marginTop: "10px" }}>Risk assessments / method statements</div>
          {(documentsByActivityType[t.id] || []).length === 0 && (
            <p style={{ color: colors.inkSoft, fontSize: "13px" }}>None linked yet.</p>
          )}
          {(documentsByActivityType[t.id] || []).map((doc) => (
            <SafetyDocumentLink key={doc.id} doc={doc} />
          ))}

          {(videosByActivityType[t.id] || []).length > 0 && (
            <>
              <div style={{ fontWeight: 600, fontSize: "13px", color: colors.inkSoft, marginTop: "14px" }}>Training videos</div>
              {videosByActivityType[t.id].map((v) => (
                <div key={v.id} style={{ padding: "4px 0" }}>
                  <a href={v.youtube_url} target="_blank" rel="noreferrer" style={{ color: colors.moss }}>
                    ▶ {v.title}
                  </a>
                </div>
              ))}
            </>
          )}
        </div>
      ))}

      {equipmentOnlyVideos.length > 0 && (
        <div style={{ ...cardStyle, padding: "18px" }}>
          <h2 style={{ fontFamily: fonts.display, fontSize: "18px", color: colors.mossDark, marginTop: 0 }}>Equipment training videos</h2>
          {equipmentOnlyVideos.map((v) => (
            <div key={v.id} style={{ padding: "4px 0" }}>
              <span style={{ fontSize: "12px", color: colors.inkSoft, marginRight: "8px" }}>{v.equipment_category}</span>
              <a href={v.youtube_url} target="_blank" rel="noreferrer" style={{ color: colors.moss }}>
                ▶ {v.title}
              </a>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
