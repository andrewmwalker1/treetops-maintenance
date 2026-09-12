import { useRef, useState } from "react";
import Papa from "papaparse";
import { colors } from "../../lib/theme.js";
import { Alert, Button, Card, Input, Select, Textarea } from "../../ui/index.js";
import {
  applyStandardInstructionTokens, computeCaravanAmount, computeMonthsToCharge, computePitchFeeProrataAmount,
  deriveSeasonLengthForPitch, derivePeopleFromRow, formatCurrency, getCampmanagerChanges, getWifiRegistrationReminder,
  inputValueToDate, lookupPitchFeeFullYear, parseAmount, sumItems, ukDateToInputValue,
} from "./calculations.js";
import StandardInstructionsModal from "./StandardInstructionsModal.jsx";

const CUSTOMER_FIELD_MAP = {
  addressLine1: "Unit Customer Address Line 1",
  addressLine2: "Unit Customer Address Line 2",
  addressLine3: "Unit Customer Address Line 3",
  cityTown: "Unit Customer Address City/Town",
  postcode: "Unit Customer Address Postcode",
  country: "Unit Customer Address Country",
  telephone: "Unit Customer Telephone",
  mobile: "Unit Customer Mobile",
  email: "Unit Customer Email",
};
const CUSTOMER_FIELD_LABELS = {
  addressLine1: "Address line 1", addressLine2: "Address line 2", addressLine3: "Address line 3",
  cityTown: "City/Town", postcode: "Postcode", country: "Country", telephone: "Telephone", mobile: "Mobile", email: "Email",
};
const FULL_WIDTH_FIELDS = new Set(["addressLine1", "addressLine2", "addressLine3"]);

// Matches the original standalone tool's .card h2 / .card-hint / .field
// label styling exactly (same colour tokens, just a tighter, more
// form-dense layout than this app's usual PageHeader/Card spacing).
export function CardTitle({ children }) {
  return <h2 style={{ fontSize: 16, margin: "0 0 4px", color: colors.mossDark }}>{children}</h2>;
}
export function Hint({ children }) {
  return <p style={{ color: colors.inkSoft, fontSize: "var(--text-sm)", margin: "0 0 18px" }}>{children}</p>;
}
function SectionLabel({ children }) {
  return <p style={{ fontSize: "var(--text-sm)", textTransform: "uppercase", letterSpacing: "0.04em", color: colors.inkSoft, margin: "20px 0 4px" }}>{children}</p>;
}
function FieldLabel({ children }) {
  return <span style={{ display: "block", fontSize: "var(--text-xs)", fontWeight: 600, color: colors.inkSoft, marginBottom: 4 }}>{children}</span>;
}
function Field({ label, children, full }) {
  return (
    <label style={{ display: "block", gridColumn: full ? "1 / -1" : undefined }}>
      <FieldLabel>{label}</FieldLabel>
      {children}
    </label>
  );
}
const shadedBoxStyle = { background: colors.surfaceHover, border: `1px solid ${colors.line}`, borderRadius: "var(--radius-sm)", padding: 16 };
const totalRowStyle = { display: "flex", justifyContent: "space-between", alignItems: "center", fontWeight: 700, fontSize: "var(--text-sm)", padding: "12px 14px", margin: "14px 0 4px", ...shadedBoxStyle };
const grandTotalRowStyle = { ...totalRowStyle, background: colors.okSurface, borderColor: colors.okBorder, color: colors.okInk, fontSize: "var(--text-base)" };

// ---------------------------------------------------------------------
// Step 1 — Import & contact details
// ---------------------------------------------------------------------

function newSaleFromRow(row, areaSeasonMap) {
  const customer = {};
  for (const key in CUSTOMER_FIELD_MAP) customer[key] = row[CUSTOMER_FIELD_MAP[key]] || "";
  const { people } = derivePeopleFromRow(row);
  const unit = {
    pitchBand: row["Unit Category"] || "",
    licenceStart: ukDateToInputValue(row["Unit Licence Start"]),
    licenceEnd: ukDateToInputValue(row["Unit Licence End"]),
  };
  const seasonLength = deriveSeasonLengthForPitch(row["Unit Site"], areaSeasonMap).seasonLength;
  return {
    selectedRow: row,
    customer,
    people,
    unit,
    originalUnit: { ...unit },
    seasonLength,
    buildSpec: "EN 1647",
    firstOwner: "no",
  };
}

