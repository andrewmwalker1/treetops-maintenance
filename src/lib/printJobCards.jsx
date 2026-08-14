import { renderToStaticMarkup } from "react-dom/server";
import PrintableJobCard from "../components/PrintableJobCard.jsx";
import PrintableJobsChecklist from "../components/PrintableJobsChecklist.jsx";

const PRINT_DOCUMENT_STYLE = `
  body { margin: 0; font-family: 'Work Sans', sans-serif; padding-bottom: 28px; }
  .print-job-card:not(:last-child) { page-break-after: always; }
  .print-footer { position: fixed; bottom: 0; left: 0; width: 100%; text-align: center; font-size: 10px; color: #666; }
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

  // One footer, fixed to the page rather than tied to any single job card,
  // so it reprints on every physical page a long job's checklist/activity
  // spills onto -- not just the first page of each card.
  const footer = `<div class="print-footer">Printed ${new Date().toLocaleString()}</div>`;

  printWindow.document.open();
  printWindow.document.write(
    `<!doctype html><html><head><title>Print job card</title><style>${PRINT_DOCUMENT_STYLE}</style></head><body>${html}${footer}</body></html>`
  );
  printWindow.document.close();

  printWindow.addEventListener("load", () => {
    printWindow.focus();
    printWindow.print();
  });
}

// The lighter-weight sibling of writeAndPrintJobBundles above -- a single
// table (like the on-screen jobs list) rather than one full sheet per job,
// for a management walk-round checklist rather than a per-job record.
// Takes the already-loaded job summaries straight from JobsList's own
// state, so unlike the full print flow it needs no extra queries for
// subtasks/photos/activity first.
export function writeAndPrintJobsChecklist(printWindow, jobs, terminology) {
  const html = renderToStaticMarkup(<PrintableJobsChecklist jobs={jobs} terminology={terminology} />);
  const footer = `<div class="print-footer">Printed ${new Date().toLocaleString()}</div>`;

  printWindow.document.open();
  printWindow.document.write(
    `<!doctype html><html><head><title>Print job checklist</title><style>${PRINT_DOCUMENT_STYLE}</style></head><body>${html}${footer}</body></html>`
  );
  printWindow.document.close();

  printWindow.addEventListener("load", () => {
    printWindow.focus();
    printWindow.print();
  });
}
