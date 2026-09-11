import { lazy, Suspense, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { DndContext, PointerSensor, closestCenter, useSensor, useSensors } from "@dnd-kit/core";
import { SortableContext, arrayMove, rectSortingStrategy, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useAuth } from "../lib/AuthContext.jsx";
import { usePermissions } from "../lib/permissions.js";
import { supabase } from "../lib/supabaseClient.js";
import { queryJobs } from "../lib/jobsQuery.js";
import { queryOpenKeyCheckouts } from "../lib/keysOutSummary.js";
import { tileColorValue } from "../lib/officeHubTiles.js";
import StatDial from "../components/StatDial.jsx";
import { colors, space } from "../lib/theme.js";
import {
  Alert, Button, Card, Chip, EmptyState,
  IconButton, IconClose, IconSearch, Input, PageHeader, SkeletonList,
} from "../ui/index.js";

// Lazy: pulls in docxtemplater/pizzip, needed only by whoever actually
// opens this tab, not everyone visiting Office Hub. Same reasoning as
// App.jsx's meter-tools routes.
const LicenseAgreement = lazy(() => import("./license-agreement/LicenseAgreement.jsx"));

const HUB_SUPABASE_URL = "https://ozhwgrzlpvfdemmogmav.supabase.co";
const HUB_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im96aHdncnpscHZmZGVtbW9nbWF2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODUwNDA2NDcsImV4cCI6MjEwMDYxNjY0N30.MPfUD5u-NSc6yRXsxd2KHHEI3ogFcekJBY8XI5kCq0Q";

// Contractors / places-to-eat live in Tree Tops Hub's own `hub` schema of
// this same Supabase project -- a separate app, genuinely isolated. This
// is a read-only REST fetch (anon key, Accept-Profile header), the same
// mechanism Hub uses for its own data -- not a cross-schema SQL query, so
// it doesn't touch the "never assume Hub/ParkMan2 tables are reachable
// from here" rule (see CLAUDE.md).
async function loadHubData(key, fallback) {
  try {
    const res = await fetch(
      `${HUB_SUPABASE_URL}/rest/v1/app_data?key=eq.${encodeURIComponent(key)}&select=value`,
      { headers: { apikey: HUB_ANON_KEY, Authorization: `Bearer ${HUB_ANON_KEY}`, "Accept-Profile": "hub" } }
    );
    if (!res.ok) return fallback;
    const rows = await res.json();
    return rows && rows.length > 0 ? rows[0].value : fallback;
  } catch {
    return fallback;
  }
}

const categoryName = (categories, id) => categories.find((c) => c.id === id)?.name || "Uncategorised";

// Same search-by-name/address/category + category-chip filtering Hub's
// own guest-facing Contractors/Explore screens already give customers
// (App.jsx's ContractorsScreen/DirectoryScreen there) -- kept in step
// deliberately rather than a plain unfiltered list, since staff have
// exactly as much need to quickly find one contractor among many.
function DirectoriesPanel({ initialQuery = "" }) {
  const [view, setView] = useState("contractors");
  const [loading, setLoading] = useState(true);
  const [contractors, setContractors] = useState([]);
  const [contractorCategories, setContractorCategories] = useState([]);
  const [directory, setDirectory] = useState([]);
  const [directoryCategories, setDirectoryCategories] = useState([]);
  const [query, setQuery] = useState(initialQuery);
  const [categoryId, setCategoryId] = useState("all");

  useEffect(() => {
    Promise.all([
      loadHubData("contractors", []),
      loadHubData("contractorCategories", []),
      loadHubData("directory", []),
      loadHubData("directoryCategories", []),
    ]).then(([ct, ctc, d, dc]) => {
      setContractors(ct); setContractorCategories(ctc); setDirectory(d); setDirectoryCategories(dc);
      setLoading(false);
    });
  }, []);

  function switchView(next) {
    setView(next);
    setQuery("");
    setCategoryId("all");
  }

  const rows = view === "contractors" ? contractors : directory;
  const categories = view === "contractors" ? contractorCategories : directoryCategories;
  const pillOptions = [{ id: "all", name: "All" }, ...categories];

  const q = query.trim().toLowerCase();
  const filtered = rows
    .filter((r) => categoryId === "all" || r.categoryId === categoryId)
    .filter((r) => {
      if (!q) return true;
      return (
        r.name.toLowerCase().includes(q) ||
        (r.address || "").toLowerCase().includes(q) ||
        categoryName(categories, r.categoryId).toLowerCase().includes(q)
      );
    })
    .sort((a, b) => (view === "explore" ? (a.mins ?? 9999) - (b.mins ?? 9999) : 0));

  return (
    <div>
      <p style={{ fontSize: "var(--text-xs)", color: colors.inkSoft, marginTop: 0 }}>
        Read-only — pulled live from Tree Tops Hub. Manage these in Hub's own admin portal.
      </p>
      <div style={{ display: "flex", gap: "var(--space-2)", marginBottom: "var(--space-3)" }}>
        <Button variant={view === "contractors" ? "primary" : "secondary"} onClick={() => switchView("contractors")}>Contractors</Button>
        <Button variant={view === "explore" ? "primary" : "secondary"} onClick={() => switchView("explore")}>Places to Explore</Button>
      </div>

      {loading ? (
        <SkeletonList rows={3} height={56} />
      ) : (
        <>
          <div style={{ position: "relative", marginBottom: "var(--space-2)" }}>
            <IconSearch size={15} color={colors.inkSoft} style={{ position: "absolute", left: 10, top: 10 }} />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={view === "contractors" ? "Search by name or service..." : "Search by name or area..."}
              style={{ paddingLeft: 32, width: "100%" }}
            />
          </div>
          <div style={{ display: "flex", gap: "var(--space-2)", overflowX: "auto", paddingBottom: 2, marginBottom: "var(--space-3)" }}>
            {pillOptions.map((c) => (
              <Chip key={c.id} active={categoryId === c.id} onClick={() => setCategoryId(c.id)} style={{ flexShrink: 0 }}>
                {c.name}
              </Chip>
            ))}
          </div>
          <p style={{ fontSize: "var(--text-xs)", color: colors.inkSoft, margin: "0 0 var(--space-2)" }}>
            {filtered.length} {filtered.length === 1 ? "result" : "results"}
          </p>
          {filtered.length === 0 ? (
            <EmptyState title="No matches">Try a different search or category.</EmptyState>
          ) : (
            filtered.map((r) => (
              <Card pad="sm" key={r.id} style={{ marginBottom: "var(--space-2)" }}>
                <div style={{ fontWeight: 600 }}>{r.name}</div>
                <div style={{ fontSize: "var(--text-xs)", color: colors.inkSoft }}>
                  {categoryName(categories, r.categoryId)}{r.phone ? ` · ${r.phone}` : ""}{r.address ? ` · ${r.address}` : ""}
                </div>
              </Card>
            ))
          )}
        </>
      )}
    </div>
  );
}

// Resolves a pinned row (which only knows item_type/item_id) to the
// actual link or document it points at, plus that item's tile styling.
function resolveTile(row, links, docs) {
  const isLink = row.item_type === "link";
  const item = isLink ? links.find((l) => l.id === row.item_id) : docs.find((d) => d.id === row.item_id);
  if (!item) return null;
  return {
    isLink,
    item,
    title: isLink ? item.label : item.title,
    href: isLink ? item.url : item.file_url,
    color: tileColorValue(item.color),
  };
}

const TILE_BASE_STYLE = {
  aspectRatio: "1",
  borderRadius: "var(--radius-md)",
  display: "flex",
  flexDirection: "column",
  justifyContent: "flex-end",
  padding: "var(--space-2)",
  color: colors.onDark,
  boxShadow: "var(--shadow-card)",
  position: "relative",
  textDecoration: "none",
};

// Normal (non-editing) view -- the whole tile is a plain link, nothing
// else to click. Solid colour + a large icon glyph + label, launcher
// style, rather than the previous card-with-buttons treatment.
function StaticTile({ tile }) {
  return (
    <a href={tile.href} target="_blank" rel="noreferrer" style={{ ...TILE_BASE_STYLE, background: tile.color }}>
      <span style={{ position: "absolute", top: "var(--space-2)", left: "var(--space-2)", fontSize: "var(--text-lg)" }}>{tile.item.icon}</span>
      <span style={{ fontSize: "var(--text-xs)", fontWeight: 700, lineHeight: 1.25 }}>{tile.title}</span>
    </a>
  );
}

// Edit-mode tile -- draggable (the whole tile is the drag surface; a
// short activation distance on the sensor, set where DndContext is
// created, keeps the Remove button clickable without starting a drag),
// with a remove button. Not a real link while editing, since "drag to
// reorder" and "tap to open a new tab" can't both own a plain tap.
function DraggableTile({ row, tile, onRemove }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: row.id });
  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      style={{
        ...TILE_BASE_STYLE,
        background: tile.color,
        cursor: "grab",
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.4 : 1,
        outline: `2px dashed ${colors.onDarkMuted}`,
        outlineOffset: 2,
      }}
    >
      <IconButton
        size="sm"
        label={`Unpin ${tile.title}`}
        onClick={(e) => {
          e.stopPropagation();
          onRemove();
        }}
        style={{
          position: "absolute",
          top: -6,
          left: -6,
          width: 20,
          height: 20,
          padding: 0,
          borderRadius: "var(--radius-full)",
          background: colors.immediate,
          color: colors.onDark,
        }}
      >
        <IconClose size={11} />
      </IconButton>
      <span style={{ position: "absolute", top: "var(--space-2)", left: "var(--space-2)", fontSize: "var(--text-lg)" }}>{tile.item.icon}</span>
      <span style={{ fontSize: "var(--text-xs)", fontWeight: 700, lineHeight: 1.25 }}>{tile.title}</span>
    </div>
  );
}

