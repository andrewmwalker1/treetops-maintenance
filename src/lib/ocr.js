// Client-side digit OCR (Tesseract.js) for the meter-reading confirm
// screen's pre-filled reading guess. Runs entirely in the browser — no API
// key, no network call — chosen specifically because the field has patchy
// signal as its normal state: a cloud OCR API would silently degrade to
// blank exactly when offline, which is when this matters most. The field
// stays editable regardless of what OCR returns, same as the brief assumes.
//
// The worker is expensive to spin up (loads a WASM engine + language data),
// so it's created once and reused across every scan in the session rather
// than per-photo.

import { createWorker } from "tesseract.js";

let workerPromise = null;

function getWorker() {
  if (!workerPromise) {
    workerPromise = createWorker("eng").then(async (worker) => {
      await worker.setParameters({ tessedit_char_whitelist: "0123456789" });
      return worker;
    });
  }
  return workerPromise;
}

// Returns { text, confidence } — text is digits-only (Tesseract's digit
// whitelist mostly guarantees this already, but a photo can still return
// stray characters at low confidence, so belt-and-braces strip anything
// else). Never throws — a failed recognition just means an empty guess,
// leaving the reading field blank for manual entry.
export async function recognizeDigits(imageFileOrBlob) {
  try {
    const worker = await getWorker();
    const { data } = await worker.recognize(imageFileOrBlob);
    const digits = (data.text || "").replace(/[^0-9]/g, "");
    return { text: digits, confidence: data.confidence };
  } catch (err) {
    console.error("OCR recognition failed", err);
    return { text: "", confidence: 0 };
  }
}
