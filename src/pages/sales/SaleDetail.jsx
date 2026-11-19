import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../../lib/AuthContext.jsx";
import { getSale, updateSale, isSaleOverdueWithoutCover } from "../../lib/caravanSalesQuery.js";
import { createJob, getDefaultOpenStatusId } from "../../lib/createJob.js";
import { loadNewJobReferenceData } from "../../lib/newJobReferenceData.js";
import { openPrintWindow } from "../../lib/printJobCards.jsx";
import { writeAndPrintSaleCustomerCopy, writeAndPrintSaleOfficeCopy } from "../../lib/printCaravanSale.jsx";
import { buildLicenseAgreementRow } from "../../lib/caravanSaleToLicenseRow.js";
import CaravanSalePriceBreakdown, { grandTotal } from "../../components/CaravanSalePriceBreakdown.jsx";
import SearchPicker from "../../components/SearchPicker.jsx";
import AssigneePicker from "../../components/AssigneePicker.jsx";
import { colors } from "../../lib/theme.js";
import { Alert, Button, Card, EmptyState, Field, Input, PageHeader, Pill, Select, SkeletonList, Switch, Textarea } from "../../ui/index.js";

// Gas/electric test used to be real linked Jobs needing a Contractor
// assignee -- simplified to plain booked/completed date fields on the
// sale itself (below, in JobsCard), since office just needs the dates
// on file, not a job to assign. Prep caravan stays a real linked Job.
const JOB_SLOTS = [{ role: "prep", title: "Prep caravan — clean & repairs", needsContractor: false }];

function customerName(sale) {
  return [sale.title, sale.forename, sale.surname].filter(Boolean).join(" ");
}

