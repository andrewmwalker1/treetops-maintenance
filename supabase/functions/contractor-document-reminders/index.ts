// Tree Tops Maintenance Platform — contractor document expiry reminders
// Edge Function (Section 5, alongside generate-scheduled-jobs). Runs daily
// via pg_cron / the Dashboard Cron tab, same as generate-scheduled-jobs.
//
// For every contractor_documents row with an expiry_date within 7 days
// (inclusive of already-passed ones, so nothing that slipped through gets
// silently skipped) that hasn't already had its reminder cycle triggered
// (reminder_triggered_at is null — see 29-contractor-documents.sql for the
// reset-on-expiry-change trigger that lets a renewed document earn a fresh
// cycle), this:
//   1. Raises a job for the org's "Office" group, due the expiry date.
//   2. Emails the contractor asking for updated documents, if they have an
//      email address on file — skipped (not retried) otherwise, since
//      there's nothing to send it to.
//   3. Marks the row as triggered so tomorrow's run doesn't repeat it.
// Each document expires independently, so this scans and processes one
// row at a time rather than grouping by contractor -- two documents for
// the same contractor with different expiry dates get two separate jobs
// and, if applicable, two separate emails, whenever each individually
// crosses the 7-day mark.
//
// Uses the service role deliberately, same reasoning as
// generate-scheduled-jobs -- runs on a schedule with no logged-in user.

import { createClient } from "npm:@supabase/supabase-js@2";
import { Resend } from "npm:resend@3";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);
const resend = new Resend(Deno.env.get("RESEND_API_KEY")!);

function toDateOnly(date: Date) {
  return date.toISOString().slice(0, 10);
}

function addDays(date: Date, days: number) {
  const d = new Date(date);
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

Deno.serve(async () => {
  const cutoff = toDateOnly(addDays(new Date(), 7));

  const { data: documents, error: documentsError } = await supabase
    .from("contractor_documents")
    .select("id, org_id, description, expiry_date, contractor:contractors(id, name, main_email)")
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
    const contractor = doc.contractor as { id: string; name: string; main_email: string | null } | null;
    if (!contractor) {
      results.push({ document_id: doc.id, error: "No contractor found for this document" });
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
          description: `Request updated document from ${contractor.name}: ${doc.description} (expires ${doc.expiry_date})`,
          assignee_group_id: groupId,
          priority: "high",
          status_id: statusId,
          due_date: doc.expiry_date,
          created_by: null,
        })
        .select("id")
        .single();
      if (jobError || !job) throw new Error(jobError?.message || "Failed to create job");

      let emailSent = false;
      if (contractor.main_email) {
        const { error: sendError } = await resend.emails.send({
          from: "Tree Tops Maintenance <noreply@treetopscaravanpark.co.uk>",
          to: contractor.main_email,
          subject: `Updated documents needed — ${doc.description}`,
          html: `
            <p>Hi ${escapeHtml(contractor.name)},</p>
            <p>Our records show the following document is due to expire on <strong>${escapeHtml(doc.expiry_date)}</strong>:</p>
            <p><strong>${escapeHtml(doc.description)}</strong></p>
            <p>Please could you deliver an updated copy to the office, or reply to this email with it attached, ahead of the expiry date.</p>
            <p>Thanks,<br/>Tree Tops Maintenance</p>
          `,
        });
        if (sendError) {
          results.push({ document_id: doc.id, job_id: job.id, email_error: sendError.message });
        } else {
          emailSent = true;
        }
      }

      const { error: updateError } = await supabase
        .from("contractor_documents")
        .update({ reminder_triggered_at: new Date().toISOString(), reminder_job_id: job.id })
        .eq("id", doc.id);
      if (updateError) throw new Error(updateError.message);

      results.push({ document_id: doc.id, job_id: job.id, email_sent: emailSent, created: true });
    } catch (err) {
      results.push({ document_id: doc.id, error: String(err) });
    }
  }

  return new Response(JSON.stringify({ results }), { headers: { "Content-Type": "application/json" } });
});
