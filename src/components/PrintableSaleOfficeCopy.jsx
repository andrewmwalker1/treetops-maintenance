import { caravanAmount, grandTotal, balanceDue, formatMoney } from "./CaravanSalePriceBreakdown.jsx";
import { isSaleOverdueWithoutCover } from "../lib/caravanSalesQuery.js";

const printSectionHeading = { fontFamily: "'Lora', serif", fontSize: "14px", margin: "16px 0 6px", borderBottom: "1px solid #999", paddingBottom: "4px" };

function PrintRow({ label, value }) {
  return (
    <tr>
      <td style={{ padding: "3px 12px 3px 0", fontWeight: 600, verticalAlign: "top", whiteSpace: "nowrap" }}>{label}</td>
      <td style={{ padding: "3px 0" }}>{value}</td>
    </tr>
  );
}

function PriceRow({ label, amount, bold }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", padding: "2px 0", fontWeight: bold ? 700 : 400, borderTop: bold ? "2px solid #000" : "none", marginTop: bold ? "5px" : 0, paddingTop: bold ? "5px" : "2px" }}>
      <span>{label}</span>
      <span>{formatMoney(amount)}</span>
    </div>
  );
}

function CheckLine({ label, checked, detail }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", padding: "2px 0", borderBottom: "1px dotted #ccc" }}>
      <span>
        <span style={{ display: "inline-block", width: "11px", height: "11px", border: "1px solid #000", marginRight: "6px", textAlign: "center", lineHeight: "11px", fontSize: "9px", verticalAlign: "middle" }}>
          {checked ? "X" : ""}
        </span>
        {label}
      </span>
      <span>{detail || ""}</span>
    </div>
  );
}

function SignOffField({ label }) {
  return (
    <td style={{ width: "50%", padding: "20px 16px 6px 0", verticalAlign: "bottom" }}>
      <div style={{ borderBottom: "1px solid #000", height: "22px" }} />
      <div style={{ fontSize: "10px", color: "#444", marginTop: "2px" }}>{label}</div>
    </td>
  );
}

