import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient.js";
import { colors } from "../lib/theme.js";

// Renders one RA/MS library entry: type, title (linked to a signed PDF
// URL once resolved), and the optional secondary summary.
export default function SafetyDocumentLink({ doc }) {
  const [url, setUrl] = useState(null);

  useEffect(() => {
    if (!doc.pdf_storage_path) return;
    let cancelled = false;
    supabase.storage
      .from("ra-ms-pdfs")
      .createSignedUrl(doc.pdf_storage_path, 3600)
      .then(({ data }) => {
        if (!cancelled && data) setUrl(data.signedUrl);
      });
    return () => {
      cancelled = true;
    };
  }, [doc.pdf_storage_path]);

  return (
    <div style={{ padding: "4px 0", fontSize: "13px" }}>
      <span style={{ color: colors.inkSoft, textTransform: "capitalize" }}>{doc.type.replace("_", " ")}</span>{" "}
      {url ? (
        <a href={url} target="_blank" rel="noreferrer" style={{ color: colors.moss, fontWeight: 600 }}>{doc.title}</a>
      ) : (
        <span style={{ fontWeight: 600 }}>{doc.title}{!doc.pdf_storage_path && " (no PDF yet)"}</span>
      )}
      {doc.description && <div style={{ color: colors.inkSoft }}>{doc.description}</div>}
    </div>
  );
}
