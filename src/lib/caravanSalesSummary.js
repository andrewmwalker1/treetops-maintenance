// The two Caravan Sale Tracker dials on Office Hub's signal strip --
// visible on every tab, not just Sales, the same way the existing Keys
// out / Faulty kit dials already are.
import { supabase } from "./supabaseClient.js";
import { isSaleOverdueWithoutCover } from "./caravanSalesQuery.js";

export async function countSalesInProgress(orgId) {
  const { count, error } = await supabase
    .from("caravan_sales")
    .select("id", { count: "exact", head: true })
    .eq("org_id", orgId)
    .eq("is_complete", false);
  if (error) {
    console.error("countSalesInProgress failed", error);
    return 0;
  }
  return count || 0;
}

export async function countSalesNeedingAttention(orgId) {
  const { data, error } = await supabase
    .from("caravan_sales")
    .select("handover_date, customer_on_cover")
    .eq("org_id", orgId)
    .eq("is_complete", false);
  if (error) {
    console.error("countSalesNeedingAttention failed", error);
    return 0;
  }
  return (data || []).filter(isSaleOverdueWithoutCover).length;
}
