// Tree Tops Maintenance Platform — equipment document expiry reminders
// Edge Function. Runs daily via pg_cron, same as
// contractor-document-reminders (which this mirrors almost exactly —
// see 65-equipment-documents.sql for the schema this reads).
//
// For every equipment_documents row with an expiry_date within 7 days
// (inclusive of already-passed ones, so nothing that slipped through gets
// silently skipped) that hasn't already had its reminder cycle triggered
// (reminder_triggered_at is null), this:
//   1. Raises a job for the org's "Office" group, due the expiry date,
//      naming the equipment and the document (e.g. "MOT" or "Gas Test").
//   2. Marks the row as triggered so tomorrow's run doesn't repeat it.
// Unlike contractor documents, equipment has no contact to email — the
// Office job is the whole notification. Each document expires
// independently, so this scans and processes one row at a time rather
// than grouping by equipment item.
//
// Uses the service role deliberately, same reasoning as
// contractor-document-reminders -- runs on a schedule with no logged-in
// user.

import { createClient } from "npm:@supabase/supabase-js@2";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

function toDateOnly(date: Date) {
  return date.toISOString().slice(0, 10);
}

function addDays(date: Date, days: number) {
  const d = new Date(date);
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

Deno.serve(async () => {
  const cutoff = toDateOnly(addDays(new Date(), 7));

  const { data: documents, error: documentsError } = await supabase
    .from("equipment_documents")
    .select("id, org_id, description, expiry_date, equipment:equipment(id, name)")
    .not("expiry_date", "is", null)
    .is("reminder_triggered_at", null)
    .lte("expiry_date", cutoff);

  if (documentsError) {
    return new Response(JSON.stringify({ error: documentsError.message }), { status: 500 });
  }

  const results: Record<string, unknown>[] = [];

  // Cached per org so a run with several due documents for the same org
  // doesn't re-look-up the same Office group / open status / site for
  // every single row.
  const officeGroupByOrg = new Map<string, string | null>();
  const openStatusByOrg = new Map<string, string | null>();
  const siteByOrg = new Map<string, string | null>();

  async function officeGroupId(orgId: string) {
    if (!officeGroupByOrg.has(orgId)) {
      const { data } = await supabase.from("groups").select("id").eq("org_id", orgId).eq("name", "Office").maybeSingle();
      officeGroupByOrg.set(orgId, data?.id ?? null);
    }
    return officeGroupByOrg.get(orgId) ?? null;
  }

  async function openStatusId(orgId: string) {
    if (!openStatusByOrg.has(orgId)) {
      const { data } = await supabase
        .from("job_statuses")
        .select("id")
        .eq("org_id", orgId)
        .eq("is_completed", false)
        .order("sort_order", { ascending: true })
        .limit(1)
        .maybeSingle();
      openStatusByOrg.set(orgId, data?.id ?? null);
    }
    return openStatusByOrg.get(orgId) ?? null;
  }

  async function defaultSiteId(orgId: string) {
    if (!siteByOrg.has(orgId)) {
      const { data } = await supabase.from("sites").select("id").eq("org_id", orgId).order("created_at", { ascending: true }).limit(1).maybeSingle();
      siteByOrg.set(orgId, data?.id ?? null);
    }
    return siteByOrg.get(orgId) ?? null;
  }

  for (const doc of documents ?? []) {
    const equipment = doc.equipment as { id: string; name: string } | null;
    if (!equipment) {
      results.push({ document_id: doc.id, error: "No equipment found for this document" });
      continue;
    }

    try {
      const [groupId, statusId, siteId] = await Promise.all([
        officeGroupId(doc.org_id),
        openStatusId(doc.org_id),
        defaultSiteId(doc.org_id),
      ]);
      if (!groupId) throw new Error('No "Office" group found for org');
      if (!statusId) throw new Error("No open job_status found for org");
      if (!siteId) throw new Error("No site found for org");

      const { data: job, error: jobError } = await supabase
        .from("jobs")
        .insert({
          org_id: doc.org_id,
          site_id: siteId,
          description: `Renew document for ${equipment.name}: ${doc.description} (expires ${doc.expiry_date})`,
          assignee_group_id: groupId,
          priority: "high",
          status_id: statusId,
          due_date: doc.expiry_date,
          created_by: null,
        })
        .select("id")
        .single();
      if (jobError || !job) throw new Error(jobError?.message || "Failed to create job");

      const { error: updateError } = await supabase
        .from("equipment_documents")
        .update({ reminder_triggered_at: new Date().toISOString(), reminder_job_id: job.id })
        .eq("id", doc.id);
      if (updateError) throw new Error(updateError.message);

      results.push({ document_id: doc.id, job_id: job.id, created: true });
    } catch (err) {
      results.push({ document_id: doc.id, error: String(err) });
    }
  }

  return new Response(JSON.stringify({ results }), { headers: { "Content-Type": "application/json" } });
});