// The office's own filing copy -- everything on the customer copy, plus
// every checklist item's state and dates, the overdue flag if it
// applies, and a blank quality-check sign-off line.
export default function PrintableSaleOfficeCopy({ sale }) {
  const bundled = [
    ["Caravan", caravanAmount(sale)],
    ...(sale.pitch_fee_included ? [["Pitch fee", Number(sale.pitch_fee_amount) || 0]] : []),
    ["Rates", Number(sale.rates_current_year) || 0],
    ...(sale.included_items || []).map((i) => [i.description || "(item)", Number(i.amount) || 0]),
  ];
  const onTop = [
    ...(!sale.pitch_fee_included ? [["Pitch fee", Number(sale.pitch_fee_amount) || 0]] : []),
    ...(sale.additional_items || []).map((i) => [i.description || "(item)", Number(i.amount) || 0]),
  ];
  const customerName = [sale.title, sale.forename, sale.surname].filter(Boolean).join(" ");
  const overdue = isSaleOverdueWithoutCover(sale);

  return (
    <div className="print-job-card" style={{ padding: "24px", fontFamily: "'Work Sans', sans-serif", color: "#000", fontSize: "12px" }}>
      <img src="/logo.png" alt="Tree Tops Caravan Park" style={{ width: "72px", height: "64px", marginBottom: "6px" }} />
      <h1 style={{ fontFamily: "'Lora', serif", fontSize: "16px", margin: "0 0 4px" }}>Office file copy</h1>
      <p style={{ margin: "0 0 10px", color: "#444" }}>Not for the customer &middot; {new Date(sale.created_at).toLocaleDateString("en-GB")}</p>

      {overdue && (
        <p style={{ fontWeight: 700, fontSize: "13px", border: "3px solid #000", padding: "6px 10px", margin: "0 0 10px" }}>
          &#9888; Past handover date and customer not yet on cover
        </p>
      )}

      <table style={{ borderCollapse: "collapse", marginBottom: "8px" }}>
        <tbody>
          <PrintRow label="Customer" value={customerName} />
          <PrintRow label="Address" value={[sale.address_line1, sale.address_line2, sale.postcode].filter(Boolean).join(", ")} />
          <PrintRow label="Phone / email" value={[[sale.phone1, sale.phone2].filter(Boolean).join(" / "), [sale.email1, sale.email2].filter(Boolean).join(" / ")].filter(Boolean).join(" · ")} />
          <PrintRow label="Car reg." value={sale.car_registration || "—"} />
          <PrintRow label="Caravan" value={[sale.caravan_make, sale.caravan_model, sale.caravan_year, sale.caravan_condition].filter(Boolean).join(" ")} />
          <PrintRow label="Pitch" value={sale.pitch?.pitch_number_or_name || "—"} />
          <PrintRow label="Handover date" value={sale.handover_date || "—"} />
        </tbody>
      </table>

      <h2 style={printSectionHeading}>Jobs</h2>
      {(sale.jobs || []).length === 0 ? (
        <p style={{ margin: 0 }}>No linked jobs yet.</p>
      ) : (
        (sale.jobs || []).map((j) => (
          <CheckLine key={j.id} label={j.description} checked={Boolean(j.job_status?.is_completed)} detail={j.job_status?.name} />
        ))
      )}
      <CheckLine label="Meter reading -- gas" checked={Boolean(sale.meter_reading_gas)} detail={sale.meter_reading_gas} />
      <CheckLine label="Meter reading -- electric" checked={Boolean(sale.meter_reading_electric)} detail={sale.meter_reading_electric} />

      <h2 style={printSectionHeading}>Systems &amp; docs</h2>
      <CheckLine label="CampManager" checked={sale.campmanager_done} detail={sale.campmanager_date} />
      <CheckLine label="Compass" checked={sale.compass_done} />
      <CheckLine label="Purchase &amp; licence agreement -- created" checked={sale.agreement_created} />
      <CheckLine label="Purchase &amp; licence agreement -- signed &amp; filed" checked={sale.agreement_signed_filed} />

      <h2 style={printSectionHeading}>Insurance</h2>
      <CheckLine label="Insurance quote raised" checked={sale.insurance_quote_raised} />
      <CheckLine label="Insurance payment confirmed" checked={sale.insurance_payment_confirmed} />
      <CheckLine label="Customer on cover" checked={sale.customer_on_cover} />

      <h2 style={printSectionHeading}>Details of sale</h2>
      {bundled.map(([label, amount]) => (
        <PriceRow key={label} label={label} amount={amount} />
      ))}
      {onTop.length > 0 && (
        <>
          <p style={{ fontSize: "10px", textTransform: "uppercase", letterSpacing: "0.04em", color: "#666", margin: "8px 0 3px" }}>Charged on top of the window price</p>
          {onTop.map(([label, amount]) => (
            <PriceRow key={label} label={label} amount={amount} />
          ))}
        </>
      )}
      <PriceRow label="Total" amount={grandTotal(sale)} bold />
      <PriceRow label={`Deposit${sale.deposit_date ? ` (${sale.deposit_date})` : ""}`} amount={Number(sale.deposit_amount) || 0} />
      <PriceRow label={`Part-exchange${sale.part_exchange_date ? ` (${sale.part_exchange_date})` : ""}`} amount={Number(sale.part_exchange_amount) || 0} />
      <PriceRow label="Balance due" amount={balanceDue(sale)} bold />

      {sale.notes && (
        <>
          <h2 style={printSectionHeading}>Notes</h2>
          <p style={{ margin: 0 }}>{sale.notes}</p>
        </>
      )}

      <table style={{ width: "100%", marginTop: "24px" }}>
        <tbody>
          <tr>
            <SignOffField label="Quality check -- initials" />
            <SignOffField label="Date" />
          </tr>
        </tbody>
      </table>
    </div>
  );
}
