import Docxtemplater from "docxtemplater";
import PizZip from "pizzip";
import { supabase } from "../../lib/supabaseClient.js";
import { buildMergeData, suggestedFileName } from "./calculations.js";

const TEMPLATE_BUCKET = "license-agreement-files";
// Served over HTTPS now, not file:// - the original's base64-embedded
// template (assets/template-data.js) existed purely to work around
// file:// fetch restrictions that don't apply here, so the bundled
// default just fetches the static asset directly.
const DEFAULT_TEMPLATE_URL = "/license-agreement/template.docx";

// A custom uploaded/converted template (Admin -> License agreement
// settings) takes priority when one's on file; otherwise falls back to
// the bundled default that ships with the app.
async function loadTemplateBuffer(templateStoragePath) {
  if (templateStoragePath) {
    const { data, error } = await supabase.storage.from(TEMPLATE_BUCKET).download(templateStoragePath);
    if (error) throw new Error(`Couldn't load the uploaded template: ${error.message}`);
    return data.arrayBuffer();
  }
  const res = await fetch(DEFAULT_TEMPLATE_URL);
  if (!res.ok) throw new Error(`The template document is missing (${DEFAULT_TEMPLATE_URL} returned ${res.status})`);
  return res.arrayBuffer();
}

// Chrome only allows showSaveFilePicker() while still "handling a user
// gesture" -- that window closes as soon as an unrelated await (here,
// fetching the template over the network) takes long enough, which the
// original tool never had to worry about since its template was
// already in memory (embedded as base64) rather than fetched. So the
// picker has to be requested FIRST, synchronously off the click, and
// only the actual document generation happens afterwards against the
// handle it returns.
async function openSaveHandle(suggestedName) {
  if (!window.showSaveFilePicker) return null;
  return window.showSaveFilePicker({
    suggestedName,
    types: [
      {
        description: "Word document",
        accept: { "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [".docx"] },
      },
    ],
  });
}

async function writeBlob(handle, blob, suggestedName) {
  if (handle) {
    const writable = await handle.createWritable();
    await writable.write(blob);
    await writable.close();
    return;
  }
  // Fallback for browsers/contexts without the File System Access API.
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = suggestedName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

// Returns the generated filename on success, or null if the user
// cancelled the save dialog (not an error worth showing).
export async function generateDocument(wizardData) {
  const fileName = suggestedFileName(wizardData.selectedRow, wizardData.people);

  let handle;
  try {
    handle = await openSaveHandle(fileName);
  } catch (err) {
    if (err && err.name === "AbortError") return null;
    throw err;
  }

  const templateBuf = await loadTemplateBuffer(wizardData.templateStoragePath);
  const zip = new PizZip(templateBuf);
  const doc = new Docxtemplater(zip, { paragraphLoop: true, linebreaks: true });
  doc.render(buildMergeData(wizardData));
  const blob = doc.getZip().generate({
    type: "blob",
    mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  });

  await writeBlob(handle, blob, fileName);
  return fileName;
}