function newPriceForSale(unit, seasonLength, ratesFullYearDefault, selectedRow) {
  const caravanDescription = ["Caravan -", selectedRow?.["Unit Make"], selectedRow?.["Unit Model"]].filter(Boolean).join(" ");
  return {
    windowPrice: "",
    caravanDescription,
    includedItems: [],
    additionalItems: [],
    pitchFeeMonths: computeMonthsToCharge(unit ? inputValueToDate(unit.licenceStart) : null, seasonLength),
    pitchFeeMonthsManuallySet: false,
    pitchFeeIncluded: true,
    ratesFullYear: ratesFullYearDefault || "",
    ratesCurrentYear: "",
    ratesPaymentYear: new Date().getFullYear(),
    deposit: { amount: "", date: "" },
    partExchange: { amount: "", date: "" },
    // Defaulted to the licence start date -- both are usually the same
    // day in practice; still freely editable if a sale differs.
    balanceDate: unit?.licenceStart || "",
    completionType: "fixed",
    completionDate: unit?.licenceStart || "",
  };
}

export function Step1Import({ wizard, setWizard, areaSeasonMap, ratesFullYearDefault, onContinue }) {
  const [csvError, setCsvError] = useState("");
  const [rows, setRows] = useState(null);
  const [fileName, setFileName] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef(null);

  function selectRow(row) {
    const sale = newSaleFromRow(row, areaSeasonMap);
    setWizard((w) => ({ ...w, ...sale, price: newPriceForSale(sale.unit, sale.seasonLength, ratesFullYearDefault, row) }));
    setRows(null);
  }

  function handleFile(file) {
    setCsvError("");
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete(results) {
        if (results.errors && results.errors.length) {
          setCsvError("Couldn't read that file as CSV: " + results.errors[0].message);
          return;
        }
        const parsed = results.data.filter((r) => r["Unit Site"]);
        if (parsed.length === 0) {
          setCsvError("No unit rows found in that file.");
          return;
        }
        setFileName(file.name + " (" + parsed.length + " row" + (parsed.length === 1 ? "" : "s") + ")");
        if (parsed.length === 1) selectRow(parsed[0]);
        else setRows(parsed);
      },
      error(err) {
        setCsvError("Couldn't read that file: " + err.message);
      },
    });
  }

  const hasName = wizard.people.some((p) => p.firstName || p.lastName);

  return (
    <div>
      <Card pad="md" style={{ marginBottom: 20 }}>
        <CardTitle>Import sale CSV</CardTitle>
        <Hint>The Campmanager unit export (e.g. "Holiday Homes.csv"). If it contains more than one unit, you'll be asked which one to use.</Hint>
        {wizard.selectedRow ? (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 14px", background: colors.okSurface, border: `1px solid ${colors.okBorder}`, borderRadius: "var(--radius-sm)", color: colors.okInk, fontSize: "var(--text-sm)" }}>
            <span>{fileName || "Sale loaded"}</span>
            <label style={{ textDecoration: "underline", cursor: "pointer" }}>
              Change file
              <input type="file" accept=".csv,text/csv" style={{ display: "none" }} onChange={(e) => e.target.files[0] && handleFile(e.target.files[0])} />
            </label>
          </div>
        ) : (
          <div
            onClick={() => fileInputRef.current?.click()}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(false);
              const file = e.dataTransfer.files?.[0];
              if (file) handleFile(file);
            }}
            style={{
              border: `2px dashed ${dragOver ? colors.moss : colors.lineStrong}`,
              background: dragOver ? colors.surfaceHover : "transparent",
              borderRadius: "var(--radius-sm)", padding: 28, textAlign: "center", color: colors.inkSoft, cursor: "pointer",
            }}
          >
            <div style={{ fontWeight: 600, color: colors.ink, marginBottom: 4 }}>Click to choose a file, or drag one here</div>
            <div>CSV file exported from Campmanager</div>
            <input ref={fileInputRef} type="file" accept=".csv,text/csv" style={{ display: "none" }} onChange={(e) => e.target.files[0] && handleFile(e.target.files[0])} />
          </div>
        )}
        {csvError && <Alert tone="danger" title="Something went wrong">{csvError}</Alert>}
      </Card>

      {rows && (
        <Card pad="md" style={{ marginBottom: 20 }}>
          <CardTitle>Which unit is this sale for?</CardTitle>
          <Hint>This file has more than one unit — pick the one being sold.</Hint>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "var(--text-sm)" }}>
              <thead>
                <tr>
                  {["Pitch", "Current owner", "Caravan", "Pitch band"].map((h) => (
                    <th key={h} style={{ textAlign: "left", fontSize: "var(--text-xs)", textTransform: "uppercase", letterSpacing: "0.04em", color: colors.inkSoft, borderBottom: `1px solid ${colors.line}`, padding: "6px 10px" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, i) => (
                  <tr key={i} onClick={() => selectRow(row)} style={{ cursor: "pointer" }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = colors.surfaceHover)}
                    onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                  >
                    <td style={{ padding: "8px 10px", borderBottom: `1px solid ${colors.line}` }}>{row["Unit Site"]}</td>
                    <td style={{ padding: "8px 10px", borderBottom: `1px solid ${colors.line}` }}>{[row["Unit Customer Title"], row["Unit Customer First Name"], row["Unit Customer Last Name"]].filter(Boolean).join(" ")}</td>
                    <td style={{ padding: "8px 10px", borderBottom: `1px solid ${colors.line}` }}>{[row["Unit Make"], row["Unit Model"]].filter(Boolean).join(" ")}</td>
                    <td style={{ padding: "8px 10px", borderBottom: `1px solid ${colors.line}` }}>{row["Unit Category"]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {wizard.selectedRow && (
        <Card pad="md">
          <CardTitle>Customer contact details</CardTitle>
          <Hint>Pulled from the CSV for the selected unit. Check and correct anything before continuing — these feed the agreement's address block.</Hint>

          <div style={{ ...shadedBoxStyle, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: "12px 20px", marginBottom: 20 }}>
            {[
              ["Pitch", wizard.selectedRow["Unit Site"]],
              ["Caravan", [wizard.selectedRow["Unit Make"], wizard.selectedRow["Unit Model"]].filter(Boolean).join(" ")],
              ["Year", wizard.selectedRow["Unit Year"]],
              ["Size", wizard.selectedRow["Unit Length"] && wizard.selectedRow["Unit Width"] ? `${wizard.selectedRow["Unit Length"]} x ${wizard.selectedRow["Unit Width"]}` : ""],
              ["Serial number", wizard.selectedRow["Unit Serial Number"]],
            ].map(([label, value]) => (
              <div key={label} style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                <span style={{ fontSize: "var(--text-xs)", textTransform: "uppercase", letterSpacing: "0.04em", color: colors.inkSoft }}>{label}</span>
                <span style={{ fontSize: "var(--text-sm)", fontWeight: 600 }}>{value || "—"}</span>
              </div>
            ))}
          </div>

          <SectionLabel>Who owns this caravan</SectionLabel>
          <Hint>Campmanager stores joint owners squashed together (e.g. Title "Mr &amp; Mrs", First name "Jane &amp; Mark") — split out here so each person's name is correct on the signature page. Add or remove people as needed.</Hint>

          {wizard.peopleAutoSwapped && (
            <div style={{ fontSize: "var(--text-sm)", padding: "8px 12px", background: colors.warnSurface, border: `1px solid ${colors.warnBorder}`, color: colors.warnInk, borderRadius: "var(--radius-sm)", marginBottom: 12 }}>
              Titles didn't match the usual gender for these first names, so they've been auto-swapped. This is a guess, not a guarantee — please check it's right.
            </div>
          )}

          {wizard.people.map((person, i) => (
            <div key={i} style={{ display: "grid", gridTemplateColumns: "110px 1fr 1fr auto", gap: 10, alignItems: "end", marginBottom: 10 }}>
              <Field label="Title">
                <Input
                  list="license-agreement-title-suggestions"
                  value={person.title}
                  onChange={(e) => {
                    const people = wizard.people.map((p, idx) => (idx === i ? { ...p, title: e.target.value } : p));
                    setWizard((w) => ({ ...w, people, peopleAutoSwapped: false }));
                  }}
                />
              </Field>
              <Field label="First name">
                <Input
                  value={person.firstName}
                  onChange={(e) => {
                    const people = wizard.people.map((p, idx) => (idx === i ? { ...p, firstName: e.target.value } : p));
                    setWizard((w) => ({ ...w, people }));
                  }}
                />
              </Field>
              <Field label="Last name">
                <Input
                  value={person.lastName}
                  onChange={(e) => {
                    const people = wizard.people.map((p, idx) => (idx === i ? { ...p, lastName: e.target.value } : p));
                    setWizard((w) => ({ ...w, people }));
                  }}
                />
              </Field>
              <Button
                variant="danger"
                disabled={wizard.people.length <= 1}
                onClick={() => setWizard((w) => ({ ...w, people: w.people.filter((_, idx) => idx !== i) }))}
                title="Remove this person"
              >
                ✕
              </Button>
            </div>
          ))}
          <datalist id="license-agreement-title-suggestions">
            {["Mr", "Mrs", "Miss", "Ms", "Mx", "Dr"].map((t) => <option key={t} value={t} />)}
          </datalist>

          {wizard.people.length === 2 && (
            <div style={{ margin: "4px 0 14px" }}>
              <Button
                onClick={() => {
                  const [a, b] = wizard.people;
                  setWizard((w) => ({ ...w, people: [{ ...a, title: b.title }, { ...b, title: a.title }], peopleAutoSwapped: false }));
                }}
              >
                ⇅ Swap titles between the two people
              </Button>
            </div>
          )}
          <div style={{ marginBottom: 20 }}>
            <Button onClick={() => setWizard((w) => ({ ...w, people: [...w.people, { title: "", firstName: "", lastName: w.people[w.people.length - 1]?.lastName || "" }] }))}>
              + Add person
            </Button>
          </div>

          <SectionLabel>Contact details</SectionLabel>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "14px 16px", marginBottom: 20 }}>
            {Object.keys(CUSTOMER_FIELD_MAP).map((key) => (
              <Field key={key} label={CUSTOMER_FIELD_LABELS[key]} full={FULL_WIDTH_FIELDS.has(key)}>
                <Input
                  value={wizard.customer[key] || ""}
                  onChange={(e) => setWizard((w) => ({ ...w, customer: { ...w.customer, [key]: e.target.value } }))}
                />
              </Field>
            ))}
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <Button variant="primary" disabled={!hasName} onClick={onContinue}>Continue</Button>
          </div>
        </Card>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------
// Step 2 — Price breakdown
// ---------------------------------------------------------------------

function LineItemsEditor({ items, onChange, placeholder }) {
  return (
    <div>
      {items.map((item, i) => (
        <div key={i} style={{ display: "grid", gridTemplateColumns: "1fr 130px auto", gap: 10, alignItems: "center", marginBottom: 8 }}>
          <Input
            placeholder={placeholder}
            value={item.description}
            onChange={(e) => onChange(items.map((it, idx) => (idx === i ? { ...it, description: e.target.value } : it)))}
          />
          <Input
            type="number" step="0.01" min="0" placeholder="0.00"
            value={item.amount}
            onChange={(e) => onChange(items.map((it, idx) => (idx === i ? { ...it, amount: e.target.value } : it)))}
          />
          <Button variant="danger" onClick={() => onChange(items.filter((_, idx) => idx !== i))}>✕</Button>
        </div>
      ))}
    </div>
  );
}

const readOnlyRowStyle = { background: colors.surfaceHover, color: colors.inkSoft, fontWeight: 600 };

export function Step2Price({ wizard, setWizard, pitchBandsTable, onContinue }) {
  const { price, unit, seasonLength } = wizard;
  const patchPrice = (patch) => setWizard((w) => ({ ...w, price: { ...w.price, ...patch } }));

  const fullYear = lookupPitchFeeFullYear(unit.pitchBand, pitchBandsTable);
  const pitchFeeAmount = computePitchFeeProrataAmount(unit, seasonLength, price.pitchFeeMonths, pitchBandsTable);
  const pitchFeeIncluded = price.pitchFeeIncluded !== false;
  const caravanAmount = computeCaravanAmount(price, unit, seasonLength, pitchBandsTable);
  const windowPrice = parseAmount(price.windowPrice);
  const additionalTotal = sumItems(price.additionalItems) + (pitchFeeIncluded ? 0 : pitchFeeAmount);
  const grandTotal = windowPrice + additionalTotal;
  const balance = grandTotal - parseAmount(price.deposit.amount) - parseAmount(price.partExchange.amount);

  const bandOptions = pitchBandsTable.filter((r) => / Pitch Fees$/i.test(r.description)).map((r) => r.description.replace(/ Pitch Fees$/i, ""));
  if (unit.pitchBand && !bandOptions.some((b) => b.toLowerCase() === unit.pitchBand.toLowerCase())) bandOptions.unshift(unit.pitchBand);

  const wifiAlreadyInstalled = (wizard.selectedRow?.["Unit Registration"] || "").trim().toLowerCase() === "wifi";

  function setLicenceDate(field, value) {
    const nextUnit = { ...unit, [field]: value };
    setWizard((w) => {
      const nextPrice = { ...w.price };
      if (!nextPrice.pitchFeeMonthsManuallySet) {
        nextPrice.pitchFeeMonths = computeMonthsToCharge(field === "licenceStart" ? inputValueToDate(value) : inputValueToDate(unit.licenceStart), w.seasonLength);
      }
      return { ...w, unit: nextUnit, price: nextPrice };
    });
  }

  function setSeasonLength(len) {
    setWizard((w) => {
      const nextPrice = { ...w.price };
      if (!nextPrice.pitchFeeMonthsManuallySet) {
        nextPrice.pitchFeeMonths = computeMonthsToCharge(inputValueToDate(w.unit.licenceStart), len);
      }
      return { ...w, seasonLength: len, price: nextPrice };
    });
  }

  return (
    <Card pad="md">
      <CardTitle>Price breakdown</CardTitle>
      <Hint>Line items for the purchase price, plus payment and completion. Totals update as you add items.</Hint>

      <SectionLabel>Pitch band &amp; licence dates</SectionLabel>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "14px 16px", marginBottom: 20 }}>
        <Field label="Pitch band">
          <Select value={unit.pitchBand} onChange={(e) => setWizard((w) => ({ ...w, unit: { ...w.unit, pitchBand: e.target.value } }))}>
            {bandOptions.length === 0 && <option value="">Import the Pitch Fees table in Admin settings</option>}
            {bandOptions.map((b) => <option key={b} value={b}>{b}</option>)}
          </Select>
        </Field>
        <Field label="Pitch fee (full year, inc VAT)">
          <Input readOnly style={readOnlyRowStyle} value={pitchBandsTable.length === 0 ? "Import the Pitch Fees table above" : fullYear === null ? "No match for this pitch band" : formatCurrency(fullYear)} />
        </Field>
        <Field label="Licence start date">
          <Input type="date" value={unit.licenceStart} onChange={(e) => setLicenceDate("licenceStart", e.target.value)} />
        </Field>
        <Field label="Licence end date">
          <Input type="date" value={unit.licenceEnd} onChange={(e) => setLicenceDate("licenceEnd", e.target.value)} />
        </Field>
        <div>
          <FieldLabel>Pitch fee season length</FieldLabel>
          <div style={{ display: "flex", gap: 24, fontSize: "var(--text-sm)" }}>
            {[9, 10.5].map((len) => (
              <label key={len} style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
                <input type="radio" checked={seasonLength === len} onChange={() => setSeasonLength(len)} /> {len} months
              </label>
            ))}
          </div>
        </div>
        <Field label={`Months to charge (of ${seasonLength})`}>
          <Input
            type="number" step="1" min="0"
            value={price.pitchFeeMonths}
            onChange={(e) => patchPrice({ pitchFeeMonths: e.target.value, pitchFeeMonthsManuallySet: true })}
          />
        </Field>
      </div>

      <div style={{ marginBottom: 20 }}>
        <FieldLabel>Build specification</FieldLabel>
        <div style={{ display: "flex", gap: 24, fontSize: "var(--text-sm)" }}>
          {["EN 1647", "BS 3632"].map((v) => (
            <label key={v} style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
              <input type="radio" checked={wizard.buildSpec === v} onChange={() => setWizard((w) => ({ ...w, buildSpec: v }))} /> {v}
            </label>
          ))}
        </div>
      </div>

      <div style={{ marginBottom: 20 }}>
        <FieldLabel>Will you be the first owner of your Holiday Caravan?</FieldLabel>
        <div style={{ display: "flex", gap: 24, fontSize: "var(--text-sm)" }}>
          {[["yes", "Yes"], ["no", "No"]].map(([v, label]) => (
            <label key={v} style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
              <input type="radio" checked={wizard.firstOwner === v} onChange={() => setWizard((w) => ({ ...w, firstOwner: v }))} /> {label}
            </label>
          ))}
        </div>
      </div>

      <SectionLabel>Items included in the window price</SectionLabel>
      <div style={{ maxWidth: 220, marginBottom: 14 }}>
        <Field label="Window price">
          <Input type="number" step="0.01" min="0" placeholder="0.00" value={price.windowPrice} onChange={(e) => patchPrice({ windowPrice: e.target.value })} />
        </Field>
      </div>
      {wifiAlreadyInstalled && (
        <div style={{ fontSize: "var(--text-sm)", padding: "8px 12px", background: colors.warnSurface, border: `1px solid ${colors.warnBorder}`, color: colors.warnInk, borderRadius: "var(--radius-sm)", marginBottom: 12 }}>
          Wifi Already Installed
        </div>
      )}
      <Hint>The all-in advertised price. The caravan's own value below is whatever's left after the other included items — it isn't entered directly.</Hint>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 130px auto", gap: 10, alignItems: "center", marginBottom: 8 }}>
        <Input value={price.caravanDescription} onChange={(e) => patchPrice({ caravanDescription: e.target.value })} />
        <Input readOnly style={readOnlyRowStyle} value={formatCurrency(caravanAmount)} />
        <span />
      </div>
      {caravanAmount < 0 && (
        <Alert tone="danger" title="Check the figures">
          {windowPrice
            ? `The pitch fee, rates and other included items come to more than the window price (by ${formatCurrency(-caravanAmount)}).`
            : "Enter the window price above before adding included items."}
        </Alert>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 130px auto", gap: 10, alignItems: "center", marginBottom: 4 }}>
        <Input readOnly style={readOnlyRowStyle} value="Pitch Fees (pro-rata)" />
        <Input readOnly style={readOnlyRowStyle} value={formatCurrency(pitchFeeAmount)} />
        <span />
      </div>
      <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: "var(--text-sm)", margin: "0 0 6px", cursor: "pointer" }}>
        <input
          type="checkbox"
          checked={!pitchFeeIncluded}
          onChange={(e) => patchPrice({ pitchFeeIncluded: !e.target.checked })}
        />
        Add-on — charge on top of the window price instead of bundling it in
      </label>
      <Hint>{fullYear === null
        ? (pitchBandsTable.length ? "No matching pitch band found in the Pitch Fees table — check the pitch band above." : "Import the Pitch Fees table in Admin settings to calculate this automatically.")
        : `${formatCurrency(fullYear)} full year ÷ ${seasonLength} months × ${price.pitchFeeMonths} months to charge.`}</Hint>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 130px auto", gap: 10, alignItems: "center", marginBottom: 4 }}>
        <Input readOnly style={readOnlyRowStyle} value="Rates, Water & Refuse" />
        <Input type="number" step="0.01" min="0" placeholder="0.00" value={price.ratesCurrentYear} onChange={(e) => patchPrice({ ratesCurrentYear: e.target.value })} />
        <span />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "14px 16px", margin: "0 0 14px" }}>
        <Field label="Rates (full year)">
          <Input type="number" step="0.01" min="0" placeholder="0.00" value={price.ratesFullYear} onChange={(e) => patchPrice({ ratesFullYear: e.target.value })} />
        </Field>
        <Field label="Rates payment date this year (01 Jul)">
          <Input type="number" min="2000" max="2100" step="1" value={price.ratesPaymentYear} onChange={(e) => patchPrice({ ratesPaymentYear: e.target.value })} />
        </Field>
      </div>
      <Hint>Rates aren't banded like the Pitch Fee, and there's no formula — enter the current full-year figure (saved as next sale's default) and whatever's being charged for this one.</Hint>

      <LineItemsEditor items={price.includedItems} placeholder="e.g. Insurance, Wifi Install" onChange={(items) => patchPrice({ includedItems: items })} />
      <Button onClick={() => patchPrice({ includedItems: [...price.includedItems, { description: "", amount: "" }] })}>+ Add item</Button>
      <div style={totalRowStyle}>
        <span>Agreed purchase price (window price)</span>
        <span>{formatCurrency(windowPrice)}</span>
      </div>

      <SectionLabel>Additional costs</SectionLabel>
      <Hint>Anything charged on top of the window price — delivery, siting, connection fees, extras.</Hint>
      <LineItemsEditor items={price.additionalItems} placeholder="e.g. Delivery" onChange={(items) => patchPrice({ additionalItems: items })} />
      <Button onClick={() => patchPrice({ additionalItems: [...price.additionalItems, { description: "", amount: "" }] })}>+ Add cost</Button>
      <div style={grandTotalRowStyle}>
        <span>Agreed total purchase price (including additional costs)</span>
        <span>{formatCurrency(grandTotal)}</span>
      </div>

      <SectionLabel>Payment</SectionLabel>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "14px 16px", marginBottom: 20 }}>
        <Field label="Deposit paid"><Input type="number" step="0.01" min="0" placeholder="0.00" value={price.deposit.amount} onChange={(e) => patchPrice({ deposit: { ...price.deposit, amount: e.target.value } })} /></Field>
        <Field label="Deposit date"><Input type="date" value={price.deposit.date} onChange={(e) => patchPrice({ deposit: { ...price.deposit, date: e.target.value } })} /></Field>
        <Field label="Allowance for part-exchange"><Input type="number" step="0.01" min="0" placeholder="0.00" value={price.partExchange.amount} onChange={(e) => patchPrice({ partExchange: { ...price.partExchange, amount: e.target.value } })} /></Field>
        <Field label="Part-exchange date"><Input type="date" value={price.partExchange.date} onChange={(e) => patchPrice({ partExchange: { ...price.partExchange, date: e.target.value } })} /></Field>
        <Field label="Balance"><Input readOnly style={readOnlyRowStyle} value={formatCurrency(Math.max(balance, 0)) + (balance < 0 ? " (deposit + part-exchange exceed the total)" : "")} /></Field>
        <Field label="Balance date"><Input type="date" value={price.balanceDate} onChange={(e) => patchPrice({ balanceDate: e.target.value })} /></Field>
      </div>

      <SectionLabel>Completion</SectionLabel>
      <div style={{ display: "flex", gap: 24, fontSize: "var(--text-sm)", marginBottom: 14 }}>
        {[["fixed", "Fixed completion date"], ["estimated", "Estimated completion date"]].map(([v, label]) => (
          <label key={v} style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
            <input type="radio" checked={price.completionType === v} onChange={() => patchPrice({ completionType: v })} /> {label}
          </label>
        ))}
      </div>
      <div style={{ maxWidth: 220, marginBottom: 20 }}>
        <Field label={price.completionType === "estimated" ? "Estimated completion date" : "Completion date"}>
          <Input type="date" value={price.completionDate} onChange={(e) => patchPrice({ completionDate: e.target.value })} />
        </Field>
      </div>

      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <Button variant="primary" onClick={onContinue}>Continue</Button>
      </div>
    </Card>
  );
}

