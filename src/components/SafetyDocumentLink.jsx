import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient.js";
import { colors, fonts } from "../lib/theme.js";

const buttonVariants = {
  // Matches the kiosk's touch-sized machine-selection buttons -- Andy
  // found the default text link too small to reliably tap on the
  // workshop touchscreen.
  "kiosk-button": { padding: "18px 20px", typeSize: "14px", titleSize: "20px", descSize: "14px" },
  // Matches the in-app (phone) machine list buttons' proportions
  // (listButtonStyle in CheckoutKit.jsx/CheckinKit.jsx) -- same
  // button-per-document treatment, sized for the smaller non-kiosk view.
  button: { padding: "12px 16px", typeSize: "11px", titleSize: "15px", descSize: "13px" },
};

// Renders one RA/MS library entry: type, title (linked to a signed PDF
// URL once resolved), and the optional secondary summary. `variant`
// swaps the default compact text link ("text") for a tappable button
// ("button" / "kiosk-button") -- outlined rather than filled solid like
// the machine-selection buttons, since a document is something to open,
// not a choice to make.
export default function SafetyDocumentLink({ doc, variant = "text" }) {
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

  const buttonSizing = buttonVariants[variant];
  if (buttonSizing) {
    const Tag = url ? "a" : "div";
    return (
      <Tag
        {...(url ? { href: url, target: "_blank", rel: "noreferrer" } : {})}
        style={{
          display: "block",
          textDecoration: "none",
          background: "transparent",
          border: `2px solid ${colors.lineStrong}`,
          borderRadius: "14px",
          padding: buttonSizing.padding,
          marginBottom: "10px",
          fontFamily: fonts.body,
          color: colors.mossDark,
          cursor: url ? "pointer" : "default",
        }}
      >
        <div style={{ fontSize: buttonSizing.typeSize, color: colors.inkSoft, textTransform: "capitalize", marginBottom: "4px" }}>
          {doc.type.replace("_", " ")}
        </div>
        <div style={{ fontSize: buttonSizing.titleSize, fontWeight: 700 }}>
          {doc.title}
          {!doc.pdf_storage_path && " (no PDF yet)"}
        </div>
        {doc.description && (
          <div style={{ fontSize: buttonSizing.descSize, color: colors.inkSoft, marginTop: "6px" }}>{doc.description}</div>
        )}
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
