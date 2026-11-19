import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../lib/AuthContext.jsx";
import { loadNewJobReferenceData } from "../../lib/newJobReferenceData.js";
import { createSale } from "../../lib/caravanSalesQuery.js";
import SearchPicker from "../../components/SearchPicker.jsx";
import { colors } from "../../lib/theme.js";
import { Alert, Button, Card, Field, Fieldset, Input, Select, Switch } from "../../ui/index.js";

// Office/admin key this in from the signed paper order form, after the
// sale's already agreed (the sales agreement is written out and handed
// to the customer at that point) -- so the full 3-step form up front is
// fine; there's no "bare-bones first, price later" mode to build.
const STEPS = ["Customer", "Caravan", "Details of sale"];

function ItemListEditor({ items, onChange, placeholder }) {
  function update(i, patch) {
    onChange(items.map((item, idx) => (idx === i ? { ...item, ...patch } : item)));
  }
  function remove(i) {
    onChange(items.filter((_, idx) => idx !== i));
  }
  return (
    <div>
      {items.map((item, i) => (
        <div key={i} style={{ display: "flex", gap: "var(--space-2)", marginBottom: "var(--space-2)" }}>
          <Input
            value={item.description}
            onChange={(e) => update(i, { description: e.target.value })}
            placeholder={placeholder}
            style={{ flex: 2 }}
          />
          <Input
            type="number"
            step="0.01"
            min="0"
            value={item.amount}
            onChange={(e) => update(i, { amount: e.target.value })}
            placeholder="0.00"
            style={{ flex: 1 }}
          />
          <Button type="button" onClick={() => remove(i)}>Remove</Button>
        </div>
      ))}
      <Button type="button" onClick={() => onChange([...items, { description: "", amount: "" }])}>+ Add item</Button>
    </div>
  );
}

