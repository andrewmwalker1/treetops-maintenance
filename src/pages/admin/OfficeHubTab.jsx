import { useEffect, useState } from "react";
import { useAuth } from "../../lib/AuthContext.jsx";
import { supabase } from "../../lib/supabaseClient.js";
import { colors } from "../../lib/theme.js";
import { TILE_COLORS, TILE_ICONS, tileColorValue } from "../../lib/officeHubTiles.js";
import {
  Alert, Button, Card, EmptyState, IconArrowDown, IconArrowUp, IconButton,
  Input, Modal, PageHeader, Select, Textarea,
} from "../../ui/index.js";

// Shared by the Links and Documents forms below -- picking a tile's
// colour and icon is the same interaction either way.
function TileStyleFields({ color, icon, onChange }) {
  return (
    <>
      <div style={{ marginBottom: "var(--space-3)" }}>
        <label style={{ display: "block", fontSize: "var(--text-xs)", fontWeight: 600, color: colors.inkSoft, marginBottom: "var(--space-2)" }}>
          Tile colour
        </label>
        <div style={{ display: "flex", gap: "var(--space-2)", flexWrap: "wrap" }}>
          {TILE_COLORS.map((c) => (
            <button
              key={c.key}
              type="button"
              aria-label={c.label}
              aria-pressed={color === c.key}
              onClick={() => onChange({ color: c.key })}
              style={{
                width: 30,
                height: 30,
                borderRadius: "var(--radius-sm)",
                background: c.value,
                border: color === c.key ? `2px solid ${colors.ink}` : "2px solid transparent",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: colors.onDark,
                fontSize: "var(--text-sm)",
                fontWeight: 700,
              }}
            >
              {color === c.key ? "✓" : ""}
            </button>
          ))}
        </div>
      </div>
      <div style={{ marginBottom: "var(--space-3)" }}>
        <label style={{ display: "block", fontSize: "var(--text-xs)", fontWeight: 600, color: colors.inkSoft, marginBottom: "var(--space-2)" }}>
          Icon
        </label>
        <div style={{ display: "flex", gap: "var(--space-2)", flexWrap: "wrap" }}>
          {TILE_ICONS.map((emoji) => (
            <button
              key={emoji}
              type="button"
              aria-label={`Icon ${emoji}`}
              aria-pressed={icon === emoji}
              onClick={() => onChange({ icon: emoji })}
              style={{
                width: 32,
                height: 32,
                borderRadius: "var(--radius-sm)",
                background: colors.paper,
                border: icon === emoji ? `2px solid ${colors.moss}` : `1px solid ${colors.lineStrong}`,
                cursor: "pointer",
                fontSize: "var(--text-md)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {emoji}
            </button>
          ))}
        </div>
      </div>
    </>
  );
}

// The small colour+icon preview shown next to each row in the admin
// list, so an admin can tell tiles apart without opening each one.
function TileSwatch({ color, icon }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: 28,
        height: 28,
        borderRadius: "var(--radius-sm)",
        background: tileColorValue(color),
        fontSize: "var(--text-sm)",
        flexShrink: 0,
      }}
    >
      {icon}
    </span>
  );
}

const UPLOAD_BUCKET = "office-hub-files";
const ATTACHMENT_TYPES = ["application/pdf", "image/jpeg", "image/png"];

