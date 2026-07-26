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

  const { error } = await supabase.rpc("upsert_push_subscription", {
    subscription: subscription.toJSON(),
  });
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
  const { data, error } = await supabase
    .from("profiles")
    .select("dnd_enabled")
    .single();
  if (error) {
    console.error("Failed to read dnd_enabled", error);
    return false;
  }
  return Boolean(data?.dnd_enabled);
}
