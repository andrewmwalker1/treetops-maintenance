import { useEffect, useState } from "react";
import { useAuth } from "../../lib/AuthContext.jsx";
import { supabase } from "../../lib/supabaseClient.js";
import { colors, space } from "../../lib/theme.js";
import { Alert, Button, Card, Input, Modal, PageHeader, Select, Textarea } from "../../ui/index.js";

const statusLabels = { in_service: "In service", monitor: "Monitor", faulty: "Faulty", in_repair: "In repair", scrapped: "Scrapped", decommissioned: "Decommissioned" };

const DECOMMISSION_REASONS = [
  { value: "scrapped", label: "Scrapped" },
  { value: "sold", label: "Sold" },
  { value: "other", label: "Other" },
];

const blank = {
  id: null,
  name: "",
  make: "",
  model: "",
  equipment_type_id: "",
  serial_number: "",
  other_id_number: "",
  date_added: "",
  // "" = inherit the equipment type's default, "true"/"false" = override.
  // Kept as strings here so a plain <select> can represent all three
  // states -- converted to null/true/false in handleSave.
  tracks_hours: "",
  hours_required: "",
};

function today() {
  return new Date().toISOString().slice(0, 10);
}

function resolveTracksHours(eq) {
  return eq.tracks_hours ?? eq.equipment_type?.tracks_hours_default ?? false;
}
function resolveHoursRequired(eq) {
  return eq.hours_required ?? eq.equipment_type?.hours_required_default ?? false;
}

