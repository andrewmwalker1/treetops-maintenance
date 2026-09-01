import { useEffect, useState } from "react";
import { useAuth } from "../../lib/AuthContext.jsx";
import { supabase } from "../../lib/supabaseClient.js";
import { colors, fonts, cardStyle, buttonStyle } from "../../lib/theme.js";

const fieldStyle = {
  width: "100%",
  boxSizing: "border-box",
  padding: "8px 12px",
  borderRadius: "8px",
  border: `1px solid ${colors.lineStrong}`,
  fontFamily: fonts.body,
  marginBottom: "10px",
};

const labelStyle = { display: "block", fontSize: "13px", fontWeight: 600, color: colors.inkSoft, marginBottom: "6px" };

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
};

function today() {
  return new Date().toISOString().slice(0, 10);
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
        .select("id, name, make, model, status, equipment_type_id, serial_number, other_id_number, date_added, decommissioned_at, decommission_reason, decommission_notes, equipment_type:equipment_types(name)")
        .eq("org_id", org?.id),
      supabase.from("equipment_types").select("id, name").eq("org_id", org?.id).order("name"),
      supabase.from("equipment_checkouts").select("id, equipment_id, profiles(display_name)").is("checked_in_at", null),
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
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "12px", marginBottom: "14px", flexWrap: "wrap" }}>
        <h2 style={{ fontFamily: fonts.display, fontSize: "16px", color: colors.mossDark, margin: 0 }}>Equipment</h2>
        <div style={{ display: "flex", gap: "10px", alignItems: "center", flexWrap: "wrap" }}>
          <select value={filterTypeId} onChange={(e) => setFilterTypeId(e.target.value)} style={{ ...fieldStyle, width: "auto", marginBottom: 0 }}>
            <option value="">All types</option>
            {equipmentTypes.map((t) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
          <button onClick={() => { setError(null); setForm(blank); }} style={buttonStyle.primary}>+ Add equipment</button>
        </div>
      </div>

      {visibleEquipment.map((eq) => (
        <div key={eq.id} style={{ ...cardStyle, padding: "12px 16px", marginBottom: "8px", display: "flex", justifyContent: "space-between", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
          <div>
            <div style={{ fontWeight: 600 }}>{eq.name}{eq.equipment_type && <span style={{ fontWeight: 400, color: colors.inkSoft }}> · {eq.equipment_type.name}</span>}</div>
            <div style={{ fontSize: "12px", color: colors.inkSoft }}>
              {[eq.make, eq.model].filter(Boolean).join(" ") || "No make/model set"} · {statusLabels[eq.status]}
            </div>
            {openCheckouts[eq.id] && (
              <div style={{ fontSize: "12px", color: colors.clay, marginTop: "4px" }}>
                Checked out to {openCheckouts[eq.id].profiles?.display_name || "someone"}
              </div>
            )}
            {eq.status === "decommissioned" && (
              <div style={{ fontSize: "12px", color: colors.inkSoft, marginTop: "4px" }}>
                Decommissioned ({DECOMMISSION_REASONS.find((r) => r.value === eq.decommission_reason)?.label || eq.decommission_reason}){eq.decommissioned_at && ` · ${eq.decommissioned_at}`}
                {eq.decommission_notes && ` · ${eq.decommission_notes}`}
              </div>
            )}
          </div>
          <div style={{ display: "flex", gap: "8px" }}>
            {openCheckouts[eq.id] && (
              <button onClick={() => handleForceCheckIn(openCheckouts[eq.id].id)} style={buttonStyle.secondary}>Force check-in</button>
            )}
            <button onClick={() => editItem(eq)} style={buttonStyle.secondary}>Edit</button>
            {eq.status !== "decommissioned" && (
              <button
                onClick={() => openDecommission(eq)}
                disabled={!!openCheckouts[eq.id]}
                title={openCheckouts[eq.id] ? "Force this item checked in first" : undefined}
                style={{ ...buttonStyle.secondary, color: colors.immediate }}
              >
                Decommission
              </button>
            )}
          </div>
        </div>
      ))}
      {visibleEquipment.length === 0 && <p style={{ color: colors.inkSoft }}>No equipment {filterTypeId ? "of this type" : "yet"}.</p>}

      {form && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(49, 56, 45, 0.5)",
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "center",
            padding: "24px 16px",
            overflowY: "auto",
            zIndex: 100,
          }}
          onClick={() => setForm(null)}
        >
          <div
            style={{ ...cardStyle, padding: "20px", width: "100%", maxWidth: "440px" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px" }}>
              <h2 style={{ fontFamily: fonts.display, fontSize: "16px", color: colors.mossDark, margin: 0 }}>
                {form.id ? "Edit equipment" : "New equipment"}
              </h2>
              <button type="button" onClick={() => setForm(null)} aria-label="Close" style={{ background: "none", border: "none", fontSize: "20px", color: colors.inkSoft, cursor: "pointer", lineHeight: 1 }}>×</button>
            </div>
            <form onSubmit={handleSave}>
              <label style={labelStyle}>Kit ID</label>
              <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. EST1" style={fieldStyle} />

              <label style={labelStyle}>Equipment type</label>
              <select value={form.equipment_type_id} onChange={(e) => setForm({ ...form, equipment_type_id: e.target.value })} style={fieldStyle}>
                <option value="">No type set</option>
                {equipmentTypes.map((t) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>

              <label style={labelStyle}>Make</label>
              <input value={form.make} onChange={(e) => setForm({ ...form, make: e.target.value })} placeholder="e.g. Stihl" style={fieldStyle} />

              <label style={labelStyle}>Model</label>
              <input value={form.model} onChange={(e) => setForm({ ...form, model: e.target.value })} placeholder="e.g. FS 131" style={fieldStyle} />

              <label style={labelStyle}>Serial number (optional)</label>
              <input value={form.serial_number} onChange={(e) => setForm({ ...form, serial_number: e.target.value })} style={fieldStyle} />

              <label style={labelStyle}>Other ID number (optional)</label>
              <input value={form.other_id_number} onChange={(e) => setForm({ ...form, other_id_number: e.target.value })} style={fieldStyle} />

              <label style={labelStyle}>Date added (optional)</label>
              <input type="date" value={form.date_added} onChange={(e) => setForm({ ...form, date_added: e.target.value })} style={fieldStyle} />

              {error && <p style={{ color: colors.immediate, fontSize: "13px" }}>{error}</p>}

              <div style={{ display: "flex", gap: "8px" }}>
                <button type="submit" style={buttonStyle.primary}>{form.id ? "Save changes" : "Add equipment"}</button>
                <button type="button" onClick={() => setForm(null)} style={buttonStyle.secondary}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {decommissionForm && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(49, 56, 45, 0.5)",
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "center",
            padding: "24px 16px",
            overflowY: "auto",
            zIndex: 100,
          }}
          onClick={() => setDecommissionForm(null)}
        >
          <div
            style={{ ...cardStyle, padding: "20px", width: "100%", maxWidth: "440px" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px" }}>
              <h2 style={{ fontFamily: fonts.display, fontSize: "16px", color: colors.mossDark, margin: 0 }}>Decommission equipment</h2>
              <button type="button" onClick={() => setDecommissionForm(null)} aria-label="Close" style={{ background: "none", border: "none", fontSize: "20px", color: colors.inkSoft, cursor: "pointer", lineHeight: 1 }}>×</button>
            </div>
            <p style={{ fontSize: "13px", color: colors.inkSoft, marginTop: 0 }}>
              This takes the machine out of service for good — it'll stop being offered to team members checking out equipment.
            </p>
            <form onSubmit={handleDecommission}>
              <label style={labelStyle}>What happened</label>
              <select
                value={decommissionForm.reason}
                onChange={(e) => setDecommissionForm({ ...decommissionForm, reason: e.target.value })}
                style={fieldStyle}
              >
                {DECOMMISSION_REASONS.map((r) => (
                  <option key={r.value} value={r.value}>{r.label}</option>
                ))}
              </select>

              <label style={labelStyle}>Notes (optional)</label>
              <textarea
                value={decommissionForm.notes}
                onChange={(e) => setDecommissionForm({ ...decommissionForm, notes: e.target.value })}
                rows={3}
                style={{ ...fieldStyle, resize: "vertical" }}
              />

              <label style={labelStyle}>Date</label>
              <input
                type="date"
                value={decommissionForm.date}
                onChange={(e) => setDecommissionForm({ ...decommissionForm, date: e.target.value })}
                style={fieldStyle}
              />

              {error && <p style={{ color: colors.immediate, fontSize: "13px" }}>{error}</p>}

              <div style={{ display: "flex", gap: "8px" }}>
                <button type="submit" style={{ ...buttonStyle.primary, background: colors.immediate }}>Decommission</button>
                <button type="button" onClick={() => setDecommissionForm(null)} style={buttonStyle.secondary}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
