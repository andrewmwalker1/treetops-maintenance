import { useRef, useState } from "react";
import Papa from "papaparse";
import { colors } from "../../lib/theme.js";
import { Alert, Button, Card, Input, PageHeader, Select, Textarea } from "../../ui/index.js";
import {
  computeCaravanAmount, computeMonthsToCharge, computePitchFeeProrataAmount, deriveSeasonLengthForPitch,
  derivePeopleFromRow, formatCurrency, getCampmanagerChanges, getWifiRegistrationReminder, inputValueToDate,
  lookupPitchFeeFullYear, parseAmount, personFullName, sumItems, ukDateToInputValue,
} from "./calculations.js";

const CUSTOMER_FIELD_MAP = {
  addressLine1: "Unit Customer Address Line 1",
  addressLine2: "Unit Customer Address Line 2",
  addressLine3: "Unit Customer Address Line 3",
  postcode: "Unit Customer Address Postcode",
  country: "Unit Customer Address Country",
  telephone: "Unit Customer Telephone",
  mobile: "Unit Customer Mobile",
  email: "Unit Customer Email",
};
const CUSTOMER_FIELD_LABELS = {
  addressLine1: "Address line 1", addressLine2: "Address line 2", addressLine3: "Address line 3",
  postcode: "Postcode", country: "Country", telephone: "Telephone", mobile: "Mobile", email: "Email",
};

function FieldLabel({ children }) {
  return <span style={{ fontSize: "var(--text-sm)", fontWeight: 600, color: colors.inkSoft, display: "block", marginBottom: "var(--space-1)" }}>{children}</span>;
}
function Hint({ children }) {
  return <p style={{ fontSize: "var(--text-xs)", color: colors.inkSoft, marginTop: 0 }}>{children}</p>;
}

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
    ratesFullYear: ratesFullYearDefault || "",
    ratesCurrentYear: "",
    ratesPaymentYear: new Date().getFullYear(),
    deposit: { amount: "", date: "" },
    partExchange: { amount: "", date: "" },
    balanceDate: "",
    completionType: "fixed",
    completionDate: "",
  };
}

