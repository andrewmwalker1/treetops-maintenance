// Admin -> Holiday -> Year start balances: the agreed starting point of
// each person's holiday year (holiday_year_balances,
// 94-holiday-year-balances.sql). Carried over (+) or owed (-), plus -- for
// a year the app joined part-way through -- holiday already taken and
// hours already worked before it. Entered in days or hours per box (Andy:
// days suit the 35-hour staff, hours suit Sam); always stored as hours.
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../../lib/AuthContext.jsx";
import { formatDays, formatHours, workingDayHours } from "../../lib/dayLength.js";
import {
  getHolidaySettings, getProfilesForTimeProfileAdmin, getYearBalances, holidayYearStart, upsertYearBalance,
} from "../../lib/holidayQueries.js";
import { colors } from "../../lib/theme.js";
import { todayIso } from "../timesheets/weekMath.js";
import { Alert, Button, Field, Input, PageHeader, Pill, Select } from "../../ui/index.js";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function yearLabel(yearStart) {
  const [y, m] = yearStart.split("-").map(Number);
  return `${y}–${String((y + 1) % 100).padStart(2, "0")} (from 1 ${MONTHS[m - 1]} ${y})`;
}

function shiftYear(yearStart, by) {
  return `${Number(yearStart.slice(0, 4)) + by}${yearStart.slice(4)}`;
}

// A number + a days/hrs switch. `hours` in and out; the unit only changes
// how it's typed and shown.
function AmountInput({ label, hours, onChange, dayHours, unit, onUnitChange }) {
  const shown = hours === "" ? "" : unit === "days" ? formatHours(Number(hours) / dayHours) : formatHours(hours);
  const [text, setText] = useState(shown);
  useEffect(() => setText(shown), [unit]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <Field label={label}>
      <div style={{ display: "flex", gap: "var(--space-1)" }}>
        <Input
          type="number" step={unit === "days" ? "0.5" : "0.25"} min="0"
          value={text}
          placeholder="0"
          onChange={(e) => {
            setText(e.target.value);
            const n = Number(e.target.value);
            onChange(e.target.value === "" ? "" : unit === "days" ? n * dayHours : n);
          }}
          style={{ width: 90 }}
        />
        <Select value={unit} onChange={(e) => onUnitChange(e.target.value)} disabled={!dayHours} style={{ width: 90 }} aria-label={`${label} unit`}>
          <option value="days">days</option>
          <option value="hrs">hrs</option>
        </Select>
      </div>
    </Field>
  );
}

