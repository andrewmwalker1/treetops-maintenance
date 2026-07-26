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
  const { recipientProfileId, triggerType, priority, title, body, data } = await req.json();

  if (!recipientProfileId || !priority || !title) {
    return new Response(JSON.stringify({ error: "recipientProfileId, priority and title are required" }), { status: 400 });
  }

  let shouldSendNow = priority === "safety_critical";
  if (priority === "operational") {
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("dnd_enabled")
      .eq("id", recipientProfileId)
      .single();
    if (profileError) return new Response(JSON.stringify({ error: profileError.message }), { status: 500 });
    shouldSendNow = !profile.dnd_enabled;
  }

  const { error: insertError } = await supabase.from("notifications").insert({
    recipient_profile_id: recipientProfileId,
    trigger_type: triggerType ?? "manual",
    priority,
    payload: { title, body, data },
    delivered_at: shouldSendNow ? new Date().toISOString() : null,
  });
  if (insertError) return new Response(JSON.stringify({ error: insertError.message }), { status: 500 });

  if (shouldSendNow) {
    await pushToProfile(recipientProfileId, title, body, data);
  }

  return new Response(JSON.stringify({ queued: !shouldSendNow }), { headers: { "Content-Type": "application/json" } });
});