export function Step1Import({ wizard, setWizard, areaSeasonMap, ratesFullYearDefault, onContinue }) {
  const fileInputRef = useRef(null);
  const [csvError, setCsvError] = useState("");
  const [rows, setRows] = useState(wizard.selectedRow ? null : []);
  const [fileName, setFileName] = useState("");

  function selectRow(row) {
    const sale = newSaleFromRow(row, areaSeasonMap);
    setWizard((w) => ({
      ...w,
      ...sale,
      price: newPriceForSale(sale.unit, sale.seasonLength, ratesFullYearDefault, row),
    }));
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
        setFileName(file.name);
        if (parsed.length === 1) {
          selectRow(parsed[0]);
        } else {
          setRows(parsed);
        }
      },
      error(err) {
        setCsvError("Couldn't read that file: " + err.message);
      },
    });
  }

  const hasName = wizard.people.some((p) => p.firstName || p.lastName);

  return (
    <div>
      <Card pad="md" style={{ marginBottom: "var(--space-4)" }}>
        <PageHeader title="Import sale CSV" level={2} />
        <Hint>The Campmanager unit export (e.g. "Holiday Homes.csv"). If it contains more than one unit, you'll be asked which one to use.</Hint>
        <input ref={fileInputRef} type="file" accept=".csv,text/csv" onChange={(e) => e.target.files[0] && handleFile(e.target.files[0])} />
        {fileName && !rows && wizard.selectedRow && <p style={{ fontSize: "var(--text-sm)", color: colors.moss }}>{fileName} loaded</p>}
        {csvError && <Alert tone="danger" title="Something went wrong">{csvError}</Alert>}
      </Card>

      {rows && (
        <Card pad="md" style={{ marginBottom: "var(--space-4)" }}>
          <PageHeader title="Which unit is this sale for?" level={2} />
          <Hint>This file has more than one unit — pick the one being sold.</Hint>
          {rows.map((row, i) => (
            <Card key={i} pad="sm" interactive onClick={() => selectRow(row)} style={{ cursor: "pointer", marginBottom: "var(--space-2)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: "var(--space-3)", flexWrap: "wrap" }}>
                <strong>{row["Unit Site"]}</strong>
                <span>{[row["Unit Customer Title"], row["Unit Customer First Name"], row["Unit Customer Last Name"]].filter(Boolean).join(" ")}</span>
                <span>{[row["Unit Make"], row["Unit Model"]].filter(Boolean).join(" ")}</span>
                <span>{row["Unit Category"]}</span>
              </div>
            </Card>
          ))}
        </Card>
      )}

      {wizard.selectedRow && (
        <Card pad="md">
          <PageHeader title="Customer contact details" level={2} />
          <Hint>Pulled from the CSV for the selected unit. Check and correct anything before continuing — these feed the agreement's address block.</Hint>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: "var(--space-2)", marginBottom: "var(--space-4)" }}>
            {[
              ["Pitch", wizard.selectedRow["Unit Site"]],
              ["Caravan", [wizard.selectedRow["Unit Make"], wizard.selectedRow["Unit Model"]].filter(Boolean).join(" ")],
              ["Year", wizard.selectedRow["Unit Year"]],
              ["Size", wizard.selectedRow["Unit Length"] && wizard.selectedRow["Unit Width"] ? `${wizard.selectedRow["Unit Length"]} x ${wizard.selectedRow["Unit Width"]}` : ""],
              ["Serial number", wizard.selectedRow["Unit Serial Number"]],
            ].map(([label, value]) => (
              <div key={label}>
                <FieldLabel>{label}</FieldLabel>
                <span>{value || "—"}</span>
              </div>
            ))}
          </div>

          <div style={{ marginBottom: "var(--space-4)" }}>
            <FieldLabel>Build specification</FieldLabel>
            <div style={{ display: "flex", gap: "var(--space-4)" }}>
              {["EN 1647", "BS 3632"].map((v) => (
                <label key={v} style={{ display: "flex", alignItems: "center", gap: "var(--space-1)" }}>
                  <input type="radio" checked={wizard.buildSpec === v} onChange={() => setWizard((w) => ({ ...w, buildSpec: v }))} /> {v}
                </label>
              ))}
            </div>
          </div>

          <div style={{ marginBottom: "var(--space-4)" }}>
            <FieldLabel>Will you be the first owner of your Holiday Caravan?</FieldLabel>
            <div style={{ display: "flex", gap: "var(--space-4)" }}>
              {[["yes", "Yes"], ["no", "No"]].map(([v, label]) => (
                <label key={v} style={{ display: "flex", alignItems: "center", gap: "var(--space-1)" }}>
                  <input type="radio" checked={wizard.firstOwner === v} onChange={() => setWizard((w) => ({ ...w, firstOwner: v }))} /> {label}
                </label>
              ))}
            </div>
          </div>

          <PageHeader title="Who owns this caravan" level={2} />
          <Hint>Campmanager stores joint owners squashed together (e.g. Title "Mr &amp; Mrs", First name "Jane &amp; Mark") — split out here so each person's name is correct on the signature page. Add or remove people as needed.</Hint>

          {wizard.peopleAutoSwapped && (
            <Alert tone="warn" title="Titles auto-swapped">
              Titles didn't match the usual gender for these first names, so they've been auto-swapped. This is a guess, not a guarantee — please check it's right.
            </Alert>
          )}

          {wizard.people.map((person, i) => (
            <div key={i} style={{ display: "flex", gap: "var(--space-2)", marginBottom: "var(--space-2)", alignItems: "flex-end", flexWrap: "wrap" }}>
              <div>
                <FieldLabel>Title</FieldLabel>
                <Input
                  list="license-agreement-title-suggestions"
                  value={person.title}
                  onChange={(e) => {
                    const people = wizard.people.map((p, idx) => (idx === i ? { ...p, title: e.target.value } : p));
                    setWizard((w) => ({ ...w, people, peopleAutoSwapped: false }));
                  }}
                  style={{ width: 100 }}
                />
              </div>
              <div>
                <FieldLabel>First name</FieldLabel>
                <Input
                  value={person.firstName}
                  onChange={(e) => {
                    const people = wizard.people.map((p, idx) => (idx === i ? { ...p, firstName: e.target.value } : p));
                    setWizard((w) => ({ ...w, people }));
                  }}
                />
              </div>
              <div>
                <FieldLabel>Last name</FieldLabel>
                <Input
                  value={person.lastName}
                  onChange={(e) => {
                    const people = wizard.people.map((p, idx) => (idx === i ? { ...p, lastName: e.target.value } : p));
                    setWizard((w) => ({ ...w, people }));
                  }}
                />
              </div>
              <Button
                variant="danger"
                disabled={wizard.people.length <= 1}
                onClick={() => setWizard((w) => ({ ...w, people: w.people.filter((_, idx) => idx !== i) }))}
                title="Remove this person"
              >
                Remove
              </Button>
            </div>
          ))}
          <datalist id="license-agreement-title-suggestions">
            {["Mr", "Mrs", "Miss", "Ms", "Mx", "Dr"].map((t) => <option key={t} value={t} />)}
          </datalist>

          {wizard.people.length === 2 && (
            <Button
              onClick={() => {
                const [a, b] = wizard.people;
                setWizard((w) => ({ ...w, people: [{ ...a, title: b.title }, { ...b, title: a.title }], peopleAutoSwapped: false }));
              }}
              style={{ marginBottom: "var(--space-3)" }}
            >
              ⇅ Swap titles between the two people
            </Button>
          )}
          <div style={{ marginBottom: "var(--space-4)" }}>
            <Button onClick={() => setWizard((w) => ({ ...w, people: [...w.people, { title: "", firstName: "", lastName: w.people[w.people.length - 1]?.lastName || "" }] }))}>
              + Add person
            </Button>
          </div>

          <PageHeader title="Contact details" level={2} />
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "var(--space-2)", marginBottom: "var(--space-4)" }}>
            {Object.keys(CUSTOMER_FIELD_MAP).map((key) => (
              <div key={key}>
                <FieldLabel>{CUSTOMER_FIELD_LABELS[key]}</FieldLabel>
                <Input
                  value={wizard.customer[key] || ""}
                  onChange={(e) => setWizard((w) => ({ ...w, customer: { ...w.customer, [key]: e.target.value } }))}
                />
              </div>
            ))}
          </div>

          <Button variant="primary" disabled={!hasName} onClick={onContinue}>Continue</Button>
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
        <div key={i} style={{ display: "flex", gap: "var(--space-2)", marginBottom: "var(--space-2)" }}>
          <Input
            style={{ flex: 2 }}
            placeholder={placeholder}
            value={item.description}
            onChange={(e) => onChange(items.map((it, idx) => (idx === i ? { ...it, description: e.target.value } : it)))}
          />
          <Input
            type="number" step="0.01" min="0" placeholder="0.00" style={{ flex: 1 }}
            value={item.amount}
            onChange={(e) => onChange(items.map((it, idx) => (idx === i ? { ...it, amount: e.target.value } : it)))}
          />
          <Button variant="danger" onClick={() => onChange(items.filter((_, idx) => idx !== i))}>✕</Button>
        </div>
      ))}
    </div>
  );
}

