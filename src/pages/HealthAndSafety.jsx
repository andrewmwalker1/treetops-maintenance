import { useEffect, useState } from "react";
import { useAuth } from "../lib/AuthContext.jsx";
import { supabase } from "../lib/supabaseClient.js";
import { colors, fonts, cardStyle, buttonStyle } from "../lib/theme.js";

function RiskAssessmentContent({ content }) {
  if (content == null) return <p style={{ color: colors.inkSoft, fontStyle: "italic" }}>No risk assessment content added yet.</p>;

  if (typeof content === "string") {
    return content.split("\n").filter(Boolean).map((line, i) => <p key={i}>{line}</p>);
  }

  if (Array.isArray(content)) {
    return content.map((section, i) => (
      <div key={i} style={{ marginBottom: "10px" }}>
        {section.heading && <div style={{ fontWeight: 600 }}>{section.heading}</div>}
        {section.body && <p style={{ margin: "2px 0" }}>{section.body}</p>}
        {typeof section === "string" && <p style={{ margin: "2px 0" }}>{section}</p>}
      </div>
    ));
  }

  return <pre style={{ whiteSpace: "pre-wrap", fontFamily: fonts.mono, fontSize: "13px" }}>{JSON.stringify(content, null, 2)}</pre>;
}

export default function HealthAndSafety() {
  const { org } = useAuth();
  const [taskTypes, setTaskTypes] = useState([]);
  const [videosByTaskType, setVideosByTaskType] = useState({});
  const [equipmentOnlyVideos, setEquipmentOnlyVideos] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!org) return;

    Promise.all([
      supabase
        .from("task_types")
        .select("id, name, equipment_category, risk_assessment:risk_assessments!task_types_risk_assessment_id_fkey(id, content, updated_at)")
        .eq("org_id", org.id),
      supabase.from("training_videos").select("id, title, youtube_url, task_type_id, equipment_category").eq("org_id", org.id),
    ]).then(([{ data: taskTypeRows, error: ttErr }, { data: videoRows, error: vErr }]) => {
      if (ttErr) console.error(ttErr);
      if (vErr) console.error(vErr);

      setTaskTypes(taskTypeRows || []);

      const byTaskType = {};
      const equipmentOnly = [];
      for (const video of videoRows || []) {
        if (video.task_type_id) {
          byTaskType[video.task_type_id] = [...(byTaskType[video.task_type_id] || []), video];
        } else if (video.equipment_category) {
          equipmentOnly.push(video);
        }
      }
      setVideosByTaskType(byTaskType);
      setEquipmentOnlyVideos(equipmentOnly);
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

      {taskTypes.length === 0 && (
        <p style={{ color: colors.inkSoft }}>No task types have been set up yet — risk assessments and training videos are attached to task types.</p>
      )}

      {taskTypes.map((tt) => (
        <div key={tt.id} id={`task-${tt.id}`} style={{ ...cardStyle, padding: "18px", marginBottom: "16px", scrollMarginTop: "20px" }}>
          <h2 style={{ fontFamily: fonts.display, fontSize: "18px", color: colors.mossDark, marginTop: 0 }}>{tt.name}</h2>
          {tt.equipment_category && (
            <div style={{ fontSize: "12px", color: colors.inkSoft, marginBottom: "10px" }}>Equipment category: {tt.equipment_category}</div>
          )}

          <div style={{ fontWeight: 600, fontSize: "13px", color: colors.inkSoft, marginTop: "10px" }}>Risk assessment</div>
          <RiskAssessmentContent content={tt.risk_assessment?.content} />

          {(videosByTaskType[tt.id] || []).length > 0 && (
            <>
              <div style={{ fontWeight: 600, fontSize: "13px", color: colors.inkSoft, marginTop: "14px" }}>Training videos</div>
              {videosByTaskType[tt.id].map((v) => (
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
