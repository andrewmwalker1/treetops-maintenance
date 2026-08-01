import { useEffect, useState, useCallback, useMemo } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useAuth } from "../lib/AuthContext.jsx";
import { queryJobs } from "../lib/jobsQuery.js";
import { supabase } from "../lib/supabaseClient.js";
import { loadJobForPrint } from "../lib/loadJobForPrint.js";
import JobCard from "../components/JobCard.jsx";
import PrintableJobCard from "../components/PrintableJobCard.jsx";
import PrintStyles from "../components/PrintStyles.jsx";
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

const PRIORITIES = ["immediate", "high", "medium", "low"];

export default function JobsList() {
  const { activeSite, terminology } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const quickFilter = useMemo(() => quickFilterFromParams(searchParams), [searchParams]);
  const [jobs, setJobs] = useState([]);
  const [statuses, setStatuses] = useState([]);
  const [activeStatusId, setActiveStatusId] = useState(null);
  const [activePriority, setActivePriority] = useState(null);
  // "" = everyone; "person:<id>" or "role:<name>" -- narrows the
  // already-loaded (RLS-visible) jobs client-side, no extra query needed.
  const [assigneeFilter, setAssigneeFilter] = useState("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedIds, setSelectedIds] = useState(() => new Set());
  const [printBatch, setPrintBatch] = useState(null);
  const [printing, setPrinting] = useState(false);

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
    if (activePriority) {
      filters.priorities = [activePriority];
    } else if (quickFilter?.type === "priority") {
      filters.priorities = [quickFilter.value];
    }
    if (quickFilter?.type === "overdue") filters.dueBefore = new Date().toISOString().slice(0, 10);

    queryJobs(activeSite.id, filters)
      .then(setJobs)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [activeSite, activeStatusId, activePriority, search, quickFilter, statuses]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Options are derived from whatever jobs RLS + the filters above already
  // surfaced -- so "filter by role" only ever offers roles actually visible
  // to this user, without duplicating the role_visibility logic client-side.
  const assigneeOptions = useMemo(() => {
    const people = new Map();
    const roles = new Set();
    for (const job of jobs) {
      if (job.assignee) {
        people.set(job.assignee.id, job.assignee.display_name);
        if (job.assignee.role?.name) roles.add(job.assignee.role.name);
      }
    }
    return {
      people: [...people.entries()].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name)),
      roles: [...roles].sort(),
    };
  }, [jobs]);

  const visibleJobs = useMemo(() => {
    if (!assigneeFilter) return jobs;
    const colonIdx = assigneeFilter.indexOf(":");
    const kind = assigneeFilter.slice(0, colonIdx);
    const value = assigneeFilter.slice(colonIdx + 1);
    if (kind === "person") return jobs.filter((j) => j.assignee?.id === value);
    if (kind === "role") return jobs.filter((j) => j.assignee?.role?.name === value);
    return jobs;
  }, [jobs, assigneeFilter]);

  function toggleSelect(jobId) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(jobId)) next.delete(jobId);
      else next.add(jobId);
      return next;
    });
  }

  async function handlePrintSelected() {
    setError(null);
    setPrinting(true);
    try {
      const orderedIds = visibleJobs.filter((j) => selectedIds.has(j.id)).map((j) => j.id);
      const bundles = await Promise.all(orderedIds.map((jobId) => loadJobForPrint(jobId)));

      // Unlike the single-job print button, these photos have never been
      // displayed on screen here, so nothing has warmed their signed URLs
      // yet -- resolve them all before triggering print, or window.print()
      // could fire while PhotoThumb is still fetching and print blank boxes.
      await Promise.all(
        bundles.flatMap((bundle) =>
          bundle.photos.map(async (photo) => {
            const { data } = await supabase.storage.from("job-photos").createSignedUrl(photo.storage_path, 3600);
            if (data) photo.signedUrl = data.signedUrl;
          })
        )
      );

      setPrintBatch(bundles);
    } catch (err) {
      setError(err.message);
    } finally {
      setPrinting(false);
    }
  }

  // Runs after the print-sheet bundle above has actually committed to the
  // DOM, so window.print() always sees the freshly loaded cards rather than
  // racing the state update.
  useEffect(() => {
    if (printBatch) window.print();
  }, [printBatch]);

  if (!activeSite) return <p style={{ color: colors.inkSoft }}>Loading your site…</p>;

  return (
    <div>
      <PrintStyles />

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "12px", marginBottom: "16px" }}>
        <h1 style={{ fontFamily: fonts.display, color: colors.mossDark, margin: 0 }}>Jobs</h1>
        <Link to="/jobs/new" style={{ ...buttonStyle.primary, textDecoration: "none" }}>
          + New job
        </Link>
      </div>

      {selectedIds.size > 0 && (
        <div
          style={{
            ...cardStyle,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "12px",
            padding: "10px 16px",
            marginBottom: "12px",
            fontFamily: fonts.body,
            fontSize: "13px",
            color: colors.mossDark,
          }}
        >
          <span>{selectedIds.size} job{selectedIds.size === 1 ? "" : "s"} selected</span>
          <div style={{ display: "flex", gap: "8px" }}>
            <button
              type="button"
              onClick={() => setSelectedIds(new Set())}
              style={{ border: "none", background: "none", color: colors.mossDark, textDecoration: "underline", cursor: "pointer", fontFamily: fonts.body, fontSize: "13px" }}
            >
              Clear
            </button>
            <button type="button" onClick={handlePrintSelected} disabled={printing} style={buttonStyle.primary}>
              {printing ? "Preparing…" : "Print selected"}
            </button>
          </div>
        </div>
      )}

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

      <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginBottom: "12px" }}>
        <FilterChip active={activePriority === null} onClick={() => setActivePriority(null)} label="All priorities" />
        {PRIORITIES.map((p) => (
          <FilterChip key={p} active={activePriority === p} onClick={() => setActivePriority(p)} label={p.charAt(0).toUpperCase() + p.slice(1)} />
        ))}
      </div>

      {/* Only worth showing once the visible jobs actually span more than
          one assignee -- i.e. exactly when this user's role_visibility (or
          can_see_all_jobs) surfaces someone else's jobs alongside their own. */}
      {assigneeOptions.people.length > 1 && (
        <select
          value={assigneeFilter}
          onChange={(e) => setAssigneeFilter(e.target.value)}
          style={{
            width: "100%",
            boxSizing: "border-box",
            padding: "10px 14px",
            borderRadius: "10px",
            border: `1px solid ${colors.lineStrong}`,
            fontFamily: fonts.body,
            marginBottom: "12px",
          }}
        >
          <option value="">Everyone</option>
          {assigneeOptions.roles.length > 0 && (
            <optgroup label="By role">
              {assigneeOptions.roles.map((r) => (
                <option key={`role:${r}`} value={`role:${r}`}>{r}</option>
              ))}
            </optgroup>
          )}
          <optgroup label="By person">
            {assigneeOptions.people.map((p) => (
              <option key={`person:${p.id}`} value={`person:${p.id}`}>{p.name}</option>
            ))}
          </optgroup>
        </select>
      )}

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
      {!loading && !error && visibleJobs.length === 0 && <p style={{ color: colors.inkSoft }}>No jobs match this view.</p>}

      {visibleJobs.map((job) => (
        <JobCard
          key={job.id}
          job={job}
          terminology={terminology}
          selectable
          selected={selectedIds.has(job.id)}
          onToggleSelect={toggleSelect}
        />
      ))}

      <div className="print-sheet">
        {(printBatch || []).map((bundle) => (
          <PrintableJobCard
            key={bundle.job.id}
            job={bundle.job}
            subtasks={bundle.subtasks}
            photos={bundle.photos}
            activity={bundle.activity}
            activityTypes={bundle.activityTypes}
            documentsByActivityType={bundle.documentsByActivityType}
            terminology={terminology}
          />
        ))}
      </div>
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