async function uploadFile(file) {
  const safeName = file.name.replace(/[^a-zA-Z0-9.\-_]/g, "-");
  const path = `${Date.now()}-${crypto.randomUUID()}-${safeName}`;
  const { error } = await supabase.storage.from(UPLOAD_BUCKET).upload(path, file, { contentType: file.type || "application/octet-stream" });
  if (error) throw new Error(`Upload failed: ${error.message}`);
  const { data } = supabase.storage.from(UPLOAD_BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

const blankCategory = { id: null, name: "" };

function CategoriesPanel({ table, categories, items, orgId, itemLabel, onSaved }) {
  const [form, setForm] = useState(null);
  const [error, setError] = useState(null);

  async function handleSave(e) {
    e.preventDefault();
    setError(null);
    const payload = { org_id: orgId, name: form.name };
    const { error: err } = form.id
      ? await supabase.from(table).update(payload).eq("id", form.id)
      : await supabase.from(table).insert({ ...payload, sort_order: categories.length });
    if (err) { setError(err.message); return; }
    setForm(null);
    onSaved();
  }

  async function handleDelete(id) {
    const { error: err } = await supabase.from(table).delete().eq("id", id);
    if (err) setError(err.message);
    else onSaved();
  }

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "var(--space-2)" }}>
        <PageHeader title="Categories" level={2} />
        <Button variant="primary" onClick={() => { setError(null); setForm(blankCategory); }}>+ Add category</Button>
      </div>
      {categories.map((c) => {
        const count = items.filter((i) => i.category_id === c.id).length;
        return (
          <Card pad="sm" key={c.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "var(--space-2)" }}>
            <div>
              <div style={{ fontWeight: 600 }}>{c.name}</div>
              <div style={{ fontSize: "var(--text-xs)", color: colors.inkSoft }}>{count} {count === 1 ? itemLabel : `${itemLabel}s`}</div>
            </div>
            <div style={{ display: "flex", gap: "var(--space-2)" }}>
              <Button onClick={() => { setError(null); setForm({ id: c.id, name: c.name }); }}>Edit</Button>
              <Button variant="danger" onClick={() => handleDelete(c.id)}>Delete</Button>
            </div>
          </Card>
        );
      })}
      {categories.length === 0 && <EmptyState title="No categories yet" />}
      {form && (
        <Modal title={form.id ? "Rename category" : "New category"} onClose={() => setForm(null)}>
          <form onSubmit={handleSave}>
            <Input required autoFocus value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Internal Apps" style={{ marginBottom: "var(--space-3)" }} />
            {error && <Alert tone="danger" title="Something went wrong">{error}</Alert>}
            <div style={{ display: "flex", gap: "var(--space-2)" }}>
              <Button variant="primary" type="submit">{form.id ? "Save changes" : "Add category"}</Button>
              <Button onClick={() => setForm(null)}>Cancel</Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}

const blankLink = { id: null, category_id: "", label: "", url: "", description: "", color: TILE_COLORS[0].key, icon: TILE_ICONS[0] };

function LinksPanel({ links, categories, orgId, onSaved }) {
  const [form, setForm] = useState(null);
  const [error, setError] = useState(null);

  function editLink(l) {
    setError(null);
    setForm({
      id: l.id,
      category_id: l.category_id || "",
      label: l.label,
      url: l.url,
      description: l.description || "",
      color: l.color || TILE_COLORS[0].key,
      icon: l.icon || TILE_ICONS[0],
    });
  }

  async function handleSave(e) {
    e.preventDefault();
    setError(null);
    const payload = {
      org_id: orgId,
      category_id: form.category_id || null,
      label: form.label,
      url: form.url,
      description: form.description,
      color: form.color,
      icon: form.icon,
    };
    const { error: err } = form.id
      ? await supabase.from("office_hub_links").update(payload).eq("id", form.id)
      : await supabase.from("office_hub_links").insert({ ...payload, sort_order: links.length });
    if (err) { setError(err.message); return; }
    setForm(null);
    onSaved();
  }

  async function handleDelete(id) {
    const { error: err } = await supabase.from("office_hub_links").delete().eq("id", id);
    if (err) setError(err.message);
    else onSaved();
  }

  async function move(index, direction) {
    const target = index + direction;
    if (target < 0 || target >= links.length) return;
    const a = links[index], b = links[target];
    await Promise.all([
      supabase.from("office_hub_links").update({ sort_order: b.sort_order }).eq("id", a.id),
      supabase.from("office_hub_links").update({ sort_order: a.sort_order }).eq("id", b.id),
    ]);
    onSaved();
  }

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "var(--space-2)" }}>
        <PageHeader title="Links" level={2} />
        <Button variant="primary" onClick={() => { setError(null); setForm({ ...blankLink, category_id: categories[0]?.id || "" }); }}>+ Add link</Button>
      </div>
      {links.map((l, i) => (
        <Card pad="sm" key={l.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "var(--space-3)", marginBottom: "var(--space-2)", flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)", minWidth: 0 }}>
            <TileSwatch color={l.color} icon={l.icon} />
            <div style={{ minWidth: 0 }}>
              <div style={{ fontWeight: 600 }}>{l.label}</div>
              <div style={{ fontSize: "var(--text-xs)", color: colors.inkSoft }}>{categories.find((c) => c.id === l.category_id)?.name || "Uncategorised"} · {l.url}</div>
            </div>
          </div>
          <div style={{ display: "flex", gap: "var(--space-2)" }}>
            <IconButton size="sm" label="Move up" onClick={() => move(i, -1)} disabled={i === 0}><IconArrowUp size={14} /></IconButton>
            <IconButton size="sm" label="Move down" onClick={() => move(i, 1)} disabled={i === links.length - 1}><IconArrowDown size={14} /></IconButton>
            <Button onClick={() => editLink(l)}>Edit</Button>
            <Button variant="danger" onClick={() => handleDelete(l.id)}>Delete</Button>
          </div>
        </Card>
      ))}
      {links.length === 0 && <EmptyState title="No links yet" />}
      {form && (
        <Modal title={form.id ? "Edit link" : "New link"} onClose={() => setForm(null)}>
          <form onSubmit={handleSave}>
            <Input required value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} placeholder="e.g. Customer Hub" style={{ marginBottom: "var(--space-3)" }} />
            <Select value={form.category_id} onChange={(e) => setForm({ ...form, category_id: e.target.value })} style={{ marginBottom: "var(--space-3)" }}>
              <option value="">Uncategorised</option>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </Select>
            <Input required type="url" value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })} placeholder="https://..." style={{ marginBottom: "var(--space-3)" }} />
            <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Description (optional)" style={{ marginBottom: "var(--space-3)" }} />
            <TileStyleFields color={form.color} icon={form.icon} onChange={(patch) => setForm({ ...form, ...patch })} />
            {error && <Alert tone="danger" title="Something went wrong">{error}</Alert>}
            <div style={{ display: "flex", gap: "var(--space-2)" }}>
              <Button variant="primary" type="submit">{form.id ? "Save changes" : "Add link"}</Button>
              <Button onClick={() => setForm(null)}>Cancel</Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}

