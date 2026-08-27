import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient.js";
import { colors, fonts } from "../lib/theme.js";

// Renders one RA/MS library entry: type, title (linked to a signed PDF
// URL once resolved), and the optional secondary summary. `large` swaps
// the default compact text link for a touch-sized button matching the
// kiosk's machine-selection buttons -- Andy found the default text too
// small to reliably tap on the workshop touchscreen. Outlined rather
// than filled solid like those buttons, since a document is something
// to open, not a choice to make.
export default function SafetyDocumentLink({ doc, large = false }) {
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

  if (large) {
    const Tag = url ? "a" : "div";
    return (
      <Tag
        {...(url ? { href: url, target: "_blank", rel: "noreferrer" } : {})}
        style={{
          display: "block",
          textDecoration: "none",
          background: "transparent",
          border: `2px solid ${colors.lineStrong}`,
          borderRadius: "20px",
          padding: "18px 20px",
          marginBottom: "14px",
          fontFamily: fonts.body,
          color: colors.mossDark,
          cursor: url ? "pointer" : "default",
        }}
      >
        <div style={{ fontSize: "14px", color: colors.inkSoft, textTransform: "capitalize", marginBottom: "4px" }}>
          {doc.type.replace("_", " ")}
        </div>
        <div style={{ fontSize: "20px", fontWeight: 700 }}>
          {doc.title}
          {!doc.pdf_storage_path && " (no PDF yet)"}
        </div>
        {doc.description && <div style={{ fontSize: "14px", color: colors.inkSoft, marginTop: "6px" }}>{doc.description}</div>}
      </Tag>
    );
  }

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