// ---------------- Customer & caravan ----------------
function CustomerCaravanCard({ sale, pitches, terminology, onSaved }) {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  function startEdit() {
    setForm({
      title: sale.title || "", forename: sale.forename || "", surname: sale.surname || "",
      address_line1: sale.address_line1 || "", address_line2: sale.address_line2 || "", postcode: sale.postcode || "",
      phone1: sale.phone1 || "", phone2: sale.phone2 || "", email1: sale.email1 || "", email2: sale.email2 || "",
      car_registration: sale.car_registration || "",
      caravan_make: sale.caravan_make || "", caravan_model: sale.caravan_model || "", caravan_year: sale.caravan_year || "",
      caravan_condition: sale.caravan_condition || "pre-owned", pitch_id: sale.pitch_id || "",
      licence_term: sale.licence_term || "", handover_date: sale.handover_date || "",
    });
    setError(null);
    setEditing(true);
  }

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const updated = await updateSale(sale.id, form);
      onSaved(updated);
      setEditing(false);
    } catch (err) {
      setError(err.message || "Failed to save.");
    } finally {
      setSaving(false);
    }
  }

  if (!editing) {
    return (
      <Card pad="md">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <h2 style={{ margin: "0 0 var(--space-3)" }}>Customer &amp; caravan</h2>
          <Button size="sm" onClick={startEdit}>Edit</Button>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: "var(--space-3)", fontSize: "var(--text-sm)" }}>
          <div><b>Customer</b><br />{customerName(sale)}</div>
          <div><b>Address</b><br />{[sale.address_line1, sale.address_line2, sale.postcode].filter(Boolean).join(", ") || "—"}</div>
          <div><b>Phone / email</b><br />{[[sale.phone1, sale.phone2].filter(Boolean).join(" / "), [sale.email1, sale.email2].filter(Boolean).join(" / ")].filter(Boolean).join(" · ") || "—"}</div>
          <div><b>Car reg.</b><br />{sale.car_registration || "—"}</div>
          <div><b>Caravan</b><br />{[sale.caravan_make, sale.caravan_model, sale.caravan_year ? `(${sale.caravan_year}, ${sale.caravan_condition})` : null].filter(Boolean).join(" ") || "—"}</div>
          <div><b>{terminology.pitch || "Pitch"}</b><br />{sale.pitch?.pitch_number_or_name || "—"}</div>
          <div><b>Handover date</b><br />{sale.handover_date || "—"}</div>
        </div>
      </Card>
    );
  }

  return (
    <Card pad="md">
      <h2 style={{ marginTop: 0 }}>Customer &amp; caravan</h2>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: "var(--space-3)" }}>
        <Field label="Title">{({ id }) => <Input id={id} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />}</Field>
        <Field label="Forename" required>{({ id }) => <Input id={id} value={form.forename} onChange={(e) => setForm({ ...form, forename: e.target.value })} />}</Field>
        <Field label="Surname" required>{({ id }) => <Input id={id} value={form.surname} onChange={(e) => setForm({ ...form, surname: e.target.value })} />}</Field>
        <Field label="Address line 1">{({ id }) => <Input id={id} value={form.address_line1} onChange={(e) => setForm({ ...form, address_line1: e.target.value })} />}</Field>
        <Field label="Address line 2">{({ id }) => <Input id={id} value={form.address_line2} onChange={(e) => setForm({ ...form, address_line2: e.target.value })} />}</Field>
        <Field label="Post code">{({ id }) => <Input id={id} value={form.postcode} onChange={(e) => setForm({ ...form, postcode: e.target.value })} />}</Field>
        <Field label="Phone 1">{({ id }) => <Input id={id} value={form.phone1} onChange={(e) => setForm({ ...form, phone1: e.target.value })} />}</Field>
        <Field label="Phone 2">{({ id }) => <Input id={id} value={form.phone2} onChange={(e) => setForm({ ...form, phone2: e.target.value })} />}</Field>
        <Field label="Email 1">{({ id }) => <Input id={id} value={form.email1} onChange={(e) => setForm({ ...form, email1: e.target.value })} />}</Field>
        <Field label="Email 2">{({ id }) => <Input id={id} value={form.email2} onChange={(e) => setForm({ ...form, email2: e.target.value })} />}</Field>
        <Field label="Car reg.">{({ id }) => <Input id={id} value={form.car_registration} onChange={(e) => setForm({ ...form, car_registration: e.target.value })} />}</Field>
        <Field label="Make">{({ id }) => <Input id={id} value={form.caravan_make} onChange={(e) => setForm({ ...form, caravan_make: e.target.value })} />}</Field>
        <Field label="Model">{({ id }) => <Input id={id} value={form.caravan_model} onChange={(e) => setForm({ ...form, caravan_model: e.target.value })} />}</Field>
        <Field label="Year">{({ id }) => <Input id={id} value={form.caravan_year} onChange={(e) => setForm({ ...form, caravan_year: e.target.value })} />}</Field>
        <Field label="Condition">
          {({ id }) => (
            <Select id={id} value={form.caravan_condition} onChange={(e) => setForm({ ...form, caravan_condition: e.target.value })}>
              <option value="new">New</option>
              <option value="pre-owned">Pre-owned</option>
            </Select>
          )}
        </Field>
        <Field label={terminology.pitch || "Pitch"}>
          <SearchPicker items={pitches} getLabel={(p) => p.pitch_number_or_name} value={form.pitch_id} onChange={(v) => setForm({ ...form, pitch_id: v })} ariaLabel={terminology.pitch || "Pitch"} />
        </Field>
        <Field label="Licence term">{({ id }) => <Input id={id} value={form.licence_term} onChange={(e) => setForm({ ...form, licence_term: e.target.value })} />}</Field>
        <Field label="Handover date">{({ id }) => <Input id={id} type="date" value={form.handover_date} onChange={(e) => setForm({ ...form, handover_date: e.target.value })} />}</Field>
      </div>
      {error && <Alert tone="danger" title="Could not save">{error}</Alert>}
      <div style={{ display: "flex", gap: "var(--space-2)", marginTop: "var(--space-4)" }}>
        <Button variant="primary" loading={saving} onClick={save}>Save</Button>
        <Button onClick={() => setEditing(false)}>Cancel</Button>
      </div>
    </Card>
  );
}

