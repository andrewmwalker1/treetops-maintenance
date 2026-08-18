// Tree Tops Maintenance Platform -- RFID kiosk sign-in.
// Called from src/kiosk/KioskSignIn.jsx via
// supabase.functions.invoke("rfid-login", { body: { tagUid, redirectTo, context } }).
//
// Uses the service role key deliberately: minting a session from a scanned
// tag (rather than an emailed link the user clicked) requires
// auth.admin.generateLink, which only exists behind the Auth Admin API
// (same reasoning as manage-users/generate-scheduled-jobs). Unlike
// manage-users, there is no bearer token to authorize here -- the whole
// point of this endpoint is to CREATE a session where none exists yet, so
// it's gated only by "does this exact tag_uid exist" plus the rate-limit
// below. Because the app is publicly hosted (not LAN-only), that lookup
// is throttled per tag_uid via rfid_login_attempts (16-rfid-kiosk-and-
// equipment-checkout.sql) -- 8 failed attempts in 15 minutes locks a tag
// out rather than allowing unlimited guesses.
//
// `context` records which shared terminal this scan happened at (e.g.
// "kiosk"). It's stamped onto the resulting session as app_metadata
// (see 34-key-station-login-context.sql) BEFORE the link is generated, so
// it rides along in the JWT of every session/refresh this login produces.
// Unlike the pathname the browser happens to be on, app_metadata can only
// be set server-side via the Admin API -- the client can't edit it -- so
// src/App.jsx can trust it to keep a scanned-in session confined to its
// own kiosk surface even if the URL is edited by hand afterwards.

import { createClient } from "npm:@supabase/supabase-js@2";

const supabaseAdmin = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

const RATE_LIMIT_WINDOW_MINUTES = 15;
const RATE_LIMIT_MAX_FAILURES = 8;
const ALLOWED_CONTEXTS = ["kiosk", "key_station"];

// Called directly from the browser (src/kiosk/KioskSignIn.jsx) on a
// different origin than this function -- see the identical comment in
// manage-users/index.ts for why every response (including the OPTIONS
// preflight) needs these headers, or the browser blocks it client-side
// before the kiosk ever sees the result.
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

async function logAttempt(tagUid: string, ip: string | null, succeeded: boolean) {
  await supabaseAdmin.from("rfid_login_attempts").insert({ tag_uid: tagUid, ip, succeeded });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const { tagUid, redirectTo, context } = await req.json();
  if (!tagUid || !redirectTo) {
    return jsonResponse({ error: "tagUid and redirectTo are required" }, 400);
  }
  if (!ALLOWED_CONTEXTS.includes(context)) {
    return jsonResponse({ error: "Unrecognised sign-in context" }, 400);
  }

  const ip = req.headers.get("x-forwarded-for");

  const since = new Date(Date.now() - RATE_LIMIT_WINDOW_MINUTES * 60_000).toISOString();
  const { count: recentFailures } = await supabaseAdmin
    .from("rfid_login_attempts")
    .select("id", { count: "exact", head: true })
    .eq("tag_uid", tagUid)
    .eq("succeeded", false)
    .gte("attempted_at", since);

  if ((recentFailures ?? 0) >= RATE_LIMIT_MAX_FAILURES) {
    await logAttempt(tagUid, ip, false);
    return jsonResponse({ error: "Too many attempts -- try again later." }, 429);
  }

  const { data: tag, error: tagError } = await supabaseAdmin
    .from("rfid_tags")
    .select("profile_id, profiles(is_active)")
    .eq("tag_uid", tagUid)
    .maybeSingle();
  if (tagError) {
    await logAttempt(tagUid, ip, false);
    return jsonResponse({ error: tagError.message }, 500);
  }
  if (!tag) {
    await logAttempt(tagUid, ip, false);
    return jsonResponse({ error: "Tag not recognised" }, 404);
  }
  if (tag.profiles?.is_active === false) {
    await logAttempt(tagUid, ip, false);
    return jsonResponse({ error: "This account is deactivated" }, 403);
  }

  const { data: userData, error: userError } = await supabaseAdmin.auth.admin.getUserById(tag.profile_id);
  if (userError || !userData?.user?.email) {
    await logAttempt(tagUid, ip, false);
    return jsonResponse({ error: "No account email found for this tag" }, 500);
  }

  // Stamp login_context into app_metadata before the link is generated so
  // it's present in the very first session this scan produces -- see the
  // header comment for why this (not the redirect path) is what App.jsx
  // trusts to confine the session to this kiosk.
  const { error: metadataError } = await supabaseAdmin.auth.admin.updateUserById(tag.profile_id, {
    app_metadata: { login_context: context },
  });
  if (metadataError) {
    await logAttempt(tagUid, ip, false);
    return jsonResponse({ error: metadataError.message }, 500);
  }

  const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
    type: "magiclink",
    email: userData.user.email,
    options: { redirectTo },
  });
  if (linkError) {
    await logAttempt(tagUid, ip, false);
    return jsonResponse({ error: linkError.message }, 500);
  }

  await logAttempt(tagUid, ip, true);
  return jsonResponse({ actionLink: linkData.properties.action_link });
});