export default function NewSale() {
  const { profile, org, activeSite, terminology } = useAuth();
  const navigate = useNavigate();

  const [pitches, setPitches] = useState([]);
  const [step, setStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);

  const [title, setTitle] = useState("");
  const [forename, setForename] = useState("");
  const [surname, setSurname] = useState("");
  const [addressLine1, setAddressLine1] = useState("");
  const [addressLine2, setAddressLine2] = useState("");
  const [postcode, setPostcode] = useState("");
  const [phone1, setPhone1] = useState("");
  const [phone2, setPhone2] = useState("");
  const [email1, setEmail1] = useState("");
  const [email2, setEmail2] = useState("");
  const [carRegistration, setCarRegistration] = useState("");

  const [caravanMake, setCaravanMake] = useState("");
  const [caravanModel, setCaravanModel] = useState("");
  const [caravanYear, setCaravanYear] = useState("");
  const [caravanCondition, setCaravanCondition] = useState("pre-owned");
  const [pitchId, setPitchId] = useState("");
  const [licenceTerm, setLicenceTerm] = useState("");
  const [handoverDate, setHandoverDate] = useState("");

  const [windowPrice, setWindowPrice] = useState("");
  const [ratesCurrentYear, setRatesCurrentYear] = useState("");
  const [pitchFeeAmount, setPitchFeeAmount] = useState("");
  const [pitchFeeIncluded, setPitchFeeIncluded] = useState(true);
  const [includedItems, setIncludedItems] = useState([]);
  const [additionalItems, setAdditionalItems] = useState([]);
  const [depositAmount, setDepositAmount] = useState("");
  const [depositDate, setDepositDate] = useState("");
  const [partExchangeAmount, setPartExchangeAmount] = useState("");
  const [partExchangeDate, setPartExchangeDate] = useState("");

  useEffect(() => {
    if (!org || !activeSite) return;
    let cancelled = false;
    loadNewJobReferenceData({ orgId: org.id, siteId: activeSite.id, roleId: profile.role_id }).then(({ data }) => {
      if (!cancelled && data) setPitches(data.pitches);
    });
    return () => {
      cancelled = true;
    };
  }, [org, activeSite]);

  function goToStep(next) {
    setSubmitError(null);
    setStep(next);
  }

  function handleContinueFromCustomer() {
    if (!forename.trim() || !surname.trim()) {
      setSubmitError("Add the customer's forename and surname before continuing.");
      return;
    }
    goToStep(1);
  }

  function cleanItems(items) {
    return items.filter((i) => i.description.trim() || i.amount).map((i) => ({ description: i.description.trim(), amount: parseFloat(i.amount) || 0 }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!forename.trim() || !surname.trim()) {
      setStep(0);
      setSubmitError("Add the customer's forename and surname before creating the sale.");
      return;
    }
    setSubmitting(true);
    setSubmitError(null);
    try {
      const sale = await createSale({
        org_id: org.id,
        site_id: activeSite.id,
        title: title.trim() || null,
        forename: forename.trim(),
        surname: surname.trim(),
        address_line1: addressLine1.trim() || null,
        address_line2: addressLine2.trim() || null,
        postcode: postcode.trim() || null,
        phone1: phone1.trim() || null,
        phone2: phone2.trim() || null,
        email1: email1.trim() || null,
        email2: email2.trim() || null,
        car_registration: carRegistration.trim() || null,
        caravan_make: caravanMake.trim() || null,
        caravan_model: caravanModel.trim() || null,
        caravan_year: caravanYear.trim() || null,
        caravan_condition: caravanCondition,
        pitch_id: pitchId || null,
        licence_term: licenceTerm.trim() || null,
        handover_date: handoverDate || null,
        window_price: parseFloat(windowPrice) || 0,
        rates_current_year: parseFloat(ratesCurrentYear) || 0,
        pitch_fee_amount: parseFloat(pitchFeeAmount) || 0,
        pitch_fee_included: pitchFeeIncluded,
        included_items: cleanItems(includedItems),
        additional_items: cleanItems(additionalItems),
        deposit_amount: parseFloat(depositAmount) || 0,
        deposit_date: depositDate || null,
        part_exchange_amount: parseFloat(partExchangeAmount) || 0,
        part_exchange_date: partExchangeDate || null,
        created_by: profile.id,
      });
      navigate(`/office-hub/sales/${sale.id}`);
    } catch (err) {
      setSubmitError(err.message || "Failed to create the sale.");
    } finally {
      setSubmitting(false);
    }
  }

  if (!org || !activeSite) return null;

  return (
    <div style={{ maxWidth: "var(--width-lg)" }}>
      <p style={{ color: colors.inkSoft, fontSize: "var(--text-sm)", marginBottom: "var(--space-3)" }}>
        Key this in from the signed paper order form.
      </p>
      <Card as="form" onSubmit={handleSubmit} pad="lg">
        <div style={{ display: "flex", gap: "var(--space-1)", marginBottom: "var(--space-2)" }}>
          {STEPS.map((label, i) => (
            <div key={label} style={{ flex: 1, height: "4px", borderRadius: "var(--radius-full)", background: i <= step ? colors.moss : colors.line }} />
          ))}
        </div>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            fontSize: "var(--text-xs)",
            fontFamily: "var(--font-mono)",
            textTransform: "uppercase",
            letterSpacing: "var(--tracking-label)",
            color: colors.inkSoft,
            marginBottom: "var(--space-5)",
          }}
        >
          {STEPS.map((label, i) => (
            <span key={label} style={i === step ? { color: colors.moss, fontWeight: 600 } : undefined}>
              {i + 1}. {label}
            </span>
          ))}
        </div>

        <Fieldset>
          {step === 0 && (
            <>
              <Field label="Title">{({ id }) => <Input id={id} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Mr / Mrs / Dr" />}</Field>
              <Field label="Forename" required>{({ id }) => <Input id={id} required value={forename} onChange={(e) => setForename(e.target.value)} />}</Field>
              <Field label="Surname" required>{({ id }) => <Input id={id} required value={surname} onChange={(e) => setSurname(e.target.value)} />}</Field>
              <Field label="Address line 1">{({ id }) => <Input id={id} value={addressLine1} onChange={(e) => setAddressLine1(e.target.value)} />}</Field>
              <Field label="Address line 2">{({ id }) => <Input id={id} value={addressLine2} onChange={(e) => setAddressLine2(e.target.value)} />}</Field>
              <Field label="Post code">{({ id }) => <Input id={id} value={postcode} onChange={(e) => setPostcode(e.target.value)} />}</Field>
              <Field label="Phone 1">{({ id }) => <Input id={id} value={phone1} onChange={(e) => setPhone1(e.target.value)} />}</Field>
              <Field label="Phone 2">{({ id }) => <Input id={id} value={phone2} onChange={(e) => setPhone2(e.target.value)} />}</Field>
              <Field label="Email 1">{({ id }) => <Input id={id} type="email" value={email1} onChange={(e) => setEmail1(e.target.value)} />}</Field>
              <Field label="Email 2">{({ id }) => <Input id={id} type="email" value={email2} onChange={(e) => setEmail2(e.target.value)} />}</Field>
              <Field label="Car registration">{({ id }) => <Input id={id} value={carRegistration} onChange={(e) => setCarRegistration(e.target.value)} />}</Field>
            </>
          )}

          {step === 1 && (
            <>
              <Field label="Make">{({ id }) => <Input id={id} value={caravanMake} onChange={(e) => setCaravanMake(e.target.value)} />}</Field>
              <Field label="Model">{({ id }) => <Input id={id} value={caravanModel} onChange={(e) => setCaravanModel(e.target.value)} />}</Field>
              <Field label="Year">{({ id }) => <Input id={id} value={caravanYear} onChange={(e) => setCaravanYear(e.target.value)} />}</Field>
              <Field label="Condition">
                {({ id }) => (
                  <Select id={id} value={caravanCondition} onChange={(e) => setCaravanCondition(e.target.value)}>
                    <option value="new">New</option>
                    <option value="pre-owned">Pre-owned</option>
                  </Select>
                )}
              </Field>
              <Field label={terminology.pitch || "Pitch"} hint="Picked from the existing pitches list, not typed.">
                <SearchPicker
                  items={pitches}
                  getLabel={(p) => p.pitch_number_or_name}
                  value={pitchId}
                  onChange={setPitchId}
                  placeholder={`Type to search ${(terminology.pitch || "pitch").toLowerCase()}es…`}
                  ariaLabel={terminology.pitch || "Pitch"}
                />
              </Field>
              <Field label="Licence term">{({ id }) => <Input id={id} value={licenceTerm} onChange={(e) => setLicenceTerm(e.target.value)} placeholder="e.g. Mar 2026 – Feb 2051" />}</Field>
              <Field label="Handover date">{({ id }) => <Input id={id} type="date" value={handoverDate} onChange={(e) => setHandoverDate(e.target.value)} />}</Field>
            </>
          )}

          {step === 2 && (
            <>
              <p style={{ color: colors.inkSoft, fontSize: "var(--text-sm)", marginTop: 0 }}>
                Shaped the same way as the License Agreement tool's own price breakdown, so it can feed straight across later.
              </p>
              <Field label="Window price (agreed price)">{({ id }) => <Input id={id} type="number" step="0.01" min="0" value={windowPrice} onChange={(e) => setWindowPrice(e.target.value)} />}</Field>
              <Field label="Rates (current year)">{({ id }) => <Input id={id} type="number" step="0.01" min="0" value={ratesCurrentYear} onChange={(e) => setRatesCurrentYear(e.target.value)} />}</Field>
              <Field label="Pitch fee">{({ id }) => <Input id={id} type="number" step="0.01" min="0" value={pitchFeeAmount} onChange={(e) => setPitchFeeAmount(e.target.value)} />}</Field>
              <Switch checked={pitchFeeIncluded} onChange={setPitchFeeIncluded} label="Pitch fee included in window price" />

              <Field label="Items included in the window price" hint="e.g. Insurance, WiFi install — subtracted from the window price above, not added.">
                <ItemListEditor items={includedItems} onChange={setIncludedItems} placeholder="e.g. Insurance (first year)" />
              </Field>
              <Field label="Charged on top of the window price" hint="e.g. Delivery">
                <ItemListEditor items={additionalItems} onChange={setAdditionalItems} placeholder="e.g. Delivery" />
              </Field>

              <Field label="Deposit">{({ id }) => <Input id={id} type="number" step="0.01" min="0" value={depositAmount} onChange={(e) => setDepositAmount(e.target.value)} />}</Field>
              <Field label="Deposit date">{({ id }) => <Input id={id} type="date" value={depositDate} onChange={(e) => setDepositDate(e.target.value)} />}</Field>
              <Field label="Part-exchange allowance">{({ id }) => <Input id={id} type="number" step="0.01" min="0" value={partExchangeAmount} onChange={(e) => setPartExchangeAmount(e.target.value)} />}</Field>
              <Field label="Part-exchange date">{({ id }) => <Input id={id} type="date" value={partExchangeDate} onChange={(e) => setPartExchangeDate(e.target.value)} />}</Field>

              {submitError && <Alert tone="danger" title="Could not create the sale">{submitError}</Alert>}
            </>
          )}

          {submitError && step !== 2 && (
            <Alert tone="danger" title="Couldn't continue">{submitError}</Alert>
          )}

          <div
            style={{
              display: "flex",
              gap: "var(--space-3)",
              justifyContent: "flex-end",
              position: "sticky",
              bottom: 0,
              background: colors.paper,
              paddingTop: "var(--space-4)",
              borderTop: `1px solid ${colors.line}`,
            }}
          >
            <Button type="button" variant="ghost" onClick={() => navigate("/office-hub?tab=sales")}>Cancel</Button>
            {step > 0 && <Button type="button" onClick={() => goToStep(step - 1)}>Back</Button>}
            {step < 2 && (
              <Button type="button" variant="primary" onClick={step === 0 ? handleContinueFromCustomer : () => goToStep(2)} style={{ marginLeft: "auto" }}>
                Continue
              </Button>
            )}
            {step === 2 && (
              <Button type="submit" variant="primary" loading={submitting} style={{ flex: 1 }}>
                {submitting ? "Saving…" : "Create sale"}
              </Button>
            )}
          </div>
        </Fieldset>
      </Card>
    </div>
  );
}
