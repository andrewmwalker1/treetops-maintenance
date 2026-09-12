// Tree Tops Maintenance Platform — Web Push sender (Section 7).
// Invoked by src/platform/notifications.js's sendNotification(). Also
// invoked by the flush-dnd-notifications function once a user's DND
// flips off, to actually deliver what was queued.
//
// Body shape: { recipientProfileId, triggerType, priority, title, body,
// data }. `priority` must be 'safety_critical' or 'operational' —
// safety_critical always sends now regardless of dnd_enabled;
// operational checks dnd_enabled first and queues (delivered_at null)
// instead of sending if the recipient has DND on.

import { createClient } from "npm:@supabase/supabase-js@2";
import webpush from "npm:web-push@3";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

webpush.setVapidDetails(
  Deno.env.get("VAPID_SUBJECT") ?? "mailto:andy@treetopscaravanpark.co.uk",
  Deno.env.get("VAPID_PUBLIC_KEY")!,
  Deno.env.get("VAPID_PRIVATE_KEY")!
);

// Called directly from the browser (src/platform/notifications.js) on a
// different origin than this function -- see the identical comment in
// manage-users/index.ts for why every response (including the OPTIONS
// preflight) needs these headers.
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

const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// Two legitimate kinds of caller: generate-scheduled-jobs, invoking this
// server-to-server with the service role key as its own Authorization
// header (supabase-js sends whatever key the calling client was created
// with) -- trusted outright, since it already resolved recipientProfileId
// itself from a service-role query. Everything else must be a real
// logged-in user's access token (this function is also called directly
// from the browser, src/platform/notifications.js), scoped to only notify
// someone in their own org -- the same trust boundary job assignment
// already has (any staff member can assign a job, and therefore notify,
// any other staff member in the org).
async function authorizeCaller(req: Request): Promise<{ ok: boolean; orgId?: string; trusted?: boolean }> {
  const token = (req.headers.get("Authorization") ?? "").replace("Bearer ", "");
  if (!token) return { ok: false };
  if (token === SERVICE_ROLE_KEY) return { ok: true, trusted: true };

  const { data: userData, error: userError } = await supabase.auth.getUser(token);
  if (userError || !userData?.user) return { ok: false };

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("org_id")
    .eq("id", userData.user.id)
    .single();
  if (profileError || !profile) return { ok: false };

  return { ok: true, orgId: profile.org_id };
}

async function pushToProfile(recipientProfileId: string, title: string, body: string, data: unknown) {
  const { data: subs, error } = await supabase
    .from("push_subscriptions")
    .select("id, subscription")
    .eq("profile_id", recipientProfileId);
  if (error) throw error;

  await Promise.all(
    (subs ?? []).map(async (sub) => {
      try {
        await webpush.sendNotification(sub.subscription, JSON.stringify({ title, body, data }));
      } catch (err) {
        // 410/404 means the subscription is gone — clean it up so we
        // stop trying to push to a dead endpoint.
        if (err?.statusCode === 410 || err?.statusCode === 404) {
          await supabase.from("push_subscriptions").delete().eq("id", sub.id);
        } else {
          console.error("Push failed for subscription", sub.id, err);
        }
      }
    })
  );
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const auth = await authorizeCaller(req);
  if (!auth.ok) {
    return jsonResponse({ error: "Not authorized" }, 401);
  }

  const { recipientProfileId, triggerType, priority, title, body, data } = await req.json();

  if (!recipientProfileId || !priority || !title) {
    return jsonResponse({ error: "recipientProfileId, priority and title are required" }, 400);
  }

  if (!auth.trusted) {
    const { data: recipientProfile, error: recipientError } = await supabase
      .from("profiles")
      .select("id")
      .eq("id", recipientProfileId)
      .eq("org_id", auth.orgId)
      .maybeSingle();
    if (recipientError) return jsonResponse({ error: recipientError.message }, 500);
    if (!recipientProfile) return jsonResponse({ error: "Not authorized" }, 403);
  }

  let shouldSendNow = priority === "safety_critical";
  if (priority === "operational") {
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("dnd_enabled")
      .eq("id", recipientProfileId)
      .single();
    if (profileError) return jsonResponse({ error: profileError.message }, 500);
    shouldSendNow = !profile.dnd_enabled;
  }

  const { error: insertError } = await supabase.from("notifications").insert({
    recipient_profile_id: recipientProfileId,
    trigger_type: triggerType ?? "manual",
    priority,
    payload: { title, body, data },
    delivered_at: shouldSendNow ? new Date().toISOString() : null,
  });
  if (insertError) return jsonResponse({ error: insertError.message }, 500);

  if (shouldSendNow) {
    await pushToProfile(recipientProfileId, title, body, data);
  }

  return jsonResponse({ queued: !shouldSendNow });
});