// ---------------------------------------------------------------------
// Step 3 — Special instructions
// ---------------------------------------------------------------------

export function Step3Instructions({ wizard, setWizard, onContinue, permissions, standardInstructions, onStandardInstructionsChanged }) {
  const [manageOpen, setManageOpen] = useState(false);
  const canManage = permissions?.has("can_use_office_hub");

  function insertStandardInstruction(id) {
    const item = (standardInstructions || []).find((i) => i.id === id);
    if (!item) return;
    const text = applyStandardInstructionTokens(item.body_text);
    setWizard((w) => {
      const current = (w.specialTerms || "").trim();
      const next = !current || current.toLowerCase() === "none" ? text : `${current}\n\n${text}`;
      return { ...w, specialTerms: next };
    });
  }

  return (
    <Card pad="md">
      <CardTitle>Special instructions</CardTitle>
      <Hint>Any special or extra terms which change or add to the standard terms in the Purchase Agreement. Leave as "None" if there aren't any.</Hint>

      <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 12, flexWrap: "wrap" }}>
        <Select value="" onChange={(e) => e.target.value && insertStandardInstruction(e.target.value)} style={{ maxWidth: 320 }}>
          <option value="">Insert a standard instruction…</option>
          {(standardInstructions || []).map((i) => <option key={i.id} value={i.id}>{i.label}</option>)}
        </Select>
        {canManage && <Button onClick={() => setManageOpen(true)}>Manage standard instructions</Button>}
      </div>

      <Textarea rows={3} value={wizard.specialTerms} onChange={(e) => setWizard((w) => ({ ...w, specialTerms: e.target.value }))} style={{ marginBottom: 20, width: "100%" }} />
      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <Button variant="primary" onClick={onContinue}>Continue</Button>
      </div>

      {manageOpen && (
        <StandardInstructionsModal
          instructions={standardInstructions || []}
          onClose={() => setManageOpen(false)}
          onChanged={onStandardInstructionsChanged}
        />
      )}
    </Card>
  );
}