export default function EquipmentTab() {
  const { org, activeSite } = useAuth();
  const [equipment, setEquipment] = useState([]);
  const [equipmentTypes, setEquipmentTypes] = useState([]);
  const [filterTypeId, setFilterTypeId] = useState("");
  const [form, setForm] = useState(null); // null = modal closed
  const [decommissionForm, setDecommissionForm] = useState(null); // null = modal closed
  const [error, setError] = useState(null);
  const [openCheckouts, setOpenCheckouts] = useState({}); // equipment_id -> checkout row

  function refresh() {
    Promise.all([
      supabase
        .from("equipment")
        .select(
          `id, name, make, model, status, equipment_type_id, serial_number, other_id_number, date_added, decommissioned_at, decommission_reason, decommission_notes,
           tracks_hours, hours_required, last_hours_reading, last_hours_reading_at,
           equipment_type:equipment_types(name, tracks_hours_default, hours_required_default)`
        )
        .eq("org_id", org?.id),
      supabase.from("equipment_types").select("id, name, tracks_hours_default, hours_required_default").eq("org_id", org?.id).order("name"),
      // profiles!equipment_checkouts_profile_id_fkey, not the bare
      // "profiles(...)" this had before -- equipment_checkouts has two FKs
      // to profiles (profile_id and checked_in_by), so the embed was
      // ambiguous and PostgREST rejected the whole query (PGRST201),
      // silently emptying openCheckouts below -- every "Checked out to"
      // line and Force check-in button on this screen has been dead.
      supabase
        .from("equipment_checkouts")
        .select("id, equipment_id, profiles!equipment_checkouts_profile_id_fkey(display_name)")
        .is("checked_in_at", null),
    ]).then(([{ data: eq, error: err }, { data: types }, { data: checkouts }]) => {
      if (err) setError(err.message);
      else setEquipment(eq || []);
      setEquipmentTypes(types || []);
      const grouped = {};
      for (const c of checkouts || []) grouped[c.equipment_id] = c;
      setOpenCheckouts(grouped);
    });
  }

  useEffect(refresh, [org]);

  async function handleForceCheckIn(checkoutId) {
    if (!window.confirm("Force check this item in? Use this if a team member forgot to check it in themselves.")) return;
    const { error: err } = await supabase.rpc("admin_force_check_in", { p_checkout_id: checkoutId });
    if (err) setError(err.message);
    else refresh();
  }

  function editItem(eq) {
    setError(null);
    setForm({
      id: eq.id,
      name: eq.name,
      make: eq.make || "",
      model: eq.model || "",
      equipment_type_id: eq.equipment_type_id || "",
      serial_number: eq.serial_number || "",
      other_id_number: eq.other_id_number || "",
      date_added: eq.date_added || "",
      tracks_hours: eq.tracks_hours === null || eq.tracks_hours === undefined ? "" : String(eq.tracks_hours),
      hours_required: eq.hours_required === null || eq.hours_required === undefined ? "" : String(eq.hours_required),
    });
  }

  async function handleSave(e) {
    e.preventDefault();
    setError(null);
    const payload = {
      name: form.name,
      make: form.make || null,
      model: form.model || null,
      equipment_type_id: form.equipment_type_id || null,
      serial_number: form.serial_number || null,
      other_id_number: form.other_id_number || null,
      date_added: form.date_added || null,
      tracks_hours: form.tracks_hours === "" ? null : form.tracks_hours === "true",
      hours_required: form.hours_required === "" ? null : form.hours_required === "true",
    };
    let err;
    if (form.id) {
      ({ error: err } = await supabase.from("equipment").update(payload).eq("id", form.id));
    } else {
      ({ error: err } = await supabase.from("equipment").insert({
        ...payload,
        org_id: org.id,
        site_id: activeSite.id,
        status: "in_service",
      }));
    }
    if (err) {
      setError(err.message);
      return;
    }
    setForm(null);
    refresh();
  }

  function openDecommission(eq) {
    setError(null);
    setDecommissionForm({ id: eq.id, reason: "scrapped", notes: "", date: today() });
  }

  async function handleDecommission(e) {
    e.preventDefault();
    setError(null);
    const { error: err } = await supabase
      .from("equipment")
      .update({
        status: "decommissioned",
        decommissioned_at: decommissionForm.date,
        decommission_reason: decommissionForm.reason,
        decommission_notes: decommissionForm.notes || null,
      })
      .eq("id", decommissionForm.id);
    if (err) {
      setError(err.message);
      return;
    }
    setDecommissionForm(null);
    refresh();
  }

  const visibleEquipment = filterTypeId ? equipment.filter((eq) => eq.equipment_type_id === filterTypeId) : equipment;

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "var(--space-3)", marginBottom: "var(--space-4)", flexWrap: "wrap" }}>
        <PageHeader title="Equipment" level={2} />
        <div style={{ display: "flex", gap: "var(--space-3)", alignItems: "center", flexWrap: "wrap" }}>
          <Select value={filterTypeId} onChange={(e) => setFilterTypeId(e.target.value)}>
            <option value="">All types</option>
            {equipmentTypes.map((t) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </Select>
          <Button variant="primary" onClick={() => { setError(null); setForm(blank); }}>+ Add equipment</Button>
        </div>
      </div>

      {visibleEquipment.map((eq) => (
        <Card pad="sm" key={eq.id} style={{ marginBottom: "var(--space-2)", display: "flex", justifyContent: "space-between", alignItems: "center", gap: "var(--space-3)", flexWrap: "wrap" }}>
          <div>
            <div style={{ fontWeight: 600 }}>{eq.name}{eq.equipment_type && <span style={{ fontWeight: 400, color: colors.inkSoft }}> · {eq.equipment_type.name}</span>}</div>
            <div style={{ fontSize: "var(--text-xs)", color: colors.inkSoft }}>
              {[eq.make, eq.model].filter(Boolean).join(" ") || "No make/model set"} · {statusLabels[eq.status]}
              {resolveTracksHours(eq) && (
                <>
                  {" · "}
                  {eq.last_hours_reading != null ? `${eq.last_hours_reading} hrs` : "tracks hours"}
                  {resolveHoursRequired(eq) ? " (required)" : ""}
                </>
              )}
            </div>
            {openCheckouts[eq.id] && (
              <div style={{ fontSize: "var(--text-xs)", color: colors.clay, marginTop: "var(--space-1)" }}>
                Checked out to {openCheckouts[eq.id].profiles?.display_name || "someone"}
              </div>
            )}
            {eq.status === "decommissioned" && (
              <div style={{ fontSize: "var(--text-xs)", color: colors.inkSoft, marginTop: "var(--space-1)" }}>
                Decommissioned ({DECOMMISSION_REASONS.find((r) => r.value === eq.decommission_reason)?.label || eq.decommission_reason}){eq.decommissioned_at && ` · ${eq.decommissioned_at}`}
                {eq.decommission_notes && ` · ${eq.decommission_notes}`}
              </div>
            )}
          </div>
          <div style={{ display: "flex", gap: "var(--space-2)" }}>
            {openCheckouts[eq.id] && (
              <Button onClick={() => handleForceCheckIn(openCheckouts[eq.id].id)}>Force check-in</Button>
            )}
            <Button onClick={() => editItem(eq)}>Edit</Button>
            {eq.status !== "decommissioned" && (
              <Button variant="danger" onClick={() => openDecommission(eq)} disabled={!!openCheckouts[eq.id]} title={openCheckouts[eq.id] ? "Force this item checked in first" : undefined}>
                Decommission
              </Button>
            )}
          </div>
        </Card>
      ))}
      {visibleEquipment.length === 0 && <p style={{ color: colors.inkSoft }}>No equipment {filterTypeId ? "of this type" : "yet"}.</p>}

      {form && (
        <Modal title={form.id ? "Edit equipment" : "New equipment"} onClose={() => setForm(null)}>
            <form onSubmit={handleSave}>
              <label className="tt-field__label">Kit ID</label>
              <Input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. EST1" style={{ marginBottom: "var(--space-3)" }} />

              <label className="tt-field__label">Equipment type</label>
              <Select value={form.equipment_type_id} onChange={(e) => setForm({ ...form, equipment_type_id: e.target.value })} style={{ marginBottom: "var(--space-3)" }}>
                <option value="">No type set</option>
                {equipmentTypes.map((t) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </Select>

              <label className="tt-field__label">Hours tracking</label>
              <Select value={form.tracks_hours} onChange={(e) => setForm({ ...form, tracks_hours: e.target.value })} style={{ marginBottom: "var(--space-3)" }}>
                <option value="">
                  Inherit from type ({(equipmentTypes.find((t) => t.id === form.equipment_type_id)?.tracks_hours_default) ? "on" : "off"})
                </option>
                <option value="true">On for this machine</option>
                <option value="false">Off for this machine</option>
              </Select>

              <label className="tt-field__label">Require an hours reading at checkout</label>
              <Select value={form.hours_required} onChange={(e) => setForm({ ...form, hours_required: e.target.value })} style={{ marginBottom: "var(--space-3)" }}>
                <option value="">
                  Inherit from type ({(equipmentTypes.find((t) => t.id === form.equipment_type_id)?.hours_required_default) ? "required" : "optional"})
                </option>
                <option value="true">Required for this machine</option>
                <option value="false">Optional for this machine</option>
              </Select>
              <p style={{ fontSize: "var(--text-xs)", color: colors.inkSoft, marginTop: "calc(-1 * var(--space-1))", marginBottom: "var(--space-3)" }}>
                Only matters if hours tracking above ends up on for this machine.
              </p>

              <label className="tt-field__label">Make</label>
              <Input value={form.make} onChange={(e) => setForm({ ...form, make: e.target.value })} placeholder="e.g. Stihl" style={{ marginBottom: "var(--space-3)" }} />

              <label className="tt-field__label">Model</label>
              <Input value={form.model} onChange={(e) => setForm({ ...form, model: e.target.value })} placeholder="e.g. FS 131" style={{ marginBottom: "var(--space-3)" }} />

              <label className="tt-field__label">Serial number (optional)</label>
              <Input value={form.serial_number} onChange={(e) => setForm({ ...form, serial_number: e.target.value })} style={{ marginBottom: "var(--space-3)" }} />

              <label className="tt-field__label">Other ID number (optional)</label>
              <Input value={form.other_id_number} onChange={(e) => setForm({ ...form, other_id_number: e.target.value })} style={{ marginBottom: "var(--space-3)" }} />

              <label className="tt-field__label">Date added (optional)</label>
              <Input type="date" value={form.date_added} onChange={(e) => setForm({ ...form, date_added: e.target.value })} style={{ marginBottom: "var(--space-3)" }} />

              {error && (
                <Alert tone="danger" title="Something went wrong">
                  {error}
                </Alert>
              )}

              <div style={{ display: "flex", gap: "var(--space-2)" }}>
                <Button variant="primary" type="submit">{form.id ? "Save changes" : "Add equipment"}</Button>
                <Button onClick={() => setForm(null)}>Cancel</Button>
              </div>
            </form>
                  </Modal>
      )}

      {decommissionForm && (
        <Modal title="Decommission equipment" onClose={() => setDecommissionForm(null)}>
            <p style={{ fontSize: "var(--text-sm)", color: colors.inkSoft, marginTop: 0 }}>
              This takes the machine out of service for good — it'll stop being offered to team members checking out equipment.
            </p>
            <form onSubmit={handleDecommission}>
              <label className="tt-field__label">What happened</label>
              <Select value={decommissionForm.reason} onChange={(e) => setDecommissionForm({ ...decommissionForm, reason: e.target.value })} style={{ marginBottom: "var(--space-3)" }}>
                {DECOMMISSION_REASONS.map((r) => (
                  <option key={r.value} value={r.value}>{r.label}</option>
                ))}
              </Select>

              <label className="tt-field__label">Notes (optional)</label>
              <Textarea value={decommissionForm.notes} onChange={(e) => setDecommissionForm({ ...decommissionForm, notes: e.target.value })} rows={3} style={{ marginBottom: "var(--space-3)" }} />

              <label className="tt-field__label">Date</label>
              <Input type="date" value={decommissionForm.date} onChange={(e) => setDecommissionForm({ ...decommissionForm, date: e.target.value })} style={{ marginBottom: "var(--space-3)" }} />

              {error && (
                <Alert tone="danger" title="Something went wrong">
                  {error}
                </Alert>
              )}

              <div style={{ display: "flex", gap: "var(--space-2)" }}>
                <Button variant="primary" type="submit">Decommission</Button>
                <Button onClick={() => setDecommissionForm(null)}>Cancel</Button>
              </div>
            </form>
                  </Modal>
      )}
    </div>
  );
}
