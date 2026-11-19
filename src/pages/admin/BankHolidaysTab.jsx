import { useEffect, useState } from "react";
import { getEnglandWalesBankHolidays } from "../../lib/ukBankHolidays.js";
import { formatShortDate, todayIso } from "../timesheets/weekMath.js";
import { useAuth } from "../../lib/AuthContext.jsx";
import { supabase } from "../../lib/supabaseClient.js";
import {
  addBankHoliday, addBankHolidayOverride, deleteBankHoliday, getBankHolidayOverrides, getBankHolidays, getHolidaySettings,
  holidayYearStart, removeBankHolidayOverride,
} from "../../lib/holidayQueries.js";
import { colors } from "../../lib/theme.js";
import { Alert, Button, Card, EmptyState, Field, IconClose, Input, PageHeader, Select } from "../../ui/index.js";

export default function BankHolidaysTab() {
  const { org } = useAuth();
  const [dates, setDates] = useState([]);
  const [people, setPeople] = useState([]);
  const [overridesFor, setOverridesFor] = useState(null); // bank_holiday_id or null
  const [overrides, setOverrides] = useState([]);
  const [newDate, setNewDate] = useState("");
  const [newLabel, setNewLabel] = useState("");
  const [overridePersonId, setOverridePersonId] = useState("");
  const [error, setError] = useState("");
  // "Fill in" -- England & Wales dates for a chosen holiday year that aren't
  // in the list yet. Includes dates already past: they book as taken, same
  // as any other bank holiday (Andy, 19 Nov 2026 -- the 28 days include them).
  const [startMonth, setStartMonth] = useState(4);
  const [fillYearBy, setFillYearBy] = useState(0); // 0 = this holiday year, 1 = next
  const [ukList, setUkList] = useState(null); // { source, events }
  const [filling, setFilling] = useState(false);

  function refresh() {
    getBankHolidays().then(setDates).catch((err) => setError(err.message || String(err)));
  }

  useEffect(() => {
    if (!org) return;
    refresh();
    getHolidaySettings().then((hs) => setStartMonth(hs?.holiday_year_start_month || 4)).catch(() => {});
    getEnglandWalesBankHolidays().then(setUkList);
    supabase.from("profiles").select("id, display_name").eq("org_id", org.id).order("display_name").then(({ data }) => setPeople(data || []));
  }, [org]);

  function refreshOverrides(bankHolidayId) {
    getBankHolidayOverrides(bankHolidayId).then(setOverrides).catch((err) => setError(err.message || String(err)));
  }

  async function handleAdd(e) {
    e.preventDefault();
    if (!newDate || !newLabel.trim()) return;
    setError("");
    try {
      await addBankHoliday(org.id, newDate, newLabel.trim());
      setNewDate("");
      setNewLabel("");
      refresh();
    } catch (err) {
      setError(err.message || String(err));
    }
  }

  async function handleDelete(id) {
    if (!window.confirm("Remove this bank holiday? Anyone it was auto-booked for will lose that day.")) return;
    setError("");
    try {
      await deleteBankHoliday(id);
      refresh();
    } catch (err) {
      setError(err.message || String(err));
    }
  }

  const thisYearStart = holidayYearStart(todayIso(), startMonth);
  const fillStart = `${Number(thisYearStart.slice(0, 4)) + fillYearBy}${thisYearStart.slice(4)}`;
  const fillEnd = `${Number(fillStart.slice(0, 4)) + 1}${fillStart.slice(4)}`; // exclusive
  const existingDates = new Set(dates.map((d) => d.holiday_date));
  const missing = (ukList?.events || []).filter((e) => e.date >= fillStart && e.date < fillEnd && !existingDates.has(e.date));
  const fillYearLabel = `${fillStart.slice(0, 4)}–${String((Number(fillStart.slice(0, 4)) + 1) % 100).padStart(2, "0")}`;

  async function handleFill() {
    const past = missing.filter((e) => e.date < todayIso()).length;
    if (!window.confirm(
      `Add ${missing.length} bank holiday${missing.length === 1 ? "" : "s"} for ${fillYearLabel}?` +
      (past ? ` ${past} ${past === 1 ? "is" : "are"} already past — they'll be booked as holiday taken for Mon–Fri staff.` : "")
    )) return;
    setFilling(true);
    setError("");
    try {
      // One at a time: each insert auto-books it for Mon-Fri staff.
      for (const e of missing) await addBankHoliday(org.id, e.date, e.title);
    } catch (err) {
      setError(err.message || String(err));
    } finally {
      setFilling(false);
      refresh();
    }
  }

  function openOverrides(bankHolidayId) {
    setOverridesFor(bankHolidayId);
    setOverridePersonId("");
    refreshOverrides(bankHolidayId);
  }

  async function handleAddOverride() {
    if (!overridePersonId) return;
    setError("");
    try {
      await addBankHolidayOverride(org.id, overridesFor, overridePersonId);
      setOverridePersonId("");
      refreshOverrides(overridesFor);
    } catch (err) {
      setError(err.message || String(err));
    }
  }

  async function handleRemoveOverride(id) {
    setError("");
    try {
      await removeBankHolidayOverride(id);
      refreshOverrides(overridesFor);
    } catch (err) {
      setError(err.message || String(err));
    }
  }

  return (
    <div>
      <PageHeader title="Bank holidays" level={2} />
      <p style={{ fontSize: "var(--text-sm)", color: colors.inkSoft, marginTop: 0 }}>
        Auto-booked as holiday for anyone on the standard 5-day Mon–Fri pattern. Add each year's dates once
        they're known. Use "Exceptions" if someone specific is asked to work a particular date instead.
      </p>

      {error && <Alert tone="danger" title="Something went wrong">{error}</Alert>}

      <Card pad="md" style={{ maxWidth: 560, marginBottom: "var(--space-4)" }}>
        <div style={{ fontWeight: 600, marginBottom: "var(--space-2)" }}>Fill in England &amp; Wales bank holidays</div>
        <div style={{ display: "flex", gap: "var(--space-2)", alignItems: "center", flexWrap: "wrap" }}>
          <Select value={fillYearBy} onChange={(e) => setFillYearBy(Number(e.target.value))} style={{ width: "auto" }} aria-label="Holiday year">
            <option value={0}>This holiday year ({`${thisYearStart.slice(0, 4)}–${String((Number(thisYearStart.slice(0, 4)) + 1) % 100).padStart(2, "0")}`})</option>
            <option value={1}>Next holiday year</option>
          </Select>
          <Button variant="primary" disabled={!ukList || missing.length === 0 || filling} onClick={handleFill}>
            {filling ? "Adding…" : missing.length ? `Add ${missing.length} missing` : "All added"}
          </Button>
        </div>
        {ukList && (
          <p style={{ fontSize: "var(--text-xs)", color: colors.inkSoft, margin: "var(--space-2) 0 0" }}>
            {missing.length
              ? `Missing for ${fillYearLabel}: ${missing.map((e) => `${formatShortDate(e.date)} ${e.date.slice(0, 4)}`).join(", ")}.`
              : `Every ${fillYearLabel} date is already in the list.`}
            {" "}Source: {ukList.source}.
          </p>
        )}
      </Card>

      <Card pad="md" style={{ maxWidth: 560, marginBottom: 20 }}>
        {dates.length === 0 && <EmptyState title="No bank holidays added yet" />}
        {dates.map((d) => (
          <div key={d.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderBottom: `1px solid ${colors.line}` }}>
            <div>
              <strong>{d.label}</strong>{" "}
              <span style={{ color: colors.inkSoft, fontSize: "var(--text-sm)" }}>{formatShortDate(d.holiday_date)} {d.holiday_date.slice(0, 4)}</span>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <Button onClick={() => openOverrides(d.id)}>Exceptions</Button>
              <Button variant="danger" onClick={() => handleDelete(d.id)}><IconClose size={14} /></Button>
            </div>
          </div>
        ))}

        <form onSubmit={handleAdd} style={{ display: "grid", gridTemplateColumns: "160px 1fr auto", gap: 8, marginTop: 14, alignItems: "end" }}>
          <Field label="Date">
            <Input type="date" value={newDate} onChange={(e) => setNewDate(e.target.value)} />
          </Field>
          <Field label="Label">
            <Input placeholder="e.g. Christmas Day" value={newLabel} onChange={(e) => setNewLabel(e.target.value)} />
          </Field>
          <Button type="submit" variant="primary">+ Add</Button>
        </form>
      </Card>

      {overridesFor && (
        <Card pad="md" style={{ maxWidth: 480 }}>
          <div style={{ fontSize: "var(--text-sm)", fontWeight: 600, marginBottom: 10 }}>
            Exceptions for this date — these people work it instead of getting it auto-booked
          </div>
          {overrides.length === 0 && <p style={{ color: colors.inkSoft, fontSize: "var(--text-sm)" }}>No exceptions.</p>}
          {overrides.map((o) => (
            <div key={o.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 0" }}>
              <span>{o.profile?.display_name}</span>
              <Button variant="danger" onClick={() => handleRemoveOverride(o.id)}>Remove</Button>
            </div>
          ))}
          <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
            <Select value={overridePersonId} onChange={(e) => setOverridePersonId(e.target.value)} style={{ flex: 1 }}>
              <option value="">Choose a person…</option>
              {people.map((p) => (
                <option key={p.id} value={p.id}>{p.display_name}</option>
              ))}
            </Select>
            <Button onClick={handleAddOverride}>Add exception</Button>
          </div>
          <Button onClick={() => setOverridesFor(null)} style={{ marginTop: 10 }}>Done</Button>
        </Card>
      )}
    </div>
  );
}