// ---------------- Jobs ----------------
function JobSlot({ slot, sale, jobTypes, contractors, onCreated }) {
  const existing = (sale.jobs || []).find((j) => j.sale_role === slot.role);
  const [jobTypeId, setJobTypeId] = useState("");
  const [assigneeKind, setAssigneeKind] = useState(slot.needsContractor ? "contractor" : "none");
  const [assigneeId, setAssigneeId] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState(null);

  async function handleCreate() {
    setCreating(true);
    setError(null);
    try {
      const statusId = await getDefaultOpenStatusId(sale.org_id);
      const jobType = jobTypes.find((jt) => jt.id === jobTypeId);
      await createJob({
        orgId: sale.org_id,
        siteId: sale.site_id,
        jobTypeId: jobTypeId || null,
        statusId,
        description: slot.title,
        assigneeProfileId: assigneeKind === "person" ? assigneeId || null : null,
        assigneeGroupId: assigneeKind === "group" ? assigneeId || null : null,
        assigneeContractorId: assigneeKind === "contractor" ? assigneeId || null : null,
        pitchId: sale.pitch_id,
        saleId: sale.id,
        saleRole: slot.role,
        createdBy: sale.created_by,
        templateSchema: jobType?.template_schema || [],
      });
      onCreated();
    } catch (err) {
      setError(err.message || "Failed to create the job.");
    } finally {
      setCreating(false);
    }
  }

  if (existing) {
    return (
      <div style={{ padding: "var(--space-2) 0", borderTop: `1px solid ${colors.line}` }}>
        <div style={{ fontWeight: 600 }}>{slot.title}</div>
        <div style={{ fontSize: "var(--text-xs)", color: colors.inkSoft }}>
          {existing.job_type?.name ? `${existing.job_type.name} · ` : ""}
          {existing.job_status?.name || "Open"}
          {existing.assignee_contractor?.name ? ` · ${existing.assignee_contractor.name}` : ""}
          {existing.due_date ? ` · due ${existing.due_date}` : ""}
        </div>
        <a href={`/jobs/${existing.id}`} style={{ fontSize: "var(--text-xs)" }}>Open job →</a>
      </div>
    );
  }

  return (
    <div style={{ padding: "var(--space-3) 0", borderTop: `1px solid ${colors.line}` }}>
      <div style={{ fontWeight: 600, marginBottom: "var(--space-2)" }}>{slot.title}</div>
      <div style={{ display: "flex", gap: "var(--space-2)", flexWrap: "wrap", marginBottom: "var(--space-2)" }}>
        <Select value={jobTypeId} onChange={(e) => setJobTypeId(e.target.value)} aria-label="Job template" style={{ minWidth: 180 }}>
          <option value="">No template</option>
          {jobTypes.map((jt) => (
            <option key={jt.id} value={jt.id}>{jt.name}</option>
          ))}
        </Select>
      </div>
      <AssigneePicker
        kind={assigneeKind}
        id={assigneeId}
        onChange={(k, i) => { setAssigneeKind(k); setAssigneeId(i); }}
        people={[]}
        groups={[]}
        contractors={contractors}
      />
      {slot.needsContractor && contractors.length === 0 && (
        <p style={{ fontSize: "var(--text-xs)", color: colors.warnInk, margin: "var(--space-1) 0" }}>
          No contractors set up yet — add one in Admin → Contractors before assigning this.
        </p>
      )}
      {error && <Alert tone="danger" title="Could not create job">{error}</Alert>}
      <Button size="sm" variant="primary" loading={creating} onClick={handleCreate} style={{ marginTop: "var(--space-2)" }}>
        Create job
      </Button>
    </div>
  );
}

