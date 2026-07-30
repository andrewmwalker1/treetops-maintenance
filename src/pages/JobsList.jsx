import { useEffect, useState, useCallback, useMemo } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useAuth } from "../lib/AuthContext.jsx";
import { queryJobs } from "../lib/jobsQuery.js";
import { supabase } from "../lib/supabaseClient.js";
import JobCard from "../components/JobCard.jsx";
import { colors, fonts, cardStyle, buttonStyle } from "../lib/theme.js";

// Dashboard stat tiles link here with a query param (?priority=medium,
// ?overdue=1, ?open=1) so "click a count, see those jobs" works without
// the two pages' filtering logic drifting apart. Kept separate from the
// status FilterChips below since it's additive, not a replacement --
// e.g. arriving via "Overdue" and then picking a status chip narrows
// further rather than conflicting.
function quickFilterFromParams(searchParams) {
  const priority = searchParams.get("priority");
  if (priority) return { type: "priority", value: priority };
  if (searchParams.get("overdue")) return { type: "overdue" };
  if (searchParams.get("open")) return { type: "open" };
  return null;
}

function quickFilterLabel(quickFilter) {
  if (quickFilter.type === "priority") return `${quickFilter.value} priority`;
  if (quickFilter.type === "overdue") return "Overdue";
  return "Open jobs";
}

export default function JobsList() {
  const { activeSite, terminology } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const quickFilter = useMemo(() => quickFilterFromParams(searchParams), [searchParams]);
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
    if (activeStatusId) {
      filters.statusIds = [activeStatusId];
    } else if (quickFilter && statuses.length) {
      // "open"/"overdue"/"priority" tiles on the Dashboard only ever count
      // non-completed jobs, so match that here or the list wouldn't agree
      // with the count that was clicked.
      const openStatusIds = statuses.filter((s) => !s.is_completed).map((s) => s.id);
      if (openStatusIds.length) filters.statusIds = openStatusIds;
    }
    if (quickFilter?.type === "priority") filters.priorities = [quickFilter.value];
    if (quickFilter?.type === "overdue") filters.dueBefore = new Date().toISOString().slice(0, 10);

    queryJobs(activeSite.id, filters)
      .then(setJobs)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [activeSite, activeStatusId, search, quickFilter, statuses]);

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

      {quickFilter && (
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
          <span style={{ textTransform: "capitalize" }}>Showing: {quickFilterLabel(quickFilter)}</span>
          <button
            onClick={() => setSearchParams({})}
            style={{
              border: "none",
              background: "none",
              color: colors.mossDark,
              textDecoration: "underline",
              cursor: "pointer",
              fontFamily: fonts.body,
              fontSize: "13px",
              padding: 0,
            }}
          >
            Clear
          </button>
        </div>
      )}

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
