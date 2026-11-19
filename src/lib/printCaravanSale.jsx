import { renderToStaticMarkup } from "react-dom/server";
import { openPrintWindow } from "./printJobCards.jsx";
import PrintableSaleCustomerCopy from "../components/PrintableSaleCustomerCopy.jsx";
import PrintableSaleOfficeCopy from "../components/PrintableSaleOfficeCopy.jsx";

// `openPrintWindow` is the one thing reused from printJobCards.jsx -- a
// sibling file, not an addition to it, since that file owns the Jobs
// domain's own printables and this is a different domain sharing only
// that one helper. Everything else below (the print window's own
// document style) is its own copy, matching how printJobCards.jsx and
// PrintableJobCard.jsx already each carry their own independent copy of
// the same handful of tokens rather than a shared export -- the print
// window is a separate document the app's stylesheet never reaches, and
// CLAUDE.md names this duplication as the one deliberate exception to
// "all colour comes from tokens.css".
const PRINT_DOCUMENT_STYLE = `
  body { margin: 0; font-family: 'Work Sans', sans-serif; padding-bottom: 28px; }
  .print-job-card:not(:last-child) { page-break-after: always; }
  .print-footer { position: fixed; bottom: 0; left: 0; width: 100%; text-align: center; font-size: 10px; color: #666; }
`;

function writeSaleDocument(printWindow, title, html) {
  const footer = `<div class="print-footer">Printed ${new Date().toLocaleString()}</div>`;
  printWindow.document.open();
  printWindow.document.write(`<!doctype html><html><head><title>${title}</title><style>${PRINT_DOCUMENT_STYLE}</style></head><body>${html}${footer}</body></html>`);
  printWindow.document.close();
  printWindow.addEventListener("load", () => {
    printWindow.focus();
    printWindow.print();
  });
}

export function writeAndPrintSaleCustomerCopy(printWindow, sale) {
  writeSaleDocument(printWindow, "Order confirmation", renderToStaticMarkup(<PrintableSaleCustomerCopy sale={sale} />));
}

export function writeAndPrintSaleOfficeCopy(printWindow, sale) {
  writeSaleDocument(printWindow, "Office file copy", renderToStaticMarkup(<PrintableSaleOfficeCopy sale={sale} />));
}