function JobsCard({ sale, jobTypes, contractors, onRefresh }) {
  const [gasReading, setGasReading] = useState(sale.meter_reading_gas || "");
  const [electricReading, setElectricReading] = useState(sale.meter_reading_electric || "");
  const [readingDate, setReadingDate] = useState(sale.meter_reading_date || "");
  const [saving, setSaving] = useState(false);

  // Gas/electric test dates -- plain fields, not linked Jobs (simplified
  // from the earlier Contractor-assignee version).
  const [electricBooked, setElectricBooked] = useState(sale.electric_test_booked_date || "");
  const [electricCompleted, setElectricCompleted] = useState(sale.electric_test_completed_date || "");
  const [gasBooked, setGasBooked] = useState(sale.gas_test_booked_date || "");
  const [gasCompleted, setGasCompleted] = useState(sale.gas_test_completed_date || "");
  const [savingTests, setSavingTests] = useState(false);

  async function saveReadings() {
    setSaving(true);
    try {
      const updated = await updateSale(sale.id, {
        meter_reading_gas: gasReading || null,
        meter_reading_electric: electricReading || null,
        meter_reading_date: readingDate || null,
      });
      onRefresh(updated);
    } finally {
      setSaving(false);
    }
  }

  async function saveTestDates() {
    setSavingTests(true);
    try {
      const updated = await updateSale(sale.id, {
        electric_test_booked_date: electricBooked || null,
        electric_test_completed_date: electricCompleted || null,
        gas_test_booked_date: gasBooked || null,
        gas_test_completed_date: gasCompleted || null,
      });
      onRefresh(updated);
    } finally {
      setSavingTests(false);
    }
  }

  return (
    <Card pad="md">
      <h2 style={{ marginTop: 0 }}>Jobs</h2>
      {JOB_SLOTS.map((slot) => (
        <JobSlot key={slot.role} slot={slot} sale={sale} jobTypes={jobTypes} contractors={contractors} onCreated={onRefresh} />
      ))}
      <div style={{ padding: "var(--space-3) 0", borderTop: `1px solid ${colors.line}` }}>
        <div style={{ fontWeight: 600, marginBottom: "var(--space-2)" }}>Electric test</div>
        <div style={{ display: "flex", gap: "var(--space-2)", flexWrap: "wrap", alignItems: "flex-end", marginBottom: "var(--space-3)" }}>
          <Field label="Booked">{({ id }) => <Input id={id} type="date" value={electricBooked} onChange={(e) => setElectricBooked(e.target.value)} />}</Field>
          <Field label="Completed">{({ id }) => <Input id={id} type="date" value={electricCompleted} onChange={(e) => setElectricCompleted(e.target.value)} />}</Field>
        </div>
        <div style={{ fontWeight: 600, marginBottom: "var(--space-2)" }}>Gas test</div>
        <div style={{ display: "flex", gap: "var(--space-2)", flexWrap: "wrap", alignItems: "flex-end" }}>
          <Field label="Booked">{({ id }) => <Input id={id} type="date" value={gasBooked} onChange={(e) => setGasBooked(e.target.value)} />}</Field>
          <Field label="Completed">{({ id }) => <Input id={id} type="date" value={gasCompleted} onChange={(e) => setGasCompleted(e.target.value)} />}</Field>
          <Button size="sm" loading={savingTests} onClick={saveTestDates}>Save</Button>
        </div>
      </div>
      <div style={{ padding: "var(--space-3) 0", borderTop: `1px solid ${colors.line}` }}>
        <div style={{ fontWeight: 600, marginBottom: "var(--space-2)" }}>Meter readings</div>
        <div style={{ display: "flex", gap: "var(--space-2)", flexWrap: "wrap", alignItems: "flex-end" }}>
          <Field label="Gas">{({ id }) => <Input id={id} value={gasReading} onChange={(e) => setGasReading(e.target.value)} style={{ width: 120 }} />}</Field>
          <Field label="Electric">{({ id }) => <Input id={id} value={electricReading} onChange={(e) => setElectricReading(e.target.value)} style={{ width: 120 }} />}</Field>
          <Field label="Date">{({ id }) => <Input id={id} type="date" value={readingDate} onChange={(e) => setReadingDate(e.target.value)} />}</Field>
          <Button size="sm" loading={saving} onClick={saveReadings}>Save</Button>
        </div>
      </div>
    </Card>
  );
}

// ---------------- Systems & docs / Insurance (immediate-save ticks) ----------------
function CheckRow({ label, checked, onChange, hint }) {
  return (
    <div style={{ padding: "var(--space-2) 0", borderTop: `1px solid ${colors.line}` }}>
      <Switch checked={checked} onChange={onChange} label={label} />
      {hint && <p style={{ margin: "var(--space-1) 0 0 calc(var(--space-6) + var(--space-1))", fontSize: "var(--text-xs)", color: colors.inkSoft }}>{hint}</p>}
    </div>
  );
}