function DashboardTab({ items, setItems, links, docs, pin, unpin }) {
  const [editing, setEditing] = useState(false);
  const [showLibrary, setShowLibrary] = useState(false);
  const sorted = [...items].sort((a, b) => a.position - b.position);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const pinnedKeys = new Set(items.map((i) => `${i.item_type}:${i.item_id}`));
  const availableLinks = links.filter((l) => !pinnedKeys.has(`link:${l.id}`));
  const availableDocs = docs.filter((d) => !pinnedKeys.has(`document:${d.id}`));

  async function handleUnpin(row) {
    setItems(items.filter((i) => i.id !== row.id));
    await unpin(row.item_type, row.item_id);
  }

  function handleDragEnd(event) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = sorted.findIndex((r) => r.id === active.id);
    const newIndex = sorted.findIndex((r) => r.id === over.id);
    const reordered = arrayMove(sorted, oldIndex, newIndex).map((row, i) => ({ ...row, position: i }));
    setItems(items.map((r) => reordered.find((u) => u.id === r.id) || r));
    Promise.all(reordered.map((row) => supabase.from("office_hub_dashboard_items").update({ position: row.position }).eq("id", row.id)));
  }

  const tiles = sorted.map((row) => ({ row, tile: resolveTile(row, links, docs) })).filter((t) => t.tile);

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "var(--space-3)" }}>
        <PageHeader title="My Dashboard" level={2} />
        <Button
          variant={editing ? "primary" : "secondary"}
          onClick={() => {
            setEditing((e) => !e);
            setShowLibrary(false);
          }}
        >
          {editing ? "Done" : "✎ Edit layout"}
        </Button>
      </div>

      {tiles.length === 0 && !editing && (
        <EmptyState title="Nothing pinned yet">Tap "Edit layout" to add the links or documents you use most.</EmptyState>
      )}

      {(tiles.length > 0 || editing) && (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={editing ? handleDragEnd : undefined}>
          <SortableContext items={tiles.map((t) => t.row.id)} strategy={rectSortingStrategy}>
            <div style={{ display: "grid", gap: space[3], gridTemplateColumns: "repeat(auto-fill, minmax(110px, 1fr))" }}>
              {tiles.map(({ row, tile }) =>
                editing ? (
                  <DraggableTile key={row.id} row={row} tile={tile} onRemove={() => handleUnpin(row)} />
                ) : (
                  <StaticTile key={row.id} tile={tile} />
                )
              )}
              {editing && (
                <Button
                  onClick={() => setShowLibrary((s) => !s)}
                  style={{
                    ...TILE_BASE_STYLE,
                    background: "transparent",
                    border: `1.5px dashed ${colors.lineStrong}`,
                    boxShadow: "none",
                    color: colors.inkSoft,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <span style={{ fontSize: "var(--text-2xl)", fontWeight: 300 }}>+</span>
                </Button>
              )}
            </div>
          </SortableContext>
        </DndContext>
      )}

      {editing && showLibrary && (
        <Card pad="sm" style={{ marginTop: "var(--space-3)" }}>
          <div style={{ fontSize: "var(--text-xs)", fontWeight: 600, color: colors.inkSoft, marginBottom: "var(--space-2)" }}>
            Add from library
          </div>
          {availableLinks.length === 0 && availableDocs.length === 0 && (
            <p style={{ margin: 0, fontSize: "var(--text-sm)", color: colors.inkSoft }}>Everything's already pinned.</p>
          )}
          {availableLinks.map((l) => (
            <div key={l.id} style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", padding: "var(--space-2) 0", borderTop: `1px solid ${colors.line}` }}>
              <span
                style={{
                  width: 24, height: 24, borderRadius: "var(--radius-sm)", background: tileColorValue(l.color),
                  display: "flex", alignItems: "center", justifyContent: "center", fontSize: "var(--text-sm)", flexShrink: 0,
                }}
              >
                {l.icon}
              </span>
              <span style={{ fontSize: "var(--text-sm)", flex: 1, minWidth: 0 }}>{l.label}</span>
              <Button size="sm" variant="primary" onClick={() => pin("link", l.id)}>+ Add</Button>
            </div>
          ))}
          {availableDocs.map((d) => (
            <div key={d.id} style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", padding: "var(--space-2) 0", borderTop: `1px solid ${colors.line}` }}>
              <span
                style={{
                  width: 24, height: 24, borderRadius: "var(--radius-sm)", background: tileColorValue(d.color),
                  display: "flex", alignItems: "center", justifyContent: "center", fontSize: "var(--text-sm)", flexShrink: 0,
                }}
              >
                {d.icon}
              </span>
              <span style={{ fontSize: "var(--text-sm)", flex: 1, minWidth: 0 }}>{d.title}</span>
              <Button size="sm" variant="primary" onClick={() => pin("document", d.id)}>+ Add</Button>
            </div>
          ))}
        </Card>
      )}
    </div>
  );
}

