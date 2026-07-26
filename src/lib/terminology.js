// Resolves site terminology as `terminology_overrides` merged over the
// site_type's `terminology_templates` defaults. Every UI string that
// could vary by industry must come through here, never be hardcoded.

import { supabase } from "./supabaseClient.js";

export async function loadTerminology(site) {
  const { data: templates, error } = await supabase
    .from("terminology_templates")
    .select("key, default_label")
    .eq("site_type", site.site_type);

  if (error) {
    console.error("Failed to load terminology templates", error);
    return {};
  }

  const labels = Object.fromEntries(
    templates.map((row) => [row.key, row.default_label])
  );

  return { ...labels, ...(site.terminology_overrides || {}) };
}
