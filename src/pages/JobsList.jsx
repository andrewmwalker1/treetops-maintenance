import { useEffect, useState, useCallback, useMemo } from "react";
import { Link, useSearchParams, useNavigationType } from "react-router-dom";
import { useAuth } from "../lib/AuthContext.jsx";
import { queryJobs } from "../lib/jobsQuery.js";
import { useViewAsJobFilter } from "../lib/simulateJobVisibility.js";
import { supabase } from "../lib/supabaseClient.js";
import { loadJobForPrint } from "../lib/loadJobForPrint.js";
import { openPrintWindow, writeAndPrintJobBundles, writeAndPrintJobsChecklist } from "../lib/printJobCards.jsx";
import JobCard from "../components/JobCard.jsx";
import { colors } from "../lib/theme.js";
import {
  Alert,
  Button,
  Card,
  Chip,
  EmptyState,
  IconFilter,
  IconPlus,
  Input,
  Modal,
  ModalFooter,
  PageHeader,
  SectionLabel,
  Select,
  SkeletonList,
} from "../ui/index.js";

// Dashboard stat tiles link here with a query param (?priority=medium,
// ?overdue=1, ?open=1) so "click a count, see those jobs" works without
// the two pages' filtering logic drifting apart. Kept separate from the
// status chips below since it's additive, not a replacement --
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

// Shared by visibleJobs' filtering and the filter-summary text below --
// same "kind:id" encoding (person/group/contractor) either way, so the
// slicing logic only needs to exist once.
function parseAssigneeFilter(value) {
  const colonIdx = value.indexOf(":");
  return { kind: value.slice(0, colonIdx), id: value.slice(colonIdx + 1) };
}

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