export function Step2Price({ wizard, setWizard, pitchBandsTable, onContinue }) {
  const { price, unit, seasonLength } = wizard;
  const patchPrice = (patch) => setWizard((w) => ({ ...w, price: { ...w.price, ...patch } }));

  const fullYear = lookupPitchFeeFullYear(unit.pitchBand, pitchBandsTable);
  const pitchFeeAmount = computePitchFeeProrataAmount(unit, seasonLength, price.pitchFeeMonths, pitchBandsTable);
  const caravanAmount = computeCaravanAmount(price, unit, seasonLength, pitchBandsTable);
  const windowPrice = parseAmount(price.windowPrice);
  const additionalTotal = sumItems(price.additionalItems);
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
      <PageHeader title="Price breakdown" level={2} />
      <Hint>Line items for the purchase price, plus payment and completion. Totals update as you add items.</Hint>

      <PageHeader title="Pitch band &amp; licence dates" level={2} />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "var(--space-2)", marginBottom: "var(--space-4)" }}>
        <div>
          <FieldLabel>Pitch band</FieldLabel>
          <Select value={unit.pitchBand} onChange={(e) => setWizard((w) => ({ ...w, unit: { ...w.unit, pitchBand: e.target.value } }))}>
            {bandOptions.length === 0 && <option value="">Import the Pitch Fees table in Admin settings</option>}
            {bandOptions.map((b) => <option key={b} value={b}>{b}</option>)}
          </Select>
        </div>
        <div>
          <FieldLabel>Pitch fee (full year, inc VAT)</FieldLabel>
          <Input readOnly value={pitchBandsTable.length === 0 ? "Import the Pitch Fees table above" : fullYear === null ? "No match for this pitch band" : formatCurrency(fullYear)} />
        </div>
        <div>
          <FieldLabel>Licence start date</FieldLabel>
          <Input type="date" value={unit.licenceStart} onChange={(e) => setLicenceDate("licenceStart", e.target.value)} />
        </div>
        <div>
          <FieldLabel>Licence end date</FieldLabel>
          <Input type="date" value={unit.licenceEnd} onChange={(e) => setLicenceDate("licenceEnd", e.target.value)} />
        </div>
        <div>
          <FieldLabel>Pitch fee season length</FieldLabel>
          <div style={{ display: "flex", gap: "var(--space-3)" }}>
            {[9, 10.5].map((len) => (
              <label key={len} style={{ display: "flex", alignItems: "center", gap: "var(--space-1)" }}>
                <input type="radio" checked={seasonLength === len} onChange={() => setSeasonLength(len)} /> {len} months
              </label>
            ))}
          </div>
        </div>
      </div>

      <PageHeader title="Items included in the window price" level={2} />
      <div style={{ maxWidth: 220, marginBottom: "var(--space-3)" }}>
        <FieldLabel>Window price</FieldLabel>
        <Input type="number" step="0.01" min="0" placeholder="0.00" value={price.windowPrice} onChange={(e) => patchPrice({ windowPrice: e.target.value })} />
      </div>
      {wifiAlreadyInstalled && <Alert tone="info" title="Wifi Already Installed" />}
      <Hint>The all-in advertised price. The caravan's own value below is whatever's left after the other included items — it isn't entered directly.</Hint>

      <div style={{ display: "flex", gap: "var(--space-2)", marginBottom: "var(--space-2)" }}>
        <Input style={{ flex: 2 }} value={price.caravanDescription} onChange={(e) => patchPrice({ caravanDescription: e.target.value })} />
        <Input style={{ flex: 1 }} readOnly value={formatCurrency(caravanAmount)} />
      </div>
      {caravanAmount < 0 && (
        <Alert tone="danger" title="Check the figures">
          {windowPrice
            ? `The pitch fee, rates and other included items come to more than the window price (by ${formatCurrency(-caravanAmount)}).`
            : "Enter the window price above before adding included items."}
        </Alert>
      )}

      <div style={{ display: "flex", gap: "var(--space-2)", marginBottom: "var(--space-1)" }}>
        <Input style={{ flex: 2 }} readOnly value="Pitch Fees (pro-rata)" />
        <Input style={{ flex: 1 }} readOnly value={formatCurrency(pitchFeeAmount)} />
      </div>
      <div style={{ maxWidth: 260, marginBottom: "var(--space-1)" }}>
        <FieldLabel>{`Months to charge (of ${seasonLength})`}</FieldLabel>
        <Input
          type="number" step="0.1" min="0"
          value={price.pitchFeeMonths}
          onChange={(e) => patchPrice({ pitchFeeMonths: e.target.value, pitchFeeMonthsManuallySet: true })}
        />
      </div>
      <Hint>{fullYear === null
        ? (pitchBandsTable.length ? "No matching pitch band found in the Pitch Fees table — check the pitch band above." : "Import the Pitch Fees table in Admin settings to calculate this automatically.")
        : `${formatCurrency(fullYear)} full year ÷ ${seasonLength} months × ${price.pitchFeeMonths} months to charge.`}</Hint>

      <div style={{ display: "flex", gap: "var(--space-2)", marginBottom: "var(--space-2)" }}>
        <Input style={{ flex: 2 }} readOnly value="Rates" />
        <Input style={{ flex: 1 }} type="number" step="0.01" min="0" placeholder="0.00" value={price.ratesCurrentYear} onChange={(e) => patchPrice({ ratesCurrentYear: e.target.value })} />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "var(--space-2)", marginBottom: "var(--space-2)" }}>
        <div>
          <FieldLabel>Rates (full year)</FieldLabel>
          <Input type="number" step="0.01" min="0" placeholder="0.00" value={price.ratesFullYear} onChange={(e) => patchPrice({ ratesFullYear: e.target.value })} />
        </div>
        <div>
          <FieldLabel>Rates payment date this year (01 Jul)</FieldLabel>
          <Input type="number" min="2000" max="2100" step="1" value={price.ratesPaymentYear} onChange={(e) => patchPrice({ ratesPaymentYear: e.target.value })} />
        </div>
      </div>
      <Hint>Rates aren't banded like the Pitch Fee, and there's no formula — enter the current full-year figure (saved as next sale's default) and whatever's being charged for this one.</Hint>

      <LineItemsEditor items={price.includedItems} placeholder="e.g. Insurance, Wifi Install" onChange={(items) => patchPrice({ includedItems: items })} />
      <Button onClick={() => patchPrice({ includedItems: [...price.includedItems, { description: "", amount: "" }] })}>+ Add item</Button>
      <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 700, margin: "var(--space-3) 0 var(--space-4)" }}>
        <span>Agreed purchase price (window price)</span>
        <span>{formatCurrency(windowPrice)}</span>
      </div>

      <PageHeader title="Additional costs" level={2} />
      <Hint>Anything charged on top of the window price — delivery, siting, connection fees, extras.</Hint>
      <LineItemsEditor items={price.additionalItems} placeholder="e.g. Delivery" onChange={(items) => patchPrice({ additionalItems: items })} />
      <Button onClick={() => patchPrice({ additionalItems: [...price.additionalItems, { description: "", amount: "" }] })}>+ Add cost</Button>
      <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 700, margin: "var(--space-3) 0 var(--space-4)" }}>
        <span>Agreed total purchase price (including additional costs)</span>
        <span>{formatCurrency(grandTotal)}</span>
      </div>

      <PageHeader title="Payment" level={2} />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "var(--space-2)", marginBottom: "var(--space-4)" }}>
        <div><FieldLabel>Deposit paid</FieldLabel><Input type="number" step="0.01" min="0" placeholder="0.00" value={price.deposit.amount} onChange={(e) => patchPrice({ deposit: { ...price.deposit, amount: e.target.value } })} /></div>
        <div><FieldLabel>Deposit date</FieldLabel><Input type="date" value={price.deposit.date} onChange={(e) => patchPrice({ deposit: { ...price.deposit, date: e.target.value } })} /></div>
        <div><FieldLabel>Allowance for part-exchange</FieldLabel><Input type="number" step="0.01" min="0" placeholder="0.00" value={price.partExchange.amount} onChange={(e) => patchPrice({ partExchange: { ...price.partExchange, amount: e.target.value } })} /></div>
        <div><FieldLabel>Part-exchange date</FieldLabel><Input type="date" value={price.partExchange.date} onChange={(e) => patchPrice({ partExchange: { ...price.partExchange, date: e.target.value } })} /></div>
        <div>
          <FieldLabel>Balance</FieldLabel>
          <Input readOnly value={formatCurrency(Math.max(balance, 0)) + (balance < 0 ? " (deposit + part-exchange exceed the total)" : "")} />
        </div>
        <div><FieldLabel>Balance date</FieldLabel><Input type="date" value={price.balanceDate} onChange={(e) => patchPrice({ balanceDate: e.target.value })} /></div>
      </div>

      <PageHeader title="Completion" level={2} />
      <div style={{ display: "flex", gap: "var(--space-4)", marginBottom: "var(--space-2)" }}>
        {[["fixed", "Fixed completion date"], ["estimated", "Estimated completion date"]].map(([v, label]) => (
          <label key={v} style={{ display: "flex", alignItems: "center", gap: "var(--space-1)" }}>
            <input type="radio" checked={price.completionType === v} onChange={() => patchPrice({ completionType: v })} /> {label}
          </label>
        ))}
      </div>
      <div style={{ maxWidth: 220, marginBottom: "var(--space-4)" }}>
        <FieldLabel>{price.completionType === "estimated" ? "Estimated completion date" : "Completion date"}</FieldLabel>
        <Input type="date" value={price.completionDate} onChange={(e) => patchPrice({ completionDate: e.target.value })} />
      </div>

      <Button variant="primary" onClick={onContinue}>Continue</Button>
    </Card>
  );
}

