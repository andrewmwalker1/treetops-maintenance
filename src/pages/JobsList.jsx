import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useAuth } from "../lib/AuthContext.jsx";
import { queryJobs } from "../lib/jobsQuery.js";
import { useViewAsJobFilter } from "../lib/simulateJobVisibility.js";
import { supabase } from "../lib/supabaseClient.js";
import { loadJobForPrint } from "../lib/loadJobForPrint.js";
import { openPrintWindow, writeAndPrintJobBundles, writeAndPrintJobsChecklist } from "../lib/printJobCards.jsx";
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

const PRIORITIES = ["immediate", "high", "medium", "low"];

// Tapping a job card (rather than its checkbox) navigates to JobDetail,
// which unmounts this page -- plain useState would lose the selection
// entirely on the way back. sessionStorage survives that round trip
// (cleared when the tab closes, which is fine for a transient selection).
const SELECTED_IDS_STORAGE_KEY = "jobsList:selectedIds";

function loadStoredSelectedIds() {
  try {
    const raw = sessionStorage.getItem(SELECTED_IDS_STORAGE_KEY);
    return raw ? new Set(JSON.parse(raw)) : new Set();
  } catch {
    return new Set();
  }
}

export default function JobsList() {
  const { activeSite, terminology } = useAuth();
  const viewAsFilter = useViewAsJobFilter();
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
  const [selectedIds, setSelectedIds] = useState(loadStoredSelectedIds);
  const [printing, setPrinting] = useState(false);

  useEffect(() => {
    sessionStorage.setItem(SELECTED_IDS_STORAGE_KEY, JSON.stringify([...selectedIds]));
  }, [selectedIds]);

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
    // job_statuses hasn't loaded yet, so there's no way to know which
    // statuses count as "open" -- wait rather than momentarily querying
    // with no status filter at all, which would show every job including
    // Completed until statuses arrives and this re-runs.
    if (!activeStatusId && statuses.length === 0) return;
    setLoading(true);
    const filters = {};
    if (activeStatusId) {
      filters.statusIds = [activeStatusId];
    } else {
      // Default "All" view (and the Dashboard's "open"/"overdue"/"priority"
      // quick filters) only ever means open + in-progress -- Completed and
      // Cancelled each have their own status chip already, so "All" isn't
      // literally every job or it'd bury the active work under history.
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
  }, [activeSite, activeStatusId, activePriority, quickFilter, statuses]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // While "viewing as", narrow the admin's real (full) RLS-visible set down
  // to an approximation of what the faked role/person would actually see --
  // see simulateJobVisibility.js for the caveats. Both assigneeOptions and
  // visibleJobs build on this so the assignee dropdown never offers people
  // whose jobs the simulation has already hidden.
  const baseJobs = useMemo(() => (viewAsFilter ? jobs.filter(viewAsFilter) : jobs), [jobs, viewAsFilter]);

  // Options are derived from whatever jobs RLS + the filters above already
  // surfaced -- so "filter by group" only ever offers groups actually
  // visible to this user, without duplicating the role_visibility logic
  // client-side.
  const assigneeOptions = useMemo(() => {
    const people = new Map();
    const groups = new Map();
    const contractors = new Map();
    for (const job of baseJobs) {
      if (job.assignee) people.set(job.assignee.id, job.assignee.display_name);
      if (job.assignee_group) groups.set(job.assignee_group.id, job.assignee_group.name);
      if (job.assignee_contractor) contractors.set(job.assignee_contractor.id, job.assignee_contractor.name);
    }
    return {
      people: [...people.entries()].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name)),
      groups: [...groups.entries()].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name)),
      contractors: [...contractors.entries()].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name)),
    };
  }, [baseJobs]);

  const visibleJobs = useMemo(() => {
    let result = baseJobs;

    if (assigneeFilter) {
      const colonIdx = assigneeFilter.indexOf(":");
      const kind = assigneeFilter.slice(0, colonIdx);
      const value = assigneeFilter.slice(colonIdx + 1);
      if (kind === "person") result = result.filter((j) => j.assignee?.id === value);
      else if (kind === "group") result = result.filter((j) => j.assignee_group?.id === value);
      else if (kind === "contractor") result = result.filter((j) => j.assignee_contractor?.id === value);
    }

    // Client-side, over the same already-loaded (RLS-visible) jobs as
    // assigneeFilter above -- lets one search box match the job
    // description, the assigned person's name, or the assigned group's
    // name (e.g. "dave" finds every job assigned to Dave) without a
    // second round trip or a fragile cross-table ilike/or() query.
    const term = search.trim().toLowerCase();
    if (term) {
      result = result.filter(
        (j) =>
          j.description?.toLowerCase().includes(term) ||
          j.assignee?.display_name?.toLowerCase().includes(term) ||
          j.assignee_group?.name?.toLowerCase().includes(term) ||
          j.assignee_contractor?.name?.toLowerCase().includes(term)
      );
    }

    return result;
  }, [baseJobs, assigneeFilter, search]);

  function toggleSelect(jobId) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(jobId)) next.delete(jobId);
      else next.add(jobId);
      return next;
    });
  }

  // Toggles selection for whatever's in the current view only -- a job
  // selected under a different filter stays selected rather than being
  // silently dropped by an unrelated "select all" click.
  function toggleSelectAll() {
    setSelectedIds((prev) => {
      const allVisibleSelected = visibleJobs.length > 0 && visibleJobs.every((j) => prev.has(j.id));
      const next = new Set(prev);
      for (const job of visibleJobs) {
        if (allVisibleSelected) next.delete(job.id);
        else next.add(job.id);
      }
      return next;
    });
  }

  async function handlePrintSelected() {
    setError(null);
    let printWindow;
    try {
      printWindow = openPrintWindow();
    } catch (err) {
      setError(err.message);
      return;
    }
    setPrinting(true);
    try {
      const orderedIds = visibleJobs.filter((j) => selectedIds.has(j.id)).map((j) => j.id);
      const bundles = await Promise.all(orderedIds.map((jobId) => loadJobForPrint(jobId)));

      // Unlike the single-job print button, these photos have never been
      // displayed on screen here, so nothing has warmed their signed URLs
      // yet -- resolve them all before handing the bundle off to print.
      await Promise.all(
        bundles.flatMap((bundle) =>
          bundle.photos.map(async (photo) => {
            const { data } = await supabase.storage.from("job-photos").createSignedUrl(photo.storage_path, 3600);
            if (data) photo.signedUrl = data.signedUrl;
          })
        )
      );

      writeAndPrintJobBundles(printWindow, bundles, terminology);
    } catch (err) {
      printWindow.close();
      setError(err.message);
    } finally {
      setPrinting(false);
    }
  }

  // Unlike handlePrintSelected above, this needs no extra queries first --
  // it's just a table of the job summaries JobsList already has loaded, so
  // it can write straight to the print window.
  function handlePrintChecklist() {
    setError(null);
    let printWindow;
    try {
      printWindow = openPrintWindow();
    } catch (err) {
      setError(err.message);
      return;
    }
    const selected = visibleJobs.filter((j) => selectedIds.has(j.id));
    writeAndPrintJobsChecklist(printWindow, selected, terminology);
  }

  if (!activeSite) return <p style={{ color: colors.inkSoft }}>Loading your site…</p>;

  return (
    <div>
      {/* Sticks to the top of <main>'s own scroll area (Layout.jsx made
          main the scrolling region, not the whole page) -- position:sticky
          needs no pixel math for the header's height because it's stuck
          relative to the nearest scrolling ancestor, not the viewport. The
          background match is what stops job cards from visibly scrolling
          up underneath it as this bar stays put.
          top/marginTop/paddingTop all use main's own 20px padding
          (Layout.jsx) -- sticky parks itself just inside a scroll
          container's padding by spec, leaving that padding strip as
          ordinary scrollable space non-sticky content (job cards) keeps
          sliding through. Pulling the sticky box up by main's padding
          amount and re-adding that space as its own padding covers that
          strip with this element's own background instead. If main's
          padding ever changes, this -20px/-20px/20px trio needs to match. */}
      <div style={{ position: "sticky", top: "-20px", marginTop: "-20px", paddingTop: "20px", paddingBottom: "4px", background: colors.bg, zIndex: 5 }}>
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
            <button type="button" onClick={handlePrintChecklist} style={buttonStyle.secondary}>
              Print checklist
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

      {/* Horizontal scroll strips, not wrap -- these two rows used to wrap
          onto two lines each and, being inside the sticky panel above,
          permanently ate most of a mobile viewport's height before any
          job was visible. One scrollable line each fixes that without
          hiding any filter behind an extra tap. ScrollHintRow fades the
          trailing edge whenever there's more to scroll to, so the strip
          doesn't just look like a short, complete row of chips. */}
      <ScrollHintRow itemCount={statuses.length}>
        <FilterChip active={activeStatusId === null} onClick={() => setActiveStatusId(null)} label="All" />
        {statuses.map((s) => (
          <FilterChip key={s.id} active={activeStatusId === s.id} onClick={() => setActiveStatusId(s.id)} label={s.name} />
        ))}
      </ScrollHintRow>

      <ScrollHintRow itemCount={PRIORITIES.length}>
        <FilterChip active={activePriority === null} onClick={() => setActivePriority(null)} label="All priorities" />
        {PRIORITIES.map((p) => (
          <FilterChip key={p} active={activePriority === p} onClick={() => setActivePriority(p)} label={p.charAt(0).toUpperCase() + p.slice(1)} />
        ))}
      </ScrollHintRow>

      {/* Only worth showing once the visible jobs actually span more than
          one assignee -- i.e. exactly when this user's role_visibility (or
          can_see_all_jobs) surfaces someone else's jobs alongside their own. */}
      {assigneeOptions.people.length + assigneeOptions.groups.length + assigneeOptions.contractors.length > 1 && (
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
          {assigneeOptions.groups.length > 0 && (
            <optgroup label="By group">
              {assigneeOptions.groups.map((g) => (
                <option key={`group:${g.id}`} value={`group:${g.id}`}>{g.name}</option>
              ))}
            </optgroup>
          )}
          <optgroup label="By person">
            {assigneeOptions.people.map((p) => (
              <option key={`person:${p.id}`} value={`person:${p.id}`}>{p.name}</option>
            ))}
          </optgroup>
          {assigneeOptions.contractors.length > 0 && (
            <optgroup label="By contractor">
              {assigneeOptions.contractors.map((c) => (
                <option key={`contractor:${c.id}`} value={`contractor:${c.id}`}>{c.name}</option>
              ))}
            </optgroup>
          )}
        </select>
      )}

      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search jobs, people, or groups…"
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
      </div>

      {loading && <p style={{ color: colors.inkSoft }}>Loading…</p>}
      {error && <p style={{ color: colors.immediate }}>{error}</p>}
      {!loading && !error && visibleJobs.length === 0 && <p style={{ color: colors.inkSoft }}>No jobs match this view.</p>}

      {visibleJobs.length > 0 && (
        <label style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "10px", fontFamily: fonts.body, fontSize: "13px", color: colors.inkSoft, cursor: "pointer" }}>
          <input type="checkbox" checked={visibleJobs.every((j) => selectedIds.has(j.id))} onChange={toggleSelectAll} />
          Select all
        </label>
      )}

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
        flexShrink: 0,
        whiteSpace: "nowrap",
      }}
    >
      {label}
    </button>
  );
}

