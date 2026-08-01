import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient.js";
import { colors } from "../lib/theme.js";

// `url` lets a caller pass an already-resolved signed URL (e.g. the bulk
// print flow pre-fetches these before calling window.print(), so the
// images are already in the DOM rather than racing print against this
// component's own fetch) -- omit it for the normal fetch-on-mount behaviour.
export default function PhotoThumb({ path, size = 80, url: providedUrl }) {
  const [fetchedUrl, setFetchedUrl] = useState(null);

  useEffect(() => {
    if (providedUrl) return;
    let cancelled = false;
    supabase.storage
      .from("job-photos")
      .createSignedUrl(path, 3600)
      .then(({ data }) => {
        if (!cancelled && data) setFetchedUrl(data.signedUrl);
      });
    return () => {
      cancelled = true;
    };
  }, [path, providedUrl]);

  const url = providedUrl || fetchedUrl;
  if (!url) return <div style={{ width: size, height: size, background: colors.line, borderRadius: 8 }} />;
  return <img src={url} alt="" style={{ width: size, height: size, objectFit: "cover", borderRadius: 8 }} />;
}
