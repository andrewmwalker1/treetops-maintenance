import { caravanAmount, grandTotal, balanceDue, formatMoney } from "./CaravanSalePriceBreakdown.jsx";

const printSectionHeading = { fontFamily: "'Lora', serif", fontSize: "15px", margin: "18px 0 6px", borderBottom: "1px solid #999", paddingBottom: "4px" };

function PrintRow({ label, value }) {
  return (
    <tr>
      <td style={{ padding: "4px 12px 4px 0", fontWeight: 600, verticalAlign: "top", whiteSpace: "nowrap" }}>{label}</td>
      <td style={{ padding: "4px 0" }}>{value}</td>
    </tr>
  );
}

function PriceRow({ label, amount, bold }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", padding: "3px 0", fontWeight: bold ? 700 : 400, borderTop: bold ? "2px solid #000" : "none", marginTop: bold ? "6px" : 0, paddingTop: bold ? "6px" : "3px" }}>
      <span>{label}</span>
      <span>{formatMoney(amount)}</span>
    </div>
  );
}

function SignOffField({ label }) {
  return (
    <td style={{ width: "50%", padding: "22px 16px 6px 0", verticalAlign: "bottom" }}>
      <div style={{ borderBottom: "1px solid #000", height: "26px" }} />
      <div style={{ fontSize: "11px", color: "#444", marginTop: "2px" }}>{label}</div>
    </td>
  );
}

// The customer's own copy -- name, address, caravan, the price breakdown
// (now shaped the same way as the License Agreement tool's own, so it's
// legitimate to show it here), total, balance due, signature line.
// Nothing internal (no checklist state, no notes).
export default function PrintableSaleCustomerCopy({ sale }) {
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

  return (
    <div className="print-job-card" style={{ padding: "24px", fontFamily: "'Work Sans', sans-serif", color: "#000", fontSize: "13px" }}>
      <img src="/logo.png" alt="Tree Tops Caravan Park" style={{ width: "89px", height: "79px", marginBottom: "8px" }} />
      <h1 style={{ fontFamily: "'Lora', serif", fontSize: "20px", margin: "0 0 4px" }}>Order confirmation</h1>
      <p style={{ margin: "0 0 12px", color: "#444" }}>{new Date(sale.created_at).toLocaleDateString("en-GB")}</p>

      <table style={{ borderCollapse: "collapse", marginBottom: "12px" }}>
        <tbody>
          <PrintRow label="Customer" value={customerName} />
          <PrintRow label="Address" value={[sale.address_line1, sale.address_line2, sale.postcode].filter(Boolean).join(", ")} />
          <PrintRow label="Phone" value={[sale.phone1, sale.phone2].filter(Boolean).join(" / ") || "—"} />
          <PrintRow label="Email" value={[sale.email1, sale.email2].filter(Boolean).join(" / ") || "—"} />
          <PrintRow label="Caravan" value={[sale.caravan_make, sale.caravan_model, sale.caravan_year].filter(Boolean).join(" ")} />
          <PrintRow label="Pitch" value={sale.pitch?.pitch_number_or_name || "—"} />
          <PrintRow label="Handover date" value={sale.handover_date || "—"} />
        </tbody>
      </table>

      <h2 style={printSectionHeading}>Details of sale</h2>
      {bundled.map(([label, amount]) => (
        <PriceRow key={label} label={label} amount={amount} />
      ))}
      {onTop.length > 0 && (
        <>
          <p style={{ fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.04em", color: "#666", margin: "10px 0 4px" }}>Charged on top of the window price</p>
          {onTop.map(([label, amount]) => (
            <PriceRow key={label} label={label} amount={amount} />
          ))}
        </>
      )}
      <PriceRow label="Total" amount={grandTotal(sale)} bold />
      <PriceRow label={`Deposit${sale.deposit_date ? ` (${sale.deposit_date})` : ""}`} amount={Number(sale.deposit_amount) || 0} />
      <PriceRow label={`Part-exchange${sale.part_exchange_date ? ` (${sale.part_exchange_date})` : ""}`} amount={Number(sale.part_exchange_amount) || 0} />
      <PriceRow label="Balance due" amount={balanceDue(sale)} bold />

      <table style={{ width: "100%", marginTop: "28px" }}>
        <tbody>
          <tr>
            <SignOffField label="Customer signature" />
            <SignOffField label="Date" />
          </tr>
        </tbody>
      </table>
    </div>
  );
}
