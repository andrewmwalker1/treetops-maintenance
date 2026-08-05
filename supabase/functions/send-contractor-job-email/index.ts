// Tree Tops Maintenance Platform -- send a job's details to its assigned
// contractor by email (and log that it happened).
// Called from src/pages/JobDetail.jsx via
// supabase.functions.invoke("send-contractor-job-email", { body: { jobId } }).
//
// Uses the service role for the same reason as manage-users -- it needs
// to read the job/checklist/creator regardless of the caller's own RLS
// visibility path, and insert the resulting job_activity row as that
// caller. Re-checks the caller's own can_manage_contractors permission
// itself before doing anything, since bypassing RLS means nothing else
// enforces that here. No dedicated "resend" action -- calling this again
// for the same job just sends again and adds another activity entry, so
// the caller always has the current job details and a full send history.

import { createClient } from "npm:@supabase/supabase-js@2";
import { Resend } from "npm:resend@3";

const supabaseAdmin = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);
const resend = new Resend(Deno.env.get("RESEND_API_KEY")!);

// Same reasoning as manage-users/index.ts -- called directly from the
// browser on a different origin, every response needs these headers.
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

async function authorizeCaller(req: Request): Promise<{ ok: boolean; orgId?: string; actorProfileId?: string }> {
  const token = (req.headers.get("Authorization") ?? "").replace("Bearer ", "");
  if (!token) return { ok: false };

  const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(token);
  if (userError || !userData?.user) return { ok: false };

  const { data: profile, error: profileError } = await supabaseAdmin
    .from("profiles")
    .select("org_id, role_id")
    .eq("id", userData.user.id)
    .single();
  if (profileError || !profile) return { ok: false };

  const { data: permission } = await supabaseAdmin
    .from("role_permissions")
    .select("enabled")
    .eq("role_id", profile.role_id)
    .eq("permission_key", "can_manage_contractors")
    .maybeSingle();

  return { ok: !!permission?.enabled, orgId: profile.org_id, actorProfileId: userData.user.id };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const { ok, orgId, actorProfileId } = await authorizeCaller(req);
  if (!ok || !orgId || !actorProfileId) {
    return jsonResponse({ error: "Not authorized" }, 403);
  }

  const body = await req.json();
  const { jobId } = body;
  if (!jobId) return jsonResponse({ error: "jobId is required" }, 400);

  const { data: job, error: jobError } = await supabaseAdmin
    .from("jobs")
    .select(`
      id, description, priority, due_date, org_id,
      pitch:pitches(pitch_number_or_name),
      area:areas(name),
      creator:profiles!jobs_created_by_fkey(display_name),
      assignee_contractor:contractors(id, name, main_email)
    `)
    .eq("id", jobId)
    .eq("org_id", orgId)
    .single();
  if (jobError || !job) return jsonResponse({ error: "Job not found" }, 404);

  const contractor = job.assignee_contractor as { id: string; name: string; main_email: string | null } | null;
  if (!contractor) return jsonResponse({ error: "This job isn't assigned to a contractor" }, 400);
  if (!contractor.main_email) return jsonResponse({ error: `${contractor.name} has no email address on file` }, 400);

  const { data: subtasks } = await supabaseAdmin
    .from("job_subtasks")
    .select("label")
    .eq("job_id", jobId)
    .order("sort_order");

  const checklistHtml = (subtasks ?? []).length
    ? `<ul>${(subtasks ?? []).map((s) => `<li>${escapeHtml(s.label)}</li>`).join("")}</ul>`
    : "<p>No checklist items.</p>";

  const location = (job.pitch as { pitch_number_or_name: string } | null)?.pitch_number_or_name
    || (job.area as { name: string } | null)?.name
    || "Not set";
  const creatorName = (job.creator as { display_name: string } | null)?.display_name || "Tree Tops Maintenance";

  const { error: sendError } = await resend.emails.send({
    from: "Tree Tops Maintenance <noreply@treetopscaravanpark.co.uk>",
    to: contractor.main_email,
    subject: `Job instruction: ${job.description}`,
    html: `
      <h2 style="margin-bottom:4px">${escapeHtml(job.description)}</h2>
      <p><strong>Priority:</strong> ${escapeHtml(job.priority)}</p>
      <p><strong>Due date:</strong> ${job.due_date ? escapeHtml(job.due_date) : "Not set"}</p>
      <p><strong>Location:</strong> ${escapeHtml(location)}</p>
      <p><strong>Requested by:</strong> ${escapeHtml(creatorName)}</p>
      <h3 style="margin-bottom:4px">Checklist</h3>
      ${checklistHtml}
    `,
  });
  if (sendError) {
    console.error("Resend send failed", sendError);
    return jsonResponse({ error: sendError.message || "Failed to send email" }, 500);
  }

  const { error: activityError } = await supabaseAdmin.from("job_activity").insert({
    job_id: jobId,
    event_type: "contractor_email",
    actor_profile_id: actorProfileId,
    new_value: { contractor_id: contractor.id, contractor_name: contractor.name, sent_to: contractor.main_email },
  });
  if (activityError) console.error("Failed to log contractor_email activity", activityError);

  return jsonResponse({ ok: true });
});
