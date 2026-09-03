import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient.js";
import { colors } from "../lib/theme.js";
import { IconClose } from "../ui/index.js";

// `url` lets a caller pass an already-resolved signed URL (e.g. the bulk
// print flow pre-fetches these before calling window.print(), so the
// images are already in the DOM rather than racing print against this
// component's own fetch) -- omit it for the normal fetch-on-mount behaviour.
// `bucket` defaults to "job-photos" for every existing caller; the
// meter-reading pilot passes "meter-photos".
export default function PhotoThumb({ path, size = 80, url: providedUrl, bucket = "job-photos" }) {
  const [fetchedUrl, setFetchedUrl] = useState(null);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    if (providedUrl) return;
    let cancelled = false;
    supabase.storage
      .from(bucket)
      .createSignedUrl(path, 3600)
      .then(({ data }) => {
        if (!cancelled && data) setFetchedUrl(data.signedUrl);
      });
    return () => {
      cancelled = true;
    };
  }, [path, providedUrl, bucket]);

  const url = providedUrl || fetchedUrl;
  if (!url) return <div style={{ width: size, height: size, background: colors.line, borderRadius: 8 }} />;

  return (
    <>
      <img
        src={url}
        alt=""
        loading="lazy"
        onClick={() => setExpanded(true)}
        style={{ width: size, height: size, objectFit: "cover", borderRadius: 8, cursor: "pointer" }}
      />
      {expanded && (
        <div
          onClick={() => setExpanded(false)}
          style={{
            position: "fixed",
            inset: 0,
            background: colors.scrimStrong,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "var(--space-6)",
            zIndex: 300,
            cursor: "zoom-out",
          }}
        >
          <img
            src={url}
            alt=""
            style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain", borderRadius: 8 }}
          />
          <button
            type="button"
            onClick={() => setExpanded(false)}
            aria-label="Close"
            style={{
              position: "fixed",
              top: "16px",
              right: "16px",
              background: "none",
              border: "none",
              color: colors.onDark,
              cursor: "pointer",
              lineHeight: 1,
            }}
          >
            <IconClose size={28} />
          </button>
        </div>
      )}
    </>
  );
}