function SystemsDocsCard({ sale, onSaved }) {
  const navigate = useNavigate();

  async function toggle(field, extra = {}) {
    const updated = await updateSale(sale.id, { [field]: !sale[field], ...extra });
    onSaved(updated);
  }

  // Hands the sale's data to the License Agreement tool via the same
  // row shape its own CampManager-CSV import already expects (see
  // caravanSaleToLicenseRow.js) -- a sessionStorage handoff, read once
  // and cleared by LicenseAgreement.jsx.
  function openInLicenseAgreement() {
    sessionStorage.setItem("licenseAgreementPrefillRow", JSON.stringify(buildLicenseAgreementRow(sale)));
    navigate("/office-hub?tab=license-agreement");
  }

  return (
    <Card pad="md">
      <h2 style={{ marginTop: 0 }}>Systems &amp; docs</h2>
      <CheckRow
        label="CampManager"
        checked={sale.campmanager_done}
        onChange={() => toggle("campmanager_done", !sale.campmanager_done && !sale.campmanager_date ? { campmanager_date: new Date().toISOString().slice(0, 10) } : {})}
        hint={sale.campmanager_date ? `Customer created & sent · ${sale.campmanager_date}` : "Customer created & sent"}
      />
      <CheckRow label="Compass" checked={sale.compass_done} onChange={() => toggle("compass_done")} />
      <CheckRow
        label="Purchase & licence agreement — created"
        checked={sale.agreement_created}
        onChange={() => toggle("agreement_created")}
        hint="One combined document — generate it in the License Agreement tool."
      />
      <div style={{ padding: "0 0 var(--space-2) calc(var(--space-6) + var(--space-1))" }}>
        <Button size="sm" onClick={openInLicenseAgreement}>Open in License Agreement tool (pre-filled) →</Button>
      </div>
      <CheckRow label="Purchase & licence agreement — signed & filed" checked={sale.agreement_signed_filed} onChange={() => toggle("agreement_signed_filed")} />
    </Card>
  );
}

function InsuranceCard({ sale, onSaved }) {
  const [notes, setNotes] = useState(sale.notes || "");
  const [savingNotes, setSavingNotes] = useState(false);
  const overdue = isSaleOverdueWithoutCover(sale);

  async function toggle(field) {
    const updated = await updateSale(sale.id, { [field]: !sale[field] });
    onSaved(updated);
  }

  async function saveNotes() {
    setSavingNotes(true);
    try {
      const updated = await updateSale(sale.id, { notes: notes.trim() || null });
      onSaved(updated);
    } finally {
      setSavingNotes(false);
    }
  }

  return (
    <Card pad="md">
      <h2 style={{ marginTop: 0 }}>Insurance</h2>
      {overdue && (
        <Alert tone="danger" title="Past handover and not on cover">
          Handover was {sale.handover_date} and "Customer on cover" still isn't ticked.
        </Alert>
      )}
      <CheckRow label="Insurance quote raised" checked={sale.insurance_quote_raised} onChange={() => toggle("insurance_quote_raised")} />
      <CheckRow label="Insurance payment confirmed" checked={sale.insurance_payment_confirmed} onChange={() => toggle("insurance_payment_confirmed")} />
      <CheckRow label="Customer on cover" checked={sale.customer_on_cover} onChange={() => toggle("customer_on_cover")} />
      <Field label="Notes" className="tt-field" style={{ marginTop: "var(--space-3)" }}>
        {({ id }) => <Textarea id={id} value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} />}
      </Field>
      <Button size="sm" loading={savingNotes} onClick={saveNotes}>Save notes</Button>
    </Card>
  );
}

