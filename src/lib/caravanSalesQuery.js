// Single source of truth for reading/writing a caravan sale, and for the
// one rule ("is this sale overdue without the customer on cover?") that
// has to read the same way everywhere it's shown: the sale's own detail
// page, the Sales list badge, the office print copy, and the "Needs
// attention" dashboard dial. See 95-caravan-sale-tracker.sql.

import { supabase } from "./supabaseClient.js";

const SALE_LIST_SELECT = `
  id, forename, surname, caravan_make, caravan_model, caravan_year, caravan_condition,
  handover_date, customer_on_cover, is_complete, created_at,
  pitch:pitches(id, pitch_number_or_name)
`;

const SALE_DETAIL_SELECT = `
  *,
  pitch:pitches(id, pitch_number_or_name),
  jobs:jobs!sale_id(id, description, due_date, sale_role, job_type:job_types(id, name),
    job_status:job_statuses(id, name, is_completed),
    assignee_contractor:contractors(id, name))
`;

export async function querySales(siteId) {
  const { data, error } = await supabase
    .from("caravan_sales")
    .select(SALE_LIST_SELECT)
    .eq("site_id", siteId)
    .order("created_at", { ascending: false });
  if (error) {
    console.error("querySales failed", error);
    throw error;
  }
  return data;
}

export async function getSale(id) {
  const { data, error } = await supabase.from("caravan_sales").select(SALE_DETAIL_SELECT).eq("id", id).maybeSingle();
  if (error) {
    console.error("getSale failed", error);
    throw error;
  }
  return data;
}

export async function createSale(payload) {
  const { data, error } = await supabase.from("caravan_sales").insert(payload).select(SALE_DETAIL_SELECT).single();
  if (error) {
    console.error("createSale failed", error);
    throw error;
  }
  return data;
}

export async function updateSale(id, patch) {
  const { data, error } = await supabase.from("caravan_sales").update(patch).eq("id", id).select(SALE_DETAIL_SELECT).single();
  if (error) {
    console.error("updateSale failed", error);
    throw error;
  }
  return data;
}

// The one place "overdue and not on cover" is decided -- every surface
// that shows the flag calls this rather than re-deriving it.
export function isSaleOverdueWithoutCover(sale) {
  if (!sale || sale.customer_on_cover || !sale.handover_date) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return new Date(sale.handover_date) < today;
}
