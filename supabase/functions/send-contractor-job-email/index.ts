// Tree Tops Maintenance Platform -- send a job's details to its assigned
// contractor by email (and log that it happened).
// Called from src/pages/JobDetail.jsx's contractor-email modal via
// supabase.functions.invoke("send-contractor-job-email", { body: {
//   jobId, subject, bodyText, cc, photoIds
// } }) -- the modal builds a default subject/body from the job (see
// buildDefaultContractorEmailBody in JobDetail.jsx) but the office user can
// edit both freely before sending, add a CC, and pick which of the job's
// photos (already-uploaded or freshly captured in the modal, both land in
// job_photos the same way) go out as attachments.
//
// Uses the service role for the same reason as manage-users -- it needs
// to read the job/contractor and download photos from the (private)
// job-photos bucket regardless of the caller's own RLS visibility path,
// and insert the resulting job_activity row as that caller. Re-checks the
// caller's own can_manage_contractors permission itself before doing
// anything, since bypassing RLS means nothing else enforces that here. No
// dedicated "resend" action -- calling this again for the same job just
// sends again (whatever subject/body/photos are passed this time) and
// adds another activity entry, so there's always a full send history.

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

// Uploads are named `${crypto.randomUUID()}-${file.name}` (see
// handleAddPhoto/handleContractorEmailAddPhoto in JobDetail.jsx) -- a
// standard UUID is always 36 characters, so stripping that plus the
// separating dash recovers the original filename for the attachment
// instead of emailing it as a meaningless UUID.
function photoFilename(storagePath: string) {
  const base = storagePath.split("/").pop() || "photo.jpg";
  return base.length > 37 ? base.slice(37) : base;
}

// btoa(String.fromCharCode(...bytes)) blows the call stack on anything
// more than a few KB (spread turns the whole array into call arguments) --
// downscaled job photos are routinely a few hundred KB, so this chunks the
// conversion instead.
function uint8ToBase64(bytes: Uint8Array) {
  let binary = "";
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
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
  const { jobId, subject, bodyText, cc, photoIds } = body;
  if (!jobId) return jsonResponse({ error: "jobId is required" }, 400);
  if (!subject || !subject.trim()) return jsonResponse({ error: "Subject is required" }, 400);
  if (!bodyText || !bodyText.trim()) return jsonResponse({ error: "Email body is required" }, 400);

  const { data: job, error: jobError } = await supabaseAdmin
    .from("jobs")
    .select(`
      id, org_id,
      assignee_contractor:contractors(id, name, main_email)
    `)
    .eq("id", jobId)
    .eq("org_id", orgId)
    .single();
  if (jobError || !job) return jsonResponse({ error: "Job not found" }, 404);

  const contractor = job.assignee_contractor as { id: string; name: string; main_email: string | null } | null;
  if (!contractor) return jsonResponse({ error: "This job isn't assigned to a contractor" }, 400);
  if (!contractor.main_email) return jsonResponse({ error: `${contractor.name} has no email address on file` }, 400);

  const ccList: string[] = Array.isArray(cc) ? cc.map((c: unknown) => String(c).trim()).filter(Boolean) : [];

  let attachments: { filename: string; content: string }[] = [];
  if (Array.isArray(photoIds) && photoIds.length > 0) {
    // Scoped to this job_id, not just `.in("id", photoIds)` -- photoIds
    // comes straight from the browser, so this is what stops someone
    // attaching another job's (possibly another org's) photo by id.
    const { data: photoRows, error: photoError } = await supabaseAdmin
      .from("job_photos")
      .select("id, storage_path")
      .eq("job_id", jobId)
      .in("id", photoIds);
    if (photoError) return jsonResponse({ error: photoError.message }, 500);

    try {
      attachments = await Promise.all(
        (photoRows ?? []).map(async (p) => {
          const { data: fileData, error: downloadError } = await supabaseAdmin.storage.from("job-photos").download(p.storage_path);
          if (downloadError || !fileData) throw new Error(`Failed to fetch photo: ${downloadError?.message || p.storage_path}`);
          const bytes = new Uint8Array(await fileData.arrayBuffer());
          return { filename: photoFilename(p.storage_path), content: uint8ToBase64(bytes) };
        })
      );
    } catch (err) {
      console.error("Failed to prepare photo attachments", err);
      return jsonResponse({ error: err instanceof Error ? err.message : "Failed to attach photos" }, 500);
    }
  }

  const { error: sendError } = await resend.emails.send({
    from: "Tree Tops Maintenance <noreply@treetopscaravanpark.co.uk>",
    to: contractor.main_email,
    cc: ccList.length > 0 ? ccList : undefined,
    subject: subject.trim(),
    html: `<div>${escapeHtml(bodyText).replace(/\n/g, "<br>")}</div>`,
    attachments: attachments.length > 0 ? attachments : undefined,
  });
  if (sendError) {
    console.error("Resend send failed", sendError);
    return jsonResponse({ error: sendError.message || "Failed to send email" }, 500);
  }

  const { error: activityError } = await supabaseAdmin.from("job_activity").insert({
    job_id: jobId,
    event_type: "contractor_email",
    actor_profile_id: actorProfileId,
    new_value: {
      contractor_id: contractor.id,
      contractor_name: contractor.name,
      sent_to: contractor.main_email,
      subject: subject.trim(),
      cc: ccList,
      photo_count: attachments.length,
    },
  });
  if (activityError) console.error("Failed to log contractor_email activity", activityError);

  return jsonResponse({ ok: true });
});