// ---------------- Details of sale ----------------
function DetailsOfSaleCard({ sale, onSaved }) {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  function startEdit() {
    setForm({
      window_price: sale.window_price, rates_current_year: sale.rates_current_year,
      pitch_fee_amount: sale.pitch_fee_amount, pitch_fee_included: sale.pitch_fee_included,
      included_items: (sale.included_items || []).map((i) => ({ ...i })),
      additional_items: (sale.additional_items || []).map((i) => ({ ...i })),
      deposit_amount: sale.deposit_amount, deposit_date: sale.deposit_date || "",
      part_exchange_amount: sale.part_exchange_amount, part_exchange_date: sale.part_exchange_date || "",
    });
    setError(null);
    setEditing(true);
  }

  function updateItem(list, i, patch) {
    setForm({ ...form, [list]: form[list].map((item, idx) => (idx === i ? { ...item, ...patch } : item)) });
  }
  function addItem(list) {
    setForm({ ...form, [list]: [...form[list], { description: "", amount: "" }] });
  }
  function removeItem(list, i) {
    setForm({ ...form, [list]: form[list].filter((_, idx) => idx !== i) });
  }

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const clean = (items) => items.filter((i) => i.description.trim() || i.amount).map((i) => ({ description: i.description.trim(), amount: parseFloat(i.amount) || 0 }));
      const updated = await updateSale(sale.id, {
        ...form,
        window_price: parseFloat(form.window_price) || 0,
        rates_current_year: parseFloat(form.rates_current_year) || 0,
        pitch_fee_amount: parseFloat(form.pitch_fee_amount) || 0,
        included_items: clean(form.included_items),
        additional_items: clean(form.additional_items),
        deposit_amount: parseFloat(form.deposit_amount) || 0,
        deposit_date: form.deposit_date || null,
        part_exchange_amount: parseFloat(form.part_exchange_amount) || 0,
        part_exchange_date: form.part_exchange_date || null,
      });
      onSaved(updated);
      setEditing(false);
    } catch (err) {
      setError(err.message || "Failed to save.");
    } finally {
      setSaving(false);
    }
  }

  if (!editing) {
    return (
      <Card pad="md">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <h2 style={{ margin: "0 0 var(--space-3)" }}>Details of sale</h2>
          <Button size="sm" onClick={startEdit}>Edit</Button>
        </div>
        <CaravanSalePriceBreakdown sale={sale} />
      </Card>
    );
  }

  function ItemRows({ list, placeholder }) {
    return (
      <>
        {form[list].map((item, i) => (
          <div key={i} style={{ display: "flex", gap: "var(--space-2)", marginBottom: "var(--space-2)" }}>
            <Input value={item.description} onChange={(e) => updateItem(list, i, { description: e.target.value })} placeholder={placeholder} style={{ flex: 2 }} />
            <Input type="number" step="0.01" min="0" value={item.amount} onChange={(e) => updateItem(list, i, { amount: e.target.value })} placeholder="0.00" style={{ flex: 1 }} />
            <Button type="button" size="sm" onClick={() => removeItem(list, i)}>Remove</Button>
          </div>
        ))}
        <Button type="button" size="sm" onClick={() => addItem(list)}>+ Add item</Button>
      </>
    );
  }

  return (
    <Card pad="md">
      <h2 style={{ marginTop: 0 }}>Details of sale</h2>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: "var(--space-3)" }}>
        <Field label="Window price">{({ id }) => <Input id={id} type="number" step="0.01" value={form.window_price} onChange={(e) => setForm({ ...form, window_price: e.target.value })} />}</Field>
        <Field label="Rates (current year)">{({ id }) => <Input id={id} type="number" step="0.01" value={form.rates_current_year} onChange={(e) => setForm({ ...form, rates_current_year: e.target.value })} />}</Field>
        <Field label="Pitch fee">{({ id }) => <Input id={id} type="number" step="0.01" value={form.pitch_fee_amount} onChange={(e) => setForm({ ...form, pitch_fee_amount: e.target.value })} />}</Field>
      </div>
      <Switch checked={form.pitch_fee_included} onChange={(v) => setForm({ ...form, pitch_fee_included: v })} label="Pitch fee included in window price" />

      <p style={{ fontSize: "var(--text-xs)", textTransform: "uppercase", letterSpacing: "var(--tracking-label)", color: colors.inkSoft, margin: "var(--space-4) 0 var(--space-2)" }}>
        Items included in the window price
      </p>
      <ItemRows list="included_items" placeholder="e.g. Insurance (first year)" />

      <p style={{ fontSize: "var(--text-xs)", textTransform: "uppercase", letterSpacing: "var(--tracking-label)", color: colors.inkSoft, margin: "var(--space-4) 0 var(--space-2)" }}>
        Charged on top of the window price
      </p>
      <ItemRows list="additional_items" placeholder="e.g. Delivery" />

      <p style={{ fontSize: "var(--text-xs)", textTransform: "uppercase", letterSpacing: "var(--tracking-label)", color: colors.inkSoft, margin: "var(--space-4) 0 var(--space-2)" }}>
        Payment against the total
      </p>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: "var(--space-3)" }}>
        <Field label="Deposit">{({ id }) => <Input id={id} type="number" step="0.01" value={form.deposit_amount} onChange={(e) => setForm({ ...form, deposit_amount: e.target.value })} />}</Field>
        <Field label="Deposit date">{({ id }) => <Input id={id} type="date" value={form.deposit_date} onChange={(e) => setForm({ ...form, deposit_date: e.target.value })} />}</Field>
        <Field label="Part-exchange">{({ id }) => <Input id={id} type="number" step="0.01" value={form.part_exchange_amount} onChange={(e) => setForm({ ...form, part_exchange_amount: e.target.value })} />}</Field>
        <Field label="Part-exchange date">{({ id }) => <Input id={id} type="date" value={form.part_exchange_date} onChange={(e) => setForm({ ...form, part_exchange_date: e.target.value })} />}</Field>
      </div>
      <p style={{ color: colors.inkSoft, fontSize: "var(--text-sm)" }}>Total recalculates from these figures on save: {grandTotal({ ...sale, ...form }).toLocaleString("en-GB", { style: "currency", currency: "GBP" })}</p>
      {error && <Alert tone="danger" title="Could not save">{error}</Alert>}
      <div style={{ display: "flex", gap: "var(--space-2)", marginTop: "var(--space-3)" }}>
        <Button variant="primary" loading={saving} onClick={save}>Save</Button>
        <Button onClick={() => setEditing(false)}>Cancel</Button>
      </div>
    </Card>
  );
}

