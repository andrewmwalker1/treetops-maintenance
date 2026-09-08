import { lazy, Suspense, useEffect, useState } from "react";
import { useAuth } from "../lib/AuthContext.jsx";
import { usePermissions } from "../lib/permissions.js";
import { supabase } from "../lib/supabaseClient.js";
import { colors, space } from "../lib/theme.js";
import {
  Alert, Button, Card, Chip, EmptyState, IconArrowDown, IconArrowUp, IconButton,
  IconSearch, Input, PageHeader, SkeletonList,
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
function DirectoriesPanel() {
  const [view, setView] = useState("contractors");
  const [loading, setLoading] = useState(true);
  const [contractors, setContractors] = useState([]);
  const [contractorCategories, setContractorCategories] = useState([]);
  const [directory, setDirectory] = useState([]);
  const [directoryCategories, setDirectoryCategories] = useState([]);
  const [query, setQuery] = useState("");
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

function DashboardTab({ items, setItems, links, docs, linkCategories, docCategories }) {
  const sorted = [...items].sort((a, b) => a.position - b.position);

  async function unpin(row) {
    setItems(items.filter((i) => i.id !== row.id));
    await supabase.from("office_hub_dashboard_items").delete().eq("id", row.id);
  }

  async function move(index, direction) {
    const target = index + direction;
    if (target < 0 || target >= sorted.length) return;
    const a = sorted[index], b = sorted[target];
    setItems(items.map((i) => (i.id === a.id ? { ...i, position: b.position } : i.id === b.id ? { ...i, position: a.position } : i)));
    await Promise.all([
      supabase.from("office_hub_dashboard_items").update({ position: b.position }).eq("id", a.id),
      supabase.from("office_hub_dashboard_items").update({ position: a.position }).eq("id", b.id),
    ]);
  }

  if (sorted.length === 0) {
    return <EmptyState title="Nothing pinned yet">Go to Browse and pin the links or documents you use most.</EmptyState>;
  }

  return (
    <div style={{ display: "grid", gap: space[3], gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))" }}>
      {sorted.map((row, i) => {
        const isLink = row.item_type === "link";
        const item = isLink ? links.find((l) => l.id === row.item_id) : docs.find((d) => d.id === row.item_id);
        if (!item) return null;
        return (
          <Card pad="sm" key={row.id}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "var(--space-2)" }}>
              <div style={{ fontWeight: 600 }}>{isLink ? item.label : item.title}</div>
              <IconButton size="sm" label="Unpin" onClick={() => unpin(row)}><IconArrowDown size={14} /></IconButton>
            </div>
            <div style={{ fontSize: "var(--text-xs)", color: colors.inkSoft, marginBottom: "var(--space-2)" }}>
              {categoryName(isLink ? linkCategories : docCategories, item.category_id)}
            </div>
            <div style={{ display: "flex", gap: "var(--space-2)" }}>
              <Button as="a" href={isLink ? item.url : item.file_url} target="_blank" rel="noreferrer" variant="primary">
                {isLink ? "Open" : "View"}
              </Button>
              <IconButton size="sm" label="Move up" onClick={() => move(i, -1)} disabled={i === 0}><IconArrowUp size={14} /></IconButton>
              <IconButton size="sm" label="Move down" onClick={() => move(i, 1)} disabled={i === sorted.length - 1}><IconArrowDown size={14} /></IconButton>
            </div>
          </Card>
        );
      })}
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

function BrowseTab({ links, linkCategories, docs, docCategories, dashboardItems, setDashboardItems, profileId }) {
  const [section, setSection] = useState("links");

  async function pin(itemType, itemId) {
    const nextPosition = dashboardItems.length ? Math.max(...dashboardItems.map((d) => d.position)) + 1 : 0;
    const { data, error } = await supabase
      .from("office_hub_dashboard_items")
      .insert({ profile_id: profileId, item_type: itemType, item_id: itemId, position: nextPosition })
      .select()
      .single();
    if (!error && data) setDashboardItems([...dashboardItems, data]);
  }
  async function unpin(itemType, itemId) {
    const row = dashboardItems.find((d) => d.item_type === itemType && d.item_id === itemId);
    if (!row) return;
    setDashboardItems(dashboardItems.filter((d) => d.id !== row.id));
    await supabase.from("office_hub_dashboard_items").delete().eq("id", row.id);
  }

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
      {section === "directories" && <DirectoriesPanel />}
    </div>
  );
}

export default function OfficeHub() {
  const { org, profile } = useAuth();
  const permissions = usePermissions();
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

  if (!canOfficeHub && !canLicenseAgreement) {
    return <EmptyState title="No access">You don't have permission to see Office Hub. Ask an admin to grant it in Roles &amp; Permissions.</EmptyState>;
  }

  return (
    <div>
      <PageHeader title="Office Hub" />
      {error && <Alert tone="danger" title="Something went wrong">{error}</Alert>}
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
        <DashboardTab items={dashboardItems} setItems={setDashboardItems} links={links} docs={docs} linkCategories={linkCategories} docCategories={docCategories} />
      ) : tab === "browse" ? (
        <BrowseTab links={links} linkCategories={linkCategories} docs={docs} docCategories={docCategories} dashboardItems={dashboardItems} setDashboardItems={setDashboardItems} profileId={profile.id} />
      ) : null}
    </div>
  );
}