function BrowseList({ items, categories, isLink, dashboardItems, onPin, onUnpin }) {
  const itemType = isLink ? "link" : "document";
  const isPinned = (id) => dashboardItems.some((d) => d.item_type === itemType && d.item_id === id);
  if (items.length === 0) return <EmptyState title="Nothing here yet" />;
  return (
    <div>
      {items.map((item) => (
        <Card pad="sm" key={item.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "var(--space-3)", marginBottom: "var(--space-2)" }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontWeight: 600 }}>{isLink ? item.label : item.title}</div>
            <div style={{ fontSize: "var(--text-xs)", color: colors.inkSoft }}>{categoryName(categories, item.category_id)}</div>
          </div>
          <div style={{ display: "flex", gap: "var(--space-2)", flexShrink: 0 }}>
            <Button as="a" href={isLink ? item.url : item.file_url} target="_blank" rel="noreferrer">{isLink ? "Open" : "View"}</Button>
            <Button
              variant={isPinned(item.id) ? "primary" : "secondary"}
              onClick={() => (isPinned(item.id) ? onUnpin(item.id) : onPin(item.id))}
            >
              {isPinned(item.id) ? "Pinned" : "Pin"}
            </Button>
          </div>
        </Card>
      ))}
    </div>
  );
}

function BrowseTab({ links, linkCategories, docs, docCategories, dashboardItems, pin, unpin, initialSection = "links", initialQuery = "" }) {
  const [section, setSection] = useState(initialSection);

  return (
    <div>
      <div style={{ display: "flex", gap: "var(--space-2)", marginBottom: "var(--space-3)" }}>
        <Button variant={section === "links" ? "primary" : "secondary"} onClick={() => setSection("links")}>Links</Button>
        <Button variant={section === "documents" ? "primary" : "secondary"} onClick={() => setSection("documents")}>Documents</Button>
        <Button variant={section === "directories" ? "primary" : "secondary"} onClick={() => setSection("directories")}>Directories</Button>
      </div>
      {section === "links" && (
        <BrowseList items={links} categories={linkCategories} isLink dashboardItems={dashboardItems} onPin={(id) => pin("link", id)} onUnpin={(id) => unpin("link", id)} />
      )}
      {section === "documents" && (
        <BrowseList items={docs} categories={docCategories} isLink={false} dashboardItems={dashboardItems} onPin={(id) => pin("document", id)} onUnpin={(id) => unpin("document", id)} />
      )}
      {section === "directories" && <DirectoriesPanel initialQuery={initialQuery} />}
    </div>
  );
}

