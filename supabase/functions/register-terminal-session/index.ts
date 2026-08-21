// Tree Tops Maintenance Platform -- registers a session as belonging to a
// specific shared terminal (kiosk / key_station), scoped to THAT session
// only. Called once by src/lib/AuthContext.jsx right after a kiosk/key-
// station magic-link redirect lands and a session actually exists --
// rfid-login can't do this itself, since no session exists yet at
// magic-link-generation time.
//
// session_id is taken from the CALLER's own verified access token, never
// from the request body, so a caller can only ever tag their own current
// session. That row is then what public.custom_access_token_hook (see
// 46-terminal-session-scoped-login-context.sql) looks up on every future
// token mint/refresh for THIS session, adding app_metadata.login_context
// without ever touching the shared auth.users row -- the old approach, and
// the reason a kiosk scan used to log staff out of an unrelated phone
// session the next time that phone's token happened to refresh.

import { createClient } from "npm:@supabase/supabase-js@2";

const supabaseAdmin = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

const ALLOWED_CONTEXTS = ["kiosk", "key_station"];

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

// session_id is a standard claim GoTrue puts in every access token
// (needed for its own session-based revocation) but isn't exposed by
// auth.getUser() -- only decoding the token payload directly gets it. Safe
// to trust here because we only read it AFTER auth.getUser() below has
// already confirmed the token is genuinely valid, unexpired and unrevoked.
function decodeJwtPayload(token: string): Record<string, unknown> {
  const payload = token.split(".")[1];
  const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(normalized.length + ((4 - (normalized.length % 4)) % 4), "=");
  return JSON.parse(atob(padded));
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!token) {
    return jsonResponse({ error: "Missing Authorization header" }, 401);
  }

  const { context } = await req.json();
  if (!ALLOWED_CONTEXTS.includes(context)) {
    return jsonResponse({ error: "Unrecognised context" }, 400);
  }

  const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(token);
  if (userError || !userData?.user) {
    return jsonResponse({ error: "Invalid session" }, 401);
  }

  let sessionId: string | undefined;
  try {
    sessionId = decodeJwtPayload(token).session_id as string | undefined;
  } catch {
    sessionId = undefined;
  }
  if (!sessionId) {
    return jsonResponse({ error: "Token has no session_id claim" }, 400);
  }

  const { error: insertError } = await supabaseAdmin
    .from("terminal_sessions")
    .upsert({ session_id: sessionId, profile_id: userData.user.id, login_context: context }, { onConflict: "session_id" });
  if (insertError) {
    return jsonResponse({ error: insertError.message }, 500);
  }

  return jsonResponse({ ok: true });
});