const blankDoc = { id: null, category_id: "", title: "", file_url: "", description: "", color: "slate", icon: "📄" };

function DocumentsPanel({ docs, categories, orgId, onSaved }) {
  const [form, setForm] = useState(null);
  const [error, setError] = useState(null);
  const [uploading, setUploading] = useState(false);

  function editDoc(d) {
    setError(null);
    setForm({
      id: d.id,
      category_id: d.category_id || "",
      title: d.title,
      file_url: d.file_url,
      description: d.description || "",
      color: d.color || "slate",
      icon: d.icon || "📄",
    });
  }

  async function handleFileChosen(e) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!ATTACHMENT_TYPES.includes(file.type)) { setError("Please choose a JPG, PNG or PDF file."); return; }
    setUploading(true);
    setError(null);
    try {
      const url = await uploadFile(file);
      setForm((f) => ({ ...f, file_url: url }));
    } catch (err) {
      setError(err.message);
    } finally {
      setUploading(false);
    }
  }

  async function handleSave(e) {
    e.preventDefault();
    setError(null);
    if (!form.file_url) { setError("Please upload a file first."); return; }
    const payload = {
      org_id: orgId,
      category_id: form.category_id || null,
      title: form.title,
      file_url: form.file_url,
      description: form.description,
      color: form.color,
      icon: form.icon,
    };
    const { error: err } = form.id
      ? await supabase.from("office_hub_documents").update(payload).eq("id", form.id)
      : await supabase.from("office_hub_documents").insert({ ...payload, sort_order: docs.length });
    if (err) { setError(err.message); return; }
    setForm(null);
    onSaved();
  }

  async function handleDelete(id) {
    const { error: err } = await supabase.from("office_hub_documents").delete().eq("id", id);
    if (err) setError(err.message);
    else onSaved();
  }

  async function move(index, direction) {
    const target = index + direction;
    if (target < 0 || target >= docs.length) return;
    const a = docs[index], b = docs[target];
    await Promise.all([
      supabase.from("office_hub_documents").update({ sort_order: b.sort_order }).eq("id", a.id),
      supabase.from("office_hub_documents").update({ sort_order: a.sort_order }).eq("id", b.id),
    ]);
    onSaved();
  }

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "var(--space-2)" }}>
        <PageHeader title="Documents" level={2} />
        <Button variant="primary" onClick={() => { setError(null); setForm({ ...blankDoc, category_id: categories[0]?.id || "" }); }}>+ Add document</Button>
      </div>
      {docs.map((d, i) => (
        <Card pad="sm" key={d.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "var(--space-3)", marginBottom: "var(--space-2)", flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)", minWidth: 0 }}>
            <TileSwatch color={d.color} icon={d.icon} />
            <div style={{ minWidth: 0 }}>
              <div style={{ fontWeight: 600 }}>{d.title}</div>
              <div style={{ fontSize: "var(--text-xs)", color: colors.inkSoft }}>{categories.find((c) => c.id === d.category_id)?.name || "Uncategorised"}</div>
            </div>
          </div>
          <div style={{ display: "flex", gap: "var(--space-2)" }}>
            <IconButton size="sm" label="Move up" onClick={() => move(i, -1)} disabled={i === 0}><IconArrowUp size={14} /></IconButton>
            <IconButton size="sm" label="Move down" onClick={() => move(i, 1)} disabled={i === docs.length - 1}><IconArrowDown size={14} /></IconButton>
            <Button onClick={() => editDoc(d)}>Edit</Button>
            <Button variant="danger" onClick={() => handleDelete(d.id)}>Delete</Button>
          </div>
        </Card>
      ))}
      {docs.length === 0 && <EmptyState title="No documents yet" />}
      {form && (
        <Modal title={form.id ? "Edit document" : "New document"} onClose={() => setForm(null)}>
          <form onSubmit={handleSave}>
            <Input required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="e.g. Park map (staff)" style={{ marginBottom: "var(--space-3)" }} />
            <Select value={form.category_id} onChange={(e) => setForm({ ...form, category_id: e.target.value })} style={{ marginBottom: "var(--space-3)" }}>
              <option value="">Uncategorised</option>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </Select>
            <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Description (optional)" style={{ marginBottom: "var(--space-3)" }} />
            <input type="file" accept="application/pdf,image/jpeg,image/png" onChange={handleFileChosen} disabled={uploading} />
            {form.file_url && <p style={{ fontSize: "var(--text-xs)", color: colors.inkSoft }}>File attached ✓</p>}
            <TileStyleFields color={form.color} icon={form.icon} onChange={(patch) => setForm({ ...form, ...patch })} />
            {error && <Alert tone="danger" title="Something went wrong">{error}</Alert>}
            <div style={{ display: "flex", gap: "var(--space-2)", marginTop: "var(--space-3)" }}>
              <Button variant="primary" type="submit" disabled={uploading}>{form.id ? "Save changes" : "Add document"}</Button>
              <Button onClick={() => setForm(null)}>Cancel</Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}

export default function OfficeHubTab() {
  const { org } = useAuth();
  const [section, setSection] = useState("links");
  const [linkCategories, setLinkCategories] = useState([]);
  const [links, setLinks] = useState([]);
  const [docCategories, setDocCategories] = useState([]);
  const [docs, setDocs] = useState([]);

  function refresh() {
    Promise.all([
      supabase.from("office_hub_link_categories").select("*").eq("org_id", org.id).order("sort_order"),
      supabase.from("office_hub_links").select("*").eq("org_id", org.id).order("sort_order"),
      supabase.from("office_hub_doc_categories").select("*").eq("org_id", org.id).order("sort_order"),
      supabase.from("office_hub_documents").select("*").eq("org_id", org.id).order("sort_order"),
    ]).then(([lc, l, dc, d]) => {
      setLinkCategories(lc.data || []);
      setLinks(l.data || []);
      setDocCategories(dc.data || []);
      setDocs(d.data || []);
    });
  }

  useEffect(refresh, [org]);

  return (
    <div>
      <div style={{ display: "flex", gap: "var(--space-2)", marginBottom: "var(--space-4)" }}>
        <Button variant={section === "links" ? "primary" : "secondary"} onClick={() => setSection("links")}>Links</Button>
        <Button variant={section === "linkCategories" ? "primary" : "secondary"} onClick={() => setSection("linkCategories")}>Link categories</Button>
        <Button variant={section === "documents" ? "primary" : "secondary"} onClick={() => setSection("documents")}>Documents</Button>
        <Button variant={section === "docCategories" ? "primary" : "secondary"} onClick={() => setSection("docCategories")}>Document categories</Button>
      </div>
      {section === "links" && <LinksPanel links={links} categories={linkCategories} orgId={org.id} onSaved={refresh} />}
      {section === "linkCategories" && <CategoriesPanel table="office_hub_link_categories" categories={linkCategories} items={links} orgId={org.id} itemLabel="link" onSaved={refresh} />}
      {section === "documents" && <DocumentsPanel docs={docs} categories={docCategories} orgId={org.id} onSaved={refresh} />}
      {section === "docCategories" && <CategoriesPanel table="office_hub_doc_categories" categories={docCategories} items={docs} orgId={org.id} itemLabel="document" onSaved={refresh} />}
    </div>
  );
}