// The live "does anything need me today" strip -- dials reuse StatDial
// as-is (same component the main Dashboard renders) so Office Hub reads
// as part of the same system rather than a bolted-on bookmarks page.
// "My jobs" sits first since it's the one number that's different for
// every person who opens this page; the rest are office-wide signals
// several of which (keys out, faulty equipment) the main Dashboard
// already computes the same way. Sits above the tabs, not inside the
// Dashboard tab, since "does anything need me" is relevant regardless of
// which tab you're actually browsing.
function SignalStrip({ counts, onSearch }) {
  const [query, setQuery] = useState("");
  return (
    <div style={{ marginBottom: "var(--space-5)" }}>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(110px, 1fr))",
          gap: "var(--space-3)",
          marginBottom: "var(--space-3)",
        }}
      >
        <StatDial label="My jobs" value={counts.mine} onClick={counts.onMine} />
        <StatDial label="Office jobs" value={counts.office} color={colors.gold} onClick={counts.onOffice} />
        <StatDial
          label="Overdue"
          value={counts.overdue}
          color={counts.overdue ? colors.immediate : colors.moss}
          onClick={counts.onOverdue}
        />
        <StatDial label="Keys out" value={counts.keysOut} onClick={counts.onKeysOut} />
        <StatDial
          label="Faulty kit"
          value={counts.faulty}
          color={counts.faulty ? colors.immediate : colors.moss}
          onClick={counts.onFaulty}
        />
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (query.trim()) onSearch(query.trim());
        }}
        style={{ display: "flex", gap: "var(--space-2)" }}
      >
        <div style={{ position: "relative", flex: 1 }}>
          <IconSearch size={15} color={colors.inkSoft} style={{ position: "absolute", left: 10, top: 10 }} />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search contractors or places to eat…"
            aria-label="Search contractors or places to eat"
            style={{ paddingLeft: 32, width: "100%" }}
          />
        </div>
        <Button type="submit" variant="primary" disabled={!query.trim()}>
          Search
        </Button>
      </form>
    </div>
  );
}

