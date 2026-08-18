// Tree Tops Maintenance Platform -- clears a stale kiosk login_context claim.
// Called from src/lib/AuthContext.jsx via supabase.functions.invoke("clear-login-context")
// whenever a normal (non-kiosk-path) session load finds
// session.user.app_metadata.login_context already set.
//
// rfid-login stamps app_metadata.login_context on the profile's auth.users
// row so a scanned-in session can be told apart from a normal one (see
// 34-key-station-login-context.sql). That field lives on the USER, not the
// session, so it persists across every future login -- including a
// completely normal desktop one -- until something explicitly clears it.
// Without this function, the very first time anyone ever scanned in at a
// kiosk they'd be sent to the kiosk view on every subsequent normal login
// too. The client can never write app_metadata itself (only the Admin API
// can), so this needs its own narrow Edge Function -- one that only ever
// touches the calling user's own row, identified from their own bearer
// token exactly like manage-users does, never taking a target id as input.

import { createClient } from "npm:@supabase/supabase-js@2";

const supabaseAdmin = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const token = (req.headers.get("Authorization") ?? "").replace("Bearer ", "");
  const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(token);
  if (userError || !userData?.user) {
    return jsonResponse({ error: "Not signed in" }, 401);
  }

  if (!userData.user.app_metadata?.login_context) {
    return jsonResponse({ cleared: false });
  }

  const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(userData.user.id, {
    app_metadata: { login_context: null },
  });
  if (updateError) {
    return jsonResponse({ error: updateError.message }, 500);
  }

  return jsonResponse({ cleared: true });
});