// ---------------------------------------------------------------------
// Step 4 — Generate
// ---------------------------------------------------------------------

export function Step4Generate({ wizard, generating, generateError, generateSuccess, onGenerate }) {
  const changes = getCampmanagerChanges(wizard.unit, wizard.originalUnit);
  const wifiReminder = getWifiRegistrationReminder(wizard.selectedRow, wizard.price);
  if (wifiReminder) changes.push(wifiReminder);

  return (
    <Card pad="md">
      <CardTitle>Generate document</CardTitle>
      <Hint>Merges everything above into the Purchase &amp; Licence Agreement and saves it as a .docx.</Hint>

      {changes.length > 0 && (
        <div style={{ fontSize: "var(--text-sm)", padding: "8px 12px", background: colors.warnSurface, border: `1px solid ${colors.warnBorder}`, color: colors.warnInk, borderRadius: "var(--radius-sm)", marginBottom: 20 }}>
          Remember to update Campmanager too — this wizard doesn't write back to it:
          {changes.map((c, i) => <div key={i}>• {c}</div>)}
        </div>
      )}

      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <Button variant="primary" disabled={generating} onClick={onGenerate}>{generating ? "Generating…" : "Generate document"}</Button>
      </div>
      {generateError && <Alert tone="danger" title="Couldn't generate the document">{generateError}</Alert>}
      {generateSuccess && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 14px", background: colors.okSurface, border: `1px solid ${colors.okBorder}`, borderRadius: "var(--radius-sm)", color: colors.okInk, fontSize: "var(--text-sm)", marginTop: 10 }}>
          {generateSuccess} generated.
        </div>
      )}
    </Card>
  );
}