// ---------------- Page ----------------
export default function SaleDetail() {
  const { id } = useParams();
  const { profile, org, activeSite, terminology } = useAuth();
  const navigate = useNavigate();
  const [sale, setSale] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [jobTypes, setJobTypes] = useState([]);
  const [contractors, setContractors] = useState([]);
  const [pitches, setPitches] = useState([]);

  function refresh() {
    getSale(id)
      .then((data) => {
        if (!data) {
          setError("That sale couldn't be found.");
          return;
        }
        setSale(data);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => {
    if (!org || !activeSite) return;
    loadNewJobReferenceData({ orgId: org.id, siteId: activeSite.id, roleId: profile.role_id }).then(({ data }) => {
      if (!data) return;
      setJobTypes(data.jobTypes);
      setContractors(data.contractors);
      setPitches(data.pitches);
    });
  }, [org, activeSite]);

  async function handleMarkComplete() {
    const updated = await updateSale(sale.id, { is_complete: !sale.is_complete });
    setSale(updated);
  }

  function handlePrintCustomerCopy() {
    const printWindow = openPrintWindow();
    writeAndPrintSaleCustomerCopy(printWindow, sale);
  }
  function handlePrintOfficeCopy() {
    const printWindow = openPrintWindow();
    writeAndPrintSaleOfficeCopy(printWindow, sale);
  }

  if (loading) return <SkeletonList rows={5} height={120} />;
  if (error || !sale) return <EmptyState title="Couldn't load this sale">{error}</EmptyState>;

  const overdue = isSaleOverdueWithoutCover(sale);

  return (
    <div style={{ maxWidth: "var(--width-xl)" }}>
      <a href="/office-hub?tab=sales" style={{ fontSize: "var(--text-sm)", display: "inline-block", marginBottom: "var(--space-3)" }}>← All sales</a>
      <PageHeader
        title={customerName(sale)}
        subtitle={`${[sale.caravan_make, sale.caravan_model].filter(Boolean).join(" ")} · ${terminology.pitch || "Pitch"} ${sale.pitch?.pitch_number_or_name || "—"}`}
        actions={sale.is_complete ? <Pill tone="ok">Complete</Pill> : overdue ? <Pill tone="danger">Needs attention</Pill> : null}
      />

      <div style={{ display: "grid", gap: "var(--space-4)" }}>
        <CustomerCaravanCard sale={sale} pitches={pitches} terminology={terminology} onSaved={setSale} />
        <JobsCard sale={sale} jobTypes={jobTypes} contractors={contractors} onRefresh={refresh} />
        <SystemsDocsCard sale={sale} onSaved={setSale} />
        <InsuranceCard sale={sale} onSaved={setSale} />
        <DetailsOfSaleCard sale={sale} onSaved={setSale} />

        <div style={{ display: "flex", gap: "var(--space-2)", flexWrap: "wrap" }}>
          <Button onClick={handlePrintCustomerCopy}>Print customer copy</Button>
          <Button onClick={handlePrintOfficeCopy}>Print office copy</Button>
          <Button variant="primary" onClick={handleMarkComplete}>
            {sale.is_complete ? "Reopen sale" : "Mark sale complete"}
          </Button>
        </div>
      </div>
    </div>
  );
}