// Wraps a horizontally-scrollable chip row and fades its trailing edge
// whenever there's more content past the visible edge -- otherwise a
// scrollable strip that happens to fit its first few chips on screen is
// indistinguishable from a short, complete row, and nothing tells you to
// swipe. The fade clears itself once you've scrolled to the end.
function ScrollHintRow({ children, itemCount }) {
  const scrollRef = useRef(null);
  const [showFade, setShowFade] = useState(false);

  const updateFade = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    // A few px of slack so sub-pixel rounding at the true end doesn't
    // flicker the fade in and out.
    setShowFade(el.scrollWidth - el.clientWidth - el.scrollLeft > 4);
  }, []);

  useEffect(() => {
    updateFade();
    window.addEventListener("resize", updateFade);
    return () => window.removeEventListener("resize", updateFade);
    // itemCount: the chip list itself can grow after mount (e.g. statuses
    // load in async), which changes scrollWidth without the container's
    // own size changing, so re-check whenever the count changes.
  }, [updateFade, itemCount]);

  return (
    <div style={{ position: "relative", marginBottom: "12px" }}>
      <div
        ref={scrollRef}
        onScroll={updateFade}
        style={{ display: "flex", gap: "8px", flexWrap: "nowrap", overflowX: "auto", paddingBottom: "2px" }}
      >
        {children}
      </div>
      {showFade && (
        <div
          aria-hidden="true"
          style={{
            position: "absolute",
            top: 0,
            right: 0,
            bottom: "2px",
            width: "32px",
            background: `linear-gradient(to right, transparent, ${colors.bg})`,
            pointerEvents: "none",
          }}
        />
      )}
    </div>
  );
}
