// Shared "print only the print sheet" stylesheet. `visibility: hidden` (as
// opposed to display:none) keeps hidden elements' layout space, so the
// outer `.print-sheet` wrapper is pulled out via position:absolute to start
// at the top of the page regardless of where it sits in the DOM; the
// individual `.print-job-card` sheets inside it are normal flow children,
// page-broken between each other -- this lets one stylesheet cover both a
// single card (job detail) and a batch of several (bulk print from the
// jobs list) without the cards overlapping.
export default function PrintStyles() {
  return (
    <style>{`
      .print-sheet { display: none; }
      @media print {
        body * { visibility: hidden; }
        .print-sheet, .print-sheet * { visibility: visible; }
        .print-sheet { display: block; position: absolute; top: 0; left: 0; width: 100%; }
        .print-job-card:not(:last-child) { page-break-after: always; }
      }
    `}</style>
  );
}