// ---------------------------------------------------------------------
// Step 3 — Special instructions
// ---------------------------------------------------------------------

export function Step3Instructions({ wizard, setWizard, onContinue }) {
  return (
    <Card pad="md">
      <PageHeader title="Special instructions" level={2} />
      <Hint>Any special or extra terms which change or add to the standard terms in the Purchase Agreement. Leave as "None" if there aren't any.</Hint>
      <Textarea rows={3} value={wizard.specialTerms} onChange={(e) => setWizard((w) => ({ ...w, specialTerms: e.target.value }))} style={{ marginBottom: "var(--space-4)", width: "100%" }} />
      <Button variant="primary" onClick={onContinue}>Continue</Button>
    </Card>
  );
}

// ---------------------------------------------------------------------
// Step 4 — Signees
// ---------------------------------------------------------------------

export function Step4Signees({ wizard, onContinue }) {
  return (
    <Card pad="md">
      <PageHeader title="Signees" level={2} />
      <Hint>These are the people who'll sign the agreement, from "Who owns this caravan" on the first step. Go back there to add, remove or correct anyone — this is just a final check.</Hint>
      {wizard.people.map((person, i) => {
        const name = personFullName(person);
        return (
          <div key={i} style={{ display: "flex", gap: "var(--space-2)", alignItems: "center", marginBottom: "var(--space-2)" }}>
            <span style={{ fontWeight: 700 }}>{i + 1}</span>
            <span style={{ color: name ? colors.ink : colors.inkSoft, fontStyle: name ? "normal" : "italic" }}>{name || "No name entered"}</span>
          </div>
        );
      })}
      {wizard.people.length > 4 && (
        <Alert tone="warn" title="More than 4 signees">
          The agreement's signature block supports up to 4 signees — there are {wizard.people.length} here. Go back to "Who owns this caravan" to remove someone, or check the document can be extended further.
        </Alert>
      )}
      <Button variant="primary" onClick={onContinue} style={{ marginTop: "var(--space-3)" }}>Continue</Button>
    </Card>
  );
}

// ---------------------------------------------------------------------
// Step 5 — Generate
// ---------------------------------------------------------------------

export function Step5Generate({ wizard, generating, generateError, generateSuccess, onGenerate }) {
  const changes = getCampmanagerChanges(wizard.unit, wizard.originalUnit);
  const wifiReminder = getWifiRegistrationReminder(wizard.selectedRow, wizard.price);
  if (wifiReminder) changes.push(wifiReminder);

  return (
    <Card pad="md">
      <PageHeader title="Generate document" level={2} />
      <Hint>Merges everything above into the Purchase &amp; Licence Agreement and saves it as a .docx.</Hint>

      {changes.length > 0 && (
        <Alert tone="info" title="Remember to update Campmanager too — this wizard doesn't write back to it">
          {changes.map((c, i) => <div key={i}>• {c}</div>)}
        </Alert>
      )}

      <Button variant="primary" disabled={generating} onClick={onGenerate}>{generating ? "Generating…" : "Generate document"}</Button>
      {generateError && <Alert tone="danger" title="Couldn't generate the document">{generateError}</Alert>}
      {generateSuccess && <Alert tone="ok" title="Done">{generateSuccess} generated.</Alert>}
    </Card>
  );
}