export default function OfficeHub() {
  const { org, profile, activeSite } = useAuth();
  const permissions = usePermissions();
  const navigate = useNavigate();
  const canOfficeHub = permissions.has("can_use_office_hub");
  const canLicenseAgreement = permissions.has("can_use_license_agreement");
  const [tab, setTab] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [links, setLinks] = useState([]);
  const [linkCategories, setLinkCategories] = useState([]);
  const [docs, setDocs] = useState([]);
  const [docCategories, setDocCategories] = useState([]);
  const [dashboardItems, setDashboardItems] = useState([]);

  // Everything the signal strip's dials count -- kept separate from the
  // links/docs/pins load above since none of it gates "is Office Hub
  // usable at all" the way that data does, and a couple of these queries
  // are permission-gated at the RLS level (equipment/contractor documents)
  // rather than by can_use_office_hub.
  const [myJobsOpen, setMyJobsOpen] = useState([]);
  const [officeJobsOpen, setOfficeJobsOpen] = useState([]);
  const [officeGroupId, setOfficeGroupId] = useState(null);
  const [keysOutCount, setKeysOutCount] = useState(0);
  const [faultyCount, setFaultyCount] = useState(0);
  const [directorySearch, setDirectorySearch] = useState("");

  const availableTabs = [
    canOfficeHub && "dashboard",
    canOfficeHub && "browse",
    canLicenseAgreement && "license-agreement",
  ].filter(Boolean);

  // Lands on whichever tab this person can actually see, rather than
  // always defaulting to "dashboard" -- someone with only License
  // Agreement access would otherwise land on a tab they can't use.
  useEffect(() => {
    if (availableTabs.length && !availableTabs.includes(tab)) setTab(availableTabs[0]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [availableTabs.join(",")]);

  useEffect(() => {
    if (!org || !canOfficeHub) return;
    Promise.all([
      supabase.from("office_hub_link_categories").select("*").eq("org_id", org.id).order("sort_order"),
      supabase.from("office_hub_links").select("*").eq("org_id", org.id).order("sort_order"),
      supabase.from("office_hub_doc_categories").select("*").eq("org_id", org.id).order("sort_order"),
      supabase.from("office_hub_documents").select("*").eq("org_id", org.id).order("sort_order"),
      supabase.from("office_hub_dashboard_items").select("*").eq("profile_id", profile.id),
    ]).then(([lc, l, dc, d, di]) => {
      if (lc.error || l.error || dc.error || d.error || di.error) {
        setError((lc.error || l.error || dc.error || d.error || di.error).message);
      }
      setLinkCategories(lc.data || []);
      setLinks(l.data || []);
      setDocCategories(dc.data || []);
      setDocs(d.data || []);
      setDashboardItems(di.data || []);
      setLoading(false);
    });
  }, [org, profile?.id, canOfficeHub]);

  useEffect(() => {
    if (!activeSite || !canOfficeHub) return;
    queryJobs(activeSite.id, { assigneeProfileId: profile.id })
      .then((rows) => setMyJobsOpen(rows.filter((j) => !j.job_status?.is_completed)))
      .catch(() => {});
  }, [activeSite, profile?.id, canOfficeHub]);

  useEffect(() => {
    if (!org || !canOfficeHub) return;
    supabase
      .from("groups")
      .select("id")
      .eq("org_id", org.id)
      .eq("name", "Office")
      .maybeSingle()
      .then(({ data }) => setOfficeGroupId(data?.id || null));
  }, [org, canOfficeHub]);

  useEffect(() => {
    if (!activeSite || !officeGroupId) return;
    queryJobs(activeSite.id, { assigneeGroupId: officeGroupId })
      .then((rows) => setOfficeJobsOpen(rows.filter((j) => !j.job_status?.is_completed)))
      .catch(() => {});
  }, [activeSite, officeGroupId]);

  useEffect(() => {
    if (!activeSite || !canOfficeHub || !permissions.has("can_use_key_system")) return;
    queryOpenKeyCheckouts(activeSite.id).then((rows) => setKeysOutCount(rows.length));
  }, [activeSite, canOfficeHub, permissions]);

  useEffect(() => {
    if (!org || !canOfficeHub) return;
    supabase
      .from("equipment")
      .select("id", { count: "exact", head: true })
      .eq("org_id", org.id)
      .eq("status", "faulty")
      .then(({ count }) => setFaultyCount(count || 0));
  }, [org, canOfficeHub]);

  function jumpToDirectorySearch(q) {
    setDirectorySearch(q);
    setTab("browse");
  }

  // Shared by the Dashboard tab's tile grid (edit mode's "+" library
  // panel) and the Browse tab's Pin buttons -- one implementation of
  // "add/remove this item from my personal dashboard" for both.
  async function pin(itemType, itemId) {
    const nextPosition = dashboardItems.length ? Math.max(...dashboardItems.map((d) => d.position)) + 1 : 0;
    const { data, error: err } = await supabase
      .from("office_hub_dashboard_items")
      .insert({ profile_id: profile.id, item_type: itemType, item_id: itemId, position: nextPosition })
      .select()
      .single();
    if (!err && data) setDashboardItems((prev) => [...prev, data]);
  }
  async function unpin(itemType, itemId) {
    const row = dashboardItems.find((d) => d.item_type === itemType && d.item_id === itemId);
    if (!row) return;
    setDashboardItems((prev) => prev.filter((d) => d.id !== row.id));
    await supabase.from("office_hub_dashboard_items").delete().eq("id", row.id);
  }

  if (!canOfficeHub && !canLicenseAgreement) {
    return <EmptyState title="No access">You don't have permission to see Office Hub. Ask an admin to grant it in Roles &amp; Permissions.</EmptyState>;
  }

  const overdueCount = [...myJobsOpen, ...officeJobsOpen].filter((j) => j.due_date && new Date(j.due_date) < new Date()).length;

  return (
    <div>
      <PageHeader title="Office Hub" />
      {error && <Alert tone="danger" title="Something went wrong">{error}</Alert>}

      {canOfficeHub && (
        <SignalStrip
          counts={{
            mine: myJobsOpen.length,
            onMine: () => navigate(`/?assignee=person:${profile.id}`),
            office: officeJobsOpen.length,
            onOffice: officeGroupId ? () => navigate(`/?assignee=group:${officeGroupId}`) : undefined,
            // Scoped to mine + Office's above, but a single assignee filter
            // can't express "either of two assignees" at once -- links to
            // the same overdue view the main Dashboard's own tile uses
            // (a superset of what's counted) rather than a filter combo
            // the Jobs list doesn't support.
            overdue: overdueCount,
            onOverdue: () => navigate("/?overdue=1"),
            keysOut: keysOutCount,
            onKeysOut: () => navigate("/dashboard"),
            faulty: faultyCount,
            onFaulty: () => navigate("/equipment?status=faulty"),
          }}
          onSearch={jumpToDirectorySearch}
        />
      )}

      <div style={{ display: "flex", gap: "var(--space-2)", marginBottom: "var(--space-4)" }}>
        {canOfficeHub && <Button variant={tab === "dashboard" ? "primary" : "secondary"} onClick={() => setTab("dashboard")}>My Dashboard</Button>}
        {canOfficeHub && <Button variant={tab === "browse" ? "primary" : "secondary"} onClick={() => setTab("browse")}>Browse</Button>}
        {canLicenseAgreement && <Button variant={tab === "license-agreement" ? "primary" : "secondary"} onClick={() => setTab("license-agreement")}>License Agreement</Button>}
      </div>
      {tab === "license-agreement" ? (
        <Suspense fallback={<SkeletonList rows={3} height={80} />}>
          <LicenseAgreement />
        </Suspense>
      ) : loading && canOfficeHub ? (
        <SkeletonList rows={3} height={80} />
      ) : tab === "dashboard" ? (
        <DashboardTab items={dashboardItems} setItems={setDashboardItems} links={links} docs={docs} pin={pin} unpin={unpin} />
      ) : tab === "browse" ? (
        <BrowseTab
          links={links}
          linkCategories={linkCategories}
          docs={docs}
          docCategories={docCategories}
          dashboardItems={dashboardItems}
          pin={pin}
          unpin={unpin}
          initialSection={directorySearch ? "directories" : "links"}
          initialQuery={directorySearch}
        />
      ) : null}
    </div>
  );
}
