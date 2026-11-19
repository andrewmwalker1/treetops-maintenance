import { colors } from "../lib/theme.js";

// Mirrors license-agreement/calculations.js's own shape: window price is
// the one headline agreed figure; pitch fee / rates / included items net
// INTO it (itemised for transparency, not added on top); additional
// items are the only things actually added on top; deposit and
// part-exchange are payments against the total (reduce the balance due),
// not price-reducing line items. This feature's own pitch fee is a flat
// amount + an included/on-top toggle -- no pro-rata or season-length
// lookup, unlike the License Agreement tool's fuller model.
export function sumItems(items) {
  return (items || []).reduce((total, item) => total + (parseFloat(item.amount) || 0), 0);
}

export function caravanAmount(sale) {
  const pitchFee = sale.pitch_fee_included ? Number(sale.pitch_fee_amount) || 0 : 0;
  return (Number(sale.window_price) || 0) - pitchFee - (Number(sale.rates_current_year) || 0) - sumItems(sale.included_items);
}

export function grandTotal(sale) {
  const pitchFeeOnTop = sale.pitch_fee_included ? 0 : Number(sale.pitch_fee_amount) || 0;
  return (Number(sale.window_price) || 0) + sumItems(sale.additional_items) + pitchFeeOnTop;
}

export function balanceDue(sale) {
  return grandTotal(sale) - (Number(sale.deposit_amount) || 0) - (Number(sale.part_exchange_amount) || 0);
}

export function formatMoney(n) {
  const sign = n < 0 ? "−" : "";
  return sign + "£" + Math.abs(n).toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

const rowStyle = { display: "flex", justifyContent: "space-between", padding: "4px 0", fontSize: "var(--text-sm)" };
const totalStyle = { ...rowStyle, borderTop: `2px solid ${colors.moss}`, marginTop: "var(--space-2)", paddingTop: "var(--space-2)", fontWeight: 700, fontSize: "var(--text-base)" };
const sectionLabelStyle = { fontSize: "var(--text-xs)", textTransform: "uppercase", letterSpacing: "var(--tracking-label)", color: colors.inkSoft, margin: "var(--space-3) 0 var(--space-1)" };

// Read-only breakdown, used on the sale detail page. The two printable
// components re-derive the same figures from the calc functions above
// rather than rendering this component, since print output can't use
// tokens/CSS classes (see PrintableSaleCustomerCopy.jsx/PrintableSaleOfficeCopy.jsx).
export default function CaravanSalePriceBreakdown({ sale }) {
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

  return (
    <div>
      {bundled.map(([label, amount]) => (
        <div key={label} style={rowStyle}>
          <span>{label}</span>
          <span>{formatMoney(amount)}</span>
        </div>
      ))}
      {onTop.length > 0 && (
        <>
          <p style={sectionLabelStyle}>Charged on top of the window price</p>
          {onTop.map(([label, amount]) => (
            <div key={label} style={rowStyle}>
              <span>{label}</span>
              <span>{formatMoney(amount)}</span>
            </div>
          ))}
        </>
      )}
      <div style={totalStyle}>
        <span>Total</span>
        <span>{formatMoney(grandTotal(sale))}</span>
      </div>

      <p style={sectionLabelStyle}>Payment against the total</p>
      <div style={rowStyle}>
        <span>Deposit{sale.deposit_date ? ` (${sale.deposit_date})` : ""}</span>
        <span>{formatMoney(Number(sale.deposit_amount) || 0)}</span>
      </div>
      <div style={rowStyle}>
        <span>Part-exchange{sale.part_exchange_date ? ` (${sale.part_exchange_date})` : ""}</span>
        <span>{formatMoney(Number(sale.part_exchange_amount) || 0)}</span>
      </div>
      <div style={totalStyle}>
        <span>Balance due</span>
        <span>{formatMoney(balanceDue(sale))}</span>
      </div>
    </div>
  );
}
