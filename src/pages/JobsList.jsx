import { useEffect, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../lib/AuthContext.jsx";
import { queryJobs } from "../lib/jobsQuery.js";
import { supabase } from "../lib/supabaseClient.js";
import JobCard from "../components/JobCard.jsx";
import { colors, fonts, buttonStyle } from "../lib/theme.js";

export default function JobsList() {
  const { activeSite, terminology } = useAuth();
  const [jobs, setJobs] = useState([]);
  const [statuses, setStatuses] = useState([]);
  const [activeStatusId, setActiveStatusId] = useState(null);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!activeSite) return;
    supabase
      .from("job_statuses")
      .select("id, name, is_completed, sort_order")
      .order("sort_order")
      .then(({ data, error: err }) => {
        if (err) console.error(err);
        else setStatuses(data);
      });
  }, [activeSite]);

  const refresh = useCallback(() => {
    if (!activeSite) return;
    setLoading(true);
    const filters = { search: search || undefined };
    if (activeStatusId) filters.statusIds = [activeStatusId];
    queryJobs(activeSite.id, filters)
      .then(setJobs)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [activeSite, activeStatusId, search]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  if (!activeSite) return <p style={{ color: colors.inkSoft }}>Loading your site…</p>;

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "12px", marginBottom: "16px" }}>
        <h1 style={{ fontFamily: fonts.display, color: colors.mossDark, margin: 0 }}>Jobs</h1>
        <Link to="/jobs/new" style={{ ...buttonStyle.primary, textDecoration: "none" }}>
          + New job
        </Link>
      </div>

      <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginBottom: "12px" }}>
        <FilterChip active={activeStatusId === null} onClick={() => setActiveStatusId(null)} label="All" />
        {statuses.map((s) => (
          <FilterChip key={s.id} active={activeStatusId === s.id} onClick={() => setActiveStatusId(s.id)} label={s.name} />
        ))}
      </div>

      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search jobs…"
        style={{
          width: "100%",
          boxSizing: "border-box",
          padding: "10px 14px",
          borderRadius: "10px",
          border: `1px solid ${colors.lineStrong}`,
          fontFamily: fonts.body,
          marginBottom: "16px",
        }}
      />

      {loading && <p style={{ color: colors.inkSoft }}>Loading…</p>}
      {error && <p style={{ color: colors.immediate }}>{error}</p>}
      {!loading && !error && jobs.length === 0 && <p style={{ color: colors.inkSoft }}>No jobs match this view.</p>}

      {jobs.map((job) => (
        <JobCard key={job.id} job={job} terminology={terminology} />
      ))}
    </div>
  );
}

function FilterChip({ active, onClick, label }) {
  return (
    <button
      onClick={onClick}
      style={{
        border: `1px solid ${active ? colors.mossDark : colors.lineStrong}`,
        background: active ? colors.mossDark : "transparent",
        color: active ? "#FFFFFF" : colors.inkSoft,
        borderRadius: "999px",
        padding: "6px 14px",
        fontFamily: fonts.body,
        fontSize: "13px",
        cursor: "pointer",
      }}
    >
      {label}
    </button>
  );
}
