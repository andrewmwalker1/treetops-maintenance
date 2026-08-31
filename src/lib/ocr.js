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

// These meters carry a red sub-unit digit wheel (and often a small red
// dial pointer) alongside the main black-on-white wheels — per Andy,
// nobody reads those red digits; they're below the billed unit. Left
// alone, OCR can't tell "digit" from "digit nobody bills on" and happily
// appends them, silently producing a wrong reading rather than an
// obviously-blank one. Whitening anything strongly red before OCR ever
// sees the image removes those cells from its view entirely — the white
// digit glyphs painted on that red background disappear along with it
// (no red bias themselves, so they're untouched by the same threshold),
// leaving no edge contrast for Tesseract to find text in.
async function maskRedDigits(imageFileOrBlob) {
  const bitmap = await createImageBitmap(imageFileOrBlob);
  const canvas = document.createElement("canvas");
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const ctx = canvas.getContext("2d");
  ctx.drawImage(bitmap, 0, 0);
  bitmap.close?.();

  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i], g = data[i + 1], b = data[i + 2];
    // Generous threshold on purpose -- this only needs to catch obviously
    // red pixels (the wheel background), not do precise colour science.
    if (r > 90 && r > g * 1.4 && r > b * 1.4) {
      data[i] = data[i + 1] = data[i + 2] = 255;
    }
  }
  ctx.putImageData(imageData, 0, 0);

  return new Promise((resolve) => canvas.toBlob((blob) => resolve(blob || imageFileOrBlob), "image/jpeg", 0.92));
}

// Returns { text, confidence } — text is digits-only (Tesseract's digit
// whitelist mostly guarantees this already, but a photo can still return
// stray characters at low confidence, so belt-and-braces strip anything
// else). Never throws — a failed recognition just means an empty guess,
// leaving the reading field blank for manual entry.
export async function recognizeDigits(imageFileOrBlob) {
  try {
    const masked = await maskRedDigits(imageFileOrBlob);
    const worker = await getWorker();
    const { data } = await worker.recognize(masked);
    const digits = (data.text || "").replace(/[^0-9]/g, "");
    return { text: digits, confidence: data.confidence };
  } catch (err) {
    console.error("OCR recognition failed", err);
    return { text: "", confidence: 0 };
  }
}
