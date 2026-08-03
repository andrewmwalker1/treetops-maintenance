// Tree Tops Maintenance Platform -- user admin (invite / deactivate / reactivate).
// Called from src/pages/admin/UsersTab.jsx via supabase.functions.invoke("manage-users", ...).
//
// Uses the service role key deliberately: inviting a user and banning
// their auth account both require the Auth Admin API, which the
// anon/authenticated client can never call directly (same reasoning as
// generate-scheduled-jobs). Because this bypasses RLS by design, it
// re-checks the caller's own can_manage_users permission itself before
// doing anything (see 10-user-admin.sql for that permission and the
// profiles/site_scope RLS it adds for the non-Edge-Function parts of
// user admin -- editing an existing user's role/name/site scope goes
// straight through those policies from the UI, not through here).

import { createClient } from "npm:@supabase/supabase-js@2";

const supabaseAdmin = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

// Called directly from the browser (src/pages/admin/UsersTab.jsx) on a
// different origin than this function, so every response -- including the
// preflight OPTIONS request supabase-js's Authorization/apikey headers
// trigger -- needs CORS headers, or the browser blocks the response before
// the page ever sees it (surfaces client-side as the generic "Failed to
// send a request to the Edge Function", not any error this function
// returns -- this was missing entirely before, which is why invites failed
// silently from the real site despite the function itself working fine).
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

async function authorizeCaller(req: Request): Promise<{ ok: boolean; orgId?: string }> {
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
    .eq("permission_key", "can_manage_users")
    .maybeSingle();

  return { ok: !!permission?.enabled, orgId: profile.org_id };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const { ok, orgId } = await authorizeCaller(req);
  if (!ok || !orgId) {
    return jsonResponse({ error: "Not authorized" }, 403);
  }

  const body = await req.json();
  const { action } = body;

  if (action === "invite") {
    const { email, displayName, roleId, isContractor, siteIds } = body;
    if (!email || !displayName || !roleId || !Array.isArray(siteIds) || siteIds.length === 0) {
      return jsonResponse({ error: "email, displayName, roleId and at least one site are required" }, 400);
    }

    const { data: invited, error: inviteError } = await supabaseAdmin.auth.admin.inviteUserByEmail(email);
    if (inviteError) {
      // AuthRetryableFetchError here (rather than a normal Auth API error)
      // usually means the outbound email send itself failed -- e.g. no
      // custom SMTP configured, so this project is on Supabase's shared
      // built-in email sender, which is rate-limited and meant for testing
      // only. Logged server-side since the client-visible message from
      // this error class is unhelpfully terse ("{}").
      console.error("inviteUserByEmail failed", inviteError.name, inviteError.status, inviteError.message);
      return jsonResponse({ error: inviteError.message || "Invite failed -- check function logs" }, 400);
    }

    const userId = invited.user.id;

    const { error: profileError } = await supabaseAdmin.from("profiles").insert({
      id: userId,
      org_id: orgId,
      role_id: roleId,
      display_name: displayName,
      is_contractor: !!isContractor,
    });
    if (profileError) return jsonResponse({ error: profileError.message }, 500);

    const { error: scopeError } = await supabaseAdmin
      .from("site_scope")
      .insert(siteIds.map((site_id: string) => ({ profile_id: userId, site_id })));
    if (scopeError) return jsonResponse({ error: scopeError.message }, 500);

    return jsonResponse({ userId });
  }

  if (action === "deactivate" || action === "reactivate") {
    const { userId } = body;
    if (!userId) return jsonResponse({ error: "userId is required" }, 400);

    const isActive = action === "reactivate";
    const { error: profileError } = await supabaseAdmin
      .from("profiles")
      .update({ is_active: isActive })
      .eq("id", userId)
      .eq("org_id", orgId);
    if (profileError) return jsonResponse({ error: profileError.message }, 500);

    // A ban blocks new sign-ins and token refreshes immediately -- the
    // hard cutoff. profiles.is_active is the belt-and-braces check on
    // the client side (AuthContext) for any access token that's still
    // technically live until it naturally expires.
    const { error: banError } = await supabaseAdmin.auth.admin.updateUserById(userId, {
      ban_duration: isActive ? "none" : "876000h",
    });
    if (banError) return jsonResponse({ error: banError.message }, 500);

    return jsonResponse({ ok: true });
  }

  return jsonResponse({ error: `Unknown action "${action}"` }, 400);
});
