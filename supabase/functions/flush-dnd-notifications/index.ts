// Tree Tops Maintenance Platform — flushes queued operational
// notifications once a user's DND flips off (Section 7: "deliver
// everything queued the moment the user's dnd_enabled flips to false").
//
// Called by the client (src/platform/notifications.js) right after it
// updates profiles.dnd_enabled to false. Body: { profileId }.

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

Deno.serve(async (req) => {
  const { profileId } = await req.json();
  if (!profileId) return new Response(JSON.stringify({ error: "profileId is required" }), { status: 400 });

  const { data: queued, error } = await supabase
    .from("notifications")
    .select("id, payload")
    .eq("recipient_profile_id", profileId)
    .is("delivered_at", null);
  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 });

  const { data: subs, error: subsError } = await supabase
    .from("push_subscriptions")
    .select("id, subscription")
    .eq("profile_id", profileId);
  if (subsError) return new Response(JSON.stringify({ error: subsError.message }), { status: 500 });

  for (const notification of queued ?? []) {
    await Promise.all(
      (subs ?? []).map(async (sub) => {
        try {
          await webpush.sendNotification(sub.subscription, JSON.stringify(notification.payload));
        } catch (err) {
          if (err?.statusCode === 410 || err?.statusCode === 404) {
            await supabase.from("push_subscriptions").delete().eq("id", sub.id);
          } else {
            console.error("Push failed for subscription", sub.id, err);
          }
        }
      })
    );
    await supabase.from("notifications").update({ delivered_at: new Date().toISOString() }).eq("id", notification.id);
  }

  return new Response(JSON.stringify({ flushed: (queued ?? []).length }), { headers: { "Content-Type": "application/json" } });
});
