import { renderToStaticMarkup } from "react-dom/server";
import PrintableJobCard from "../components/PrintableJobCard.jsx";

const PRINT_DOCUMENT_STYLE = `
  body { margin: 0; font-family: 'Work Sans', sans-serif; }
  .print-job-card:not(:last-child) { page-break-after: always; }
`;

// Must be called synchronously from the click handler, before any await --
// iOS Safari (and popup blockers generally) silently refuse window.open()
// once the gesture has "gone stale", even by a few milliseconds.
export function openPrintWindow() {
  const printWindow = window.open("", "_blank");
  if (!printWindow) {
    throw new Error("Your browser blocked the print window -- allow pop-ups for this site and try again.");
  }
  printWindow.document.write("<!doctype html><title>Preparing…</title><body>Preparing your job sheet…</body>");
  return printWindow;
}

// Printing directly on the app page (@media print + window.print()) has two
// real problems this sidesteps: it's a documented WebKit limitation that
// window.print() silently no-ops on iOS Safari whenever the page is
// Service-Worker controlled (which this PWA always is), and calling
// window.print() right after the print DOM commits races the logo/photo
// <img> fetches -- fine for one job, but a batch of a dozen often lost that
// race and printed with images missing. A fresh, un-controlled tab fixes
// the first; waiting for its `load` event (fires once every image has
// settled, loaded or failed) fixes the second.
export function writeAndPrintJobBundles(printWindow, bundles, terminology) {
  const html = bundles
    .map((bundle) =>
      renderToStaticMarkup(
        <PrintableJobCard
          job={bundle.job}
          subtasks={bundle.subtasks}
          photos={bundle.photos}
          activity={bundle.activity}
          activityTypes={bundle.activityTypes}
          documentsByActivityType={bundle.documentsByActivityType}
          terminology={terminology}
        />
      )
    )
    .join("");

  printWindow.document.open();
  printWindow.document.write(
    `<!doctype html><html><head><title>Print job card</title><style>${PRINT_DOCUMENT_STYLE}</style></head><body>${html}</body></html>`
  );
  printWindow.document.close();

  printWindow.addEventListener("load", () => {
    printWindow.focus();
    printWindow.print();
  });
}