function PersonBalance({ person, yearStart, initial, orgId }) {
  const dayHours = workingDayHours(person.timeProfile);
  const startUnit = dayHours ? "days" : "hrs";
  const [direction, setDirection] = useState(Number(initial?.carried_hours) < 0 ? "owed" : "carried");
  const [carried, setCarried] = useState(initial ? Math.abs(Number(initial.carried_hours)) || "" : "");
  const [carriedUnit, setCarriedUnit] = useState(startUnit);
  const [taken, setTaken] = useState(initial ? Number(initial.taken_before_hours) || "" : "");
  const [takenUnit, setTakenUnit] = useState(startUnit);
  const [worked, setWorked] = useState(initial ? Number(initial.worked_before_hours) || "" : "");
  const [note, setNote] = useState(initial?.note || "");
  const [state, setState] = useState(initial ? "saved" : "new"); // new | dirty | saving | saved
  const [error, setError] = useState("");

  const dirty = (fn) => (v) => {
    fn(v);
    setState("dirty");
  };

  async function save() {
    setState("saving");
    setError("");
    try {
      await upsertYearBalance({
        profileId: person.profileId,
        orgId,
        yearStart,
        carriedHours: (Number(carried) || 0) * (direction === "owed" ? -1 : 1),
        takenBeforeHours: Number(taken) || 0,
        workedBeforeHours: Number(worked) || 0,
        note,
      });
      setState("saved");
    } catch (err) {
      setError(err.message || String(err));
      setState("dirty");
    }
  }

  const carriedSigned = (Number(carried) || 0) * (direction === "owed" ? -1 : 1);

  return (
    <div style={{ background: colors.surfaceHover, border: `1px solid ${colors.line}`, borderRadius: "var(--radius-sm)", padding: "var(--space-3)", marginBottom: "var(--space-3)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", flexWrap: "wrap", marginBottom: "var(--space-2)" }}>
        <span style={{ fontWeight: 600 }}>{person.displayName}</span>
        {dayHours
          ? <span style={{ fontSize: "var(--text-xs)", color: colors.inkSoft }}>{formatHours(dayHours)}-hour day</span>
          : <Pill tone="neutral">Hours only — no typical day set</Pill>}
        {!person.timeProfile && <Pill tone="warn">No work pattern yet</Pill>}
        {carriedSigned !== 0 && (
          <Pill tone={carriedSigned > 0 ? "ok" : "warn"}>
            {carriedSigned > 0 ? "+" : "−"}{formatDays(Math.abs(carriedSigned), dayHours) || `${formatHours(Math.abs(carriedSigned))} hrs`}
            {carriedSigned > 0 ? " carried" : " owed"}
          </Pill>
        )}
      </div>
      {error && <Alert tone="danger" title="Couldn't save">{error}</Alert>}
      <div style={{ display: "flex", gap: "var(--space-4)", alignItems: "flex-end", flexWrap: "wrap" }}>
        <Field label="Start of year">
          <Select value={direction} onChange={(e) => dirty(setDirection)(e.target.value)} style={{ width: 170 }}>
            <option value="carried">Carried over</option>
            <option value="owed">Owed</option>
          </Select>
        </Field>
        <AmountInput label="Amount" hours={carried} onChange={dirty(setCarried)} dayHours={dayHours} unit={carriedUnit} onUnitChange={setCarriedUnit} />
        <AmountInput label="Taken before the app" hours={taken} onChange={dirty(setTaken)} dayHours={dayHours} unit={takenUnit} onUnitChange={setTakenUnit} />
        <Field label="Hours worked before the app">
          <Input type="number" step="0.25" min="0" placeholder="0" value={worked} onChange={(e) => dirty(setWorked)(e.target.value)} style={{ width: 110 }} />
        </Field>
        <Field label="Note">
          <Input value={note} placeholder="e.g. agreed 3 Apr" onChange={(e) => dirty(setNote)(e.target.value)} />
        </Field>
        <Button variant={state === "dirty" ? "primary" : "secondary"} disabled={state !== "dirty"} onClick={save}>
          {state === "saving" ? "Saving…" : state === "saved" ? "Saved" : "Save"}
        </Button>
      </div>
    </div>
  );
}

export default function YearBalancesTab() {
  const { org } = useAuth();
  const [settings, setSettings] = useState(null);
  const [people, setPeople] = useState([]);
  const [yearStart, setYearStart] = useState(null);
  const [balances, setBalances] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!org) return;
    Promise.all([getHolidaySettings(), getProfilesForTimeProfileAdmin(org.id)])
      .then(([hs, profiles]) => {
        setSettings(hs);
        setPeople(profiles);
        setYearStart(holidayYearStart(todayIso(), hs?.holiday_year_start_month || 4));
      })
      .catch((err) => setError(err.message || String(err)));
  }, [org]);

  useEffect(() => {
    if (!yearStart) return;
    setBalances(null);
    getYearBalances(yearStart).then(setBalances).catch((err) => setError(err.message || String(err)));
  }, [yearStart]);

  const thisYear = useMemo(() => (settings ? holidayYearStart(todayIso(), settings.holiday_year_start_month || 4) : null), [settings]);

  return (
    <div>
      <PageHeader title="Year start balances" level={2} />
      <p style={{ fontSize: "var(--text-sm)", color: colors.inkSoft, marginTop: 0 }}>
        The agreed starting point of each person&apos;s holiday year. <strong>Carried over</strong> adds to that year&apos;s
        allowance; <strong>owed</strong> takes it off. For the year the app started part-way through, also enter
        holiday <strong>already taken</strong> before the app (leave out bank holidays for Mon–Fri staff — the app books
        those itself) and <strong>hours worked</strong> before the app, which only feeds &quot;earned so far&quot;.
        Days use each person&apos;s own working day.
      </p>
      {error && <Alert tone="danger" title="Something went wrong">{error}</Alert>}
      {thisYear && (
        <Field label="Holiday year">
          <Select value={yearStart} onChange={(e) => setYearStart(e.target.value)} style={{ maxWidth: "var(--width-sm)" }}>
            {[-1, 0, 1].map((by) => {
              const y = shiftYear(thisYear, by);
              return <option key={y} value={y}>{yearLabel(y)}{by === 0 ? " — this year" : ""}</option>;
            })}
          </Select>
        </Field>
      )}
      <div style={{ marginTop: "var(--space-4)" }}>
        {balances && people.map((p) => (
          <PersonBalance key={`${yearStart}-${p.profileId}`} person={p} yearStart={yearStart} initial={balances[p.profileId]} orgId={org.id} />
        ))}
      </div>
    </div>
  );
}
