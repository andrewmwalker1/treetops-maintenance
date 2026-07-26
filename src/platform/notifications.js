// Web Push implementation of the notification platform boundary.
// No other file should call the Push API / Notification API directly —
// swapping this module's internals is how a future Capacitor build adds
// native push without touching calling code.

import { supabase } from "../lib/supabaseClient.js";

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY;

function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)));
}

export async function subscribeToPush() {
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
    throw new Error("Push notifications are not supported in this browser.");
  }

  const permission = await Notification.requestPermission();
  if (permission !== "granted") {
    throw new Error("Notification permission denied.");
  }

  const registration = await navigator.serviceWorker.ready;
  let subscription = await registration.pushManager.getSubscription();
  if (!subscription) {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
    });
  }

  const { data: userData } = await supabase.auth.getUser();
  const { error } = await supabase
    .from("push_subscriptions")
    .upsert(
      {
        profile_id: userData.user.id,
        endpoint: subscription.endpoint,
        subscription: subscription.toJSON(),
      },
      { onConflict: "endpoint" }
    );
  if (error) {
    console.error("Failed to save push subscription", error);
    throw error;
  }

  return subscription;
}

export async function sendNotification(payload) {
  const { error } = await supabase.functions.invoke("send-notice-push", {
    body: payload,
  });
  if (error) {
    console.error("Failed to send push notification", error);
    throw error;
  }
}

export async function isDNDEnabled() {
  const { data: userData } = await supabase.auth.getUser();
  const { data, error } = await supabase
    .from("profiles")
    .select("dnd_enabled")
    .eq("id", userData.user.id)
    .single();
  if (error) {
    console.error("Failed to read dnd_enabled", error);
    return false;
  }
  return Boolean(data?.dnd_enabled);
}

// Not one of Section 2's three required exports, but the natural home
// for this: flipping DND off must trigger delivery of whatever
// operational notifications queued up while it was on (Section 7).
export async function setDNDEnabled(enabled) {
  const { data: userData } = await supabase.auth.getUser();
  const { error } = await supabase
    .from("profiles")
    .update({ dnd_enabled: enabled })
    .eq("id", userData.user.id);
  if (error) {
    console.error("Failed to update dnd_enabled", error);
    throw error;
  }

  if (!enabled) {
    const { error: flushError } = await supabase.functions.invoke("flush-dnd-notifications", {
      body: { profileId: userData.user.id },
    });
    if (flushError) console.error("Failed to flush queued notifications", flushError);
  }
}