// JobDetail's back button (and the browser's own back button) land here as
// a POP -- that's the only round trip this storage is meant to survive.
// Arriving any other way (the Jobs nav link, Dashboard, a fresh page load)
// is a PUSH/REPLACE, and should start clean -- otherwise a selection from
// one visit (e.g. "select all" before printing) resurfaces, fully checked,
// on a completely unrelated later visit, since nothing else ever expires
// or clears this key.
function initialSelectedIds(navigationType) {
  if (navigationType === "POP") return loadStoredSelectedIds();
  sessionStorage.removeItem(SELECTED_IDS_STORAGE_KEY);
  return new Set();
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
  const navigationType = useNavigationType();
  const [selectedIds, setSelectedIds] = useState(() => initialSelectedIds(navigationType));
  const [printing, setPrinting] = useState(false);
  const [showFilterPanel, setShowFilterPanel] = useState(false);

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
      // Cancelled each have their own status chip already, so "All" is not
      // literally every job or it would bury the active work under history.
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
      const { kind, id: value } = parseAssigneeFilter(assigneeFilter);
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

  // Status/priority/assignee, condensed into one line shown under the
  // search box -- lets the Filter button's popup stay closed most of the
  // time while it's still obvious at a glance what's narrowing the list.
  const activeFilterCount = [activeStatusId !== null, activePriority !== null, assigneeFilter !== ""].filter(Boolean).length;

  const filterSummary = useMemo(() => {
    const parts = [];
    if (activeStatusId) {
      const s = statuses.find((s) => s.id === activeStatusId);
      if (s) parts.push(s.name);
    }
    if (activePriority) parts.push(`${activePriority.charAt(0).toUpperCase()}${activePriority.slice(1)} priority`);
    if (assigneeFilter) {
      const { kind, id } = parseAssigneeFilter(assigneeFilter);
      const list = kind === "person" ? assigneeOptions.people : kind === "group" ? assigneeOptions.groups : assigneeOptions.contractors;
      const name = list.find((o) => o.id === id)?.name;
      if (name) parts.push(kind === "group" ? `${name} (group)` : kind === "contractor" ? `${name} (contractor)` : name);
    }
    return parts.join(" · ");
  }, [activeStatusId, activePriority, assigneeFilter, statuses, assigneeOptions]);

  function clearAllFilters() {
    setActiveStatusId(null);
    setActivePriority(null);
    setAssigneeFilter("");
  }

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

  if (!activeSite) return <SkeletonList rows={3} />;

  return (
    <div>
      {/* Sticks to the top of <main>'s own scroll area (Layout.jsx made
          main the scrolling region, not the whole page) -- position:sticky
          needs no pixel math for the header's height because it's stuck
          relative to the nearest scrolling ancestor, not the viewport. The
          background match is what stops job cards from visibly scrolling
          up underneath it as this bar stays put.
          top/marginTop/paddingTop all read --page-pad, the same token
          <main> uses for its vertical padding (src/components/Layout.css) --
          sticky parks itself just inside a scroll container's padding by
          spec, leaving that padding strip as ordinary scrollable space that
          job cards keep sliding through. Pulling the sticky box up by that
          amount and re-adding it as its own padding covers the strip with
          this element's background instead. */}
      <div
        style={{
          position: "sticky",
          top: "calc(-1 * var(--page-pad))",
          marginTop: "calc(-1 * var(--page-pad))",
          paddingTop: "var(--page-pad)",
          paddingBottom: "var(--space-1)",
          background: colors.bg,
          zIndex: 5,
        }}
      >
        <PageHeader
          title="Jobs"
          actions={
            <>
              <Button as={Link} to="/checkout-kit">
                Checkout kit
              </Button>
              <Button as={Link} to="/checkin-kit">
                Check in kit
              </Button>
              <Button as={Link} to="/jobs/new" variant="primary" icon={<IconPlus size={15} />}>
                New job
              </Button>
            </>
          }
        />

        {selectedIds.size > 0 && (
          <Card
            pad="sm"
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              flexWrap: "wrap",
              gap: "var(--space-3)",
              marginBottom: "var(--space-3)",
            }}
          >
            <span style={{ fontSize: "var(--text-sm)", color: colors.mossDark }}>
              {selectedIds.size} job{selectedIds.size === 1 ? "" : "s"} selected
            </span>
            <div style={{ display: "flex", gap: "var(--space-2)" }}>
              <Button size="sm" variant="ghost" onClick={() => setSelectedIds(new Set())}>
                Clear
              </Button>
              <Button size="sm" onClick={handlePrintChecklist}>
                Print checklist
              </Button>
              <Button size="sm" variant="primary" loading={printing} onClick={handlePrintSelected}>
                {printing ? "Preparing…" : "Print selected"}
              </Button>
            </div>
          </Card>
        )}

        {quickFilter && (
          <Card
            pad="sm"
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: "var(--space-3)",
              marginBottom: "var(--space-3)",
            }}
          >
            <span style={{ textTransform: "capitalize", fontSize: "var(--text-sm)", color: colors.mossDark }}>
              Showing: {quickFilterLabel(quickFilter)}
            </span>
            <Button size="sm" variant="ghost" onClick={() => setSearchParams({})}>
              Clear
            </Button>
          </Card>
        )}

        {/* Status/priority/assignee used to be two always-visible chip strips
            plus a dropdown, permanently eating most of a mobile viewport's
            height before any job was visible. Collapsed into one Filter
            button (its popup holds all three) beside the search box, with
            the active selection condensed to one line underneath -- same
            filtering, far less sticky-header real estate. */}
        <div style={{ display: "flex", gap: "var(--space-2)", marginBottom: filterSummary ? "var(--space-1)" : "var(--space-4)" }}>
          <Button onClick={() => setShowFilterPanel(true)} icon={<IconFilter size={15} />} style={{ flexShrink: 0 }}>
            Filter{activeFilterCount > 0 ? ` (${activeFilterCount})` : ""}
          </Button>
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search jobs, people, or groups…"
            aria-label="Search jobs"
            style={{ flex: 1, minWidth: 0 }}
          />
        </div>

        {filterSummary && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "var(--space-2)",
              marginBottom: "var(--space-4)",
              fontSize: "var(--text-sm)",
              color: colors.inkSoft,
            }}
          >
            <span>{filterSummary}</span>
            <Button size="sm" variant="ghost" onClick={clearAllFilters}>
              Clear filters
            </Button>
          </div>
        )}
      </div>

      {showFilterPanel && (
        <Modal title="Filter jobs" onClose={() => setShowFilterPanel(false)}>
          <SectionLabel>Status</SectionLabel>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--space-2)", marginBottom: "var(--space-4)" }}>
            <Chip active={activeStatusId === null} onClick={() => setActiveStatusId(null)}>
              All
            </Chip>
            {statuses.map((s) => (
              <Chip key={s.id} active={activeStatusId === s.id} onClick={() => setActiveStatusId(s.id)}>
                {s.name}
              </Chip>
            ))}
          </div>

          <SectionLabel>Priority</SectionLabel>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--space-2)", marginBottom: "var(--space-4)" }}>
            <Chip active={activePriority === null} onClick={() => setActivePriority(null)}>
              All priorities
            </Chip>
            {PRIORITIES.map((p) => (
              <Chip key={p} active={activePriority === p} onClick={() => setActivePriority(p)}>
                {p.charAt(0).toUpperCase() + p.slice(1)}
              </Chip>
            ))}
          </div>

          {/* Only worth showing once the visible jobs actually span more
              than one assignee -- i.e. exactly when this user's
              role_visibility (or can_see_all_jobs) surfaces someone
              else's jobs alongside their own. */}
          {assigneeOptions.people.length + assigneeOptions.groups.length + assigneeOptions.contractors.length > 1 && (
            <div style={{ marginBottom: "var(--space-4)" }}>
              <SectionLabel>Assigned to</SectionLabel>
              <Select value={assigneeFilter} onChange={(e) => setAssigneeFilter(e.target.value)} aria-label="Assigned to">
                <option value="">Everyone</option>
                {assigneeOptions.groups.length > 0 && (
                  <optgroup label="By group">
                    {assigneeOptions.groups.map((g) => (
                      <option key={`group:${g.id}`} value={`group:${g.id}`}>
                        {g.name}
                      </option>
                    ))}
                  </optgroup>
                )}
                <optgroup label="By person">
                  {assigneeOptions.people.map((p) => (
                    <option key={`person:${p.id}`} value={`person:${p.id}`}>
                      {p.name}
                    </option>
                  ))}
                </optgroup>
                {assigneeOptions.contractors.length > 0 && (
                  <optgroup label="By contractor">
                    {assigneeOptions.contractors.map((c) => (
                      <option key={`contractor:${c.id}`} value={`contractor:${c.id}`}>
                        {c.name}
                      </option>
                    ))}
                  </optgroup>
                )}
              </Select>
            </div>
          )}

          <ModalFooter>
            <Button onClick={clearAllFilters}>Clear all</Button>
            <Button variant="primary" onClick={() => setShowFilterPanel(false)}>
              Done
            </Button>
          </ModalFooter>
        </Modal>
      )}

      {loading && <SkeletonList rows={4} height={92} />}
      {error && (
        <Alert tone="danger" title="Could not load jobs">
          {error}
        </Alert>
      )}
      {!loading && !error && visibleJobs.length === 0 && (
        <EmptyState
          title="No jobs match this view"
          action={
            activeFilterCount > 0 || search ? (
              <Button
                variant="primary"
                onClick={() => {
                  clearAllFilters();
                  setSearch("");
                  setSearchParams({});
                }}
              >
                Clear filters
              </Button>
            ) : (
              <Button as={Link} to="/jobs/new" variant="primary" icon={<IconPlus size={15} />}>
                New job
              </Button>
            )
          }
        >
          {activeFilterCount > 0 || search
            ? "Try widening the filters or clearing the search."
            : "Nothing is outstanding right now."}
        </EmptyState>
      )}

      {visibleJobs.length > 0 && (
        <label
          style={{
            display: "flex",
            alignItems: "center",
            gap: "var(--space-2)",
            marginBottom: "var(--space-3)",
            fontSize: "var(--text-sm)",
            color: colors.inkSoft,
            cursor: "pointer",
          }}
        >
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
