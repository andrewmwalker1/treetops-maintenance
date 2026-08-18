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
import { Resend } from "npm:resend@3";

const supabaseAdmin = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);
const resend = new Resend(Deno.env.get("RESEND_API_KEY")!);

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

// Sends the account-creation/sign-in link ourselves via Resend rather than
// relying on Supabase's built-in invite email -- this project has no custom
// SMTP configured, so invite emails go out through Supabase's shared sender,
// which is rate-limited and meant for testing only. That's what silently
// swallowed a real invite before (see the "invite" action below): the email
// failed, which surfaced as the whole invite failing. Resend is already
// proven here for contractor job emails (send-contractor-job-email).
async function sendInviteEmail(email: string, displayName: string, actionLink: string) {
  return await resend.emails.send({
    from: "Tree Tops Maintenance <noreply@treetopscaravanpark.co.uk>",
    to: email,
    subject: "You've been invited to Tree Tops Maintenance",
    html: `
      <p>Hi ${displayName},</p>
      <p>You've been invited to Tree Tops Maintenance. Click below to sign in:</p>
      <p><a href="${actionLink}">Sign in to Tree Tops Maintenance</a></p>
      <p>If the button doesn't work, open the app and enter this email address on the sign-in screen instead.</p>
    `,
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
    const { email, displayName, roleId, isContractor, siteIds, redirectTo } = body;
    if (!email || !displayName || !roleId || !Array.isArray(siteIds) || siteIds.length === 0) {
      return jsonResponse({ error: "email, displayName, roleId and at least one site are required" }, 400);
    }

    // generateLink creates the auth account (for type "invite") without
    // sending any email itself -- account creation and email delivery are
    // deliberately two separate steps below, so a failed send can never
    // again take the account down with it and leave the person invisible
    // (no profiles row -> not listed in the Users tab -> looks like the
    // invite was never even attempted).
    const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
      type: "invite",
      email,
      options: { redirectTo },
    });
    if (linkError) {
      console.error("generateLink (invite) failed", linkError.name, linkError.status, linkError.message);
      return jsonResponse({ error: linkError.message || "Could not create account -- check function logs" }, 400);
    }

    const userId = linkData.user.id;

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

    const { error: sendError } = await sendInviteEmail(email, displayName, linkData.properties.action_link);
    if (sendError) {
      // Account + profile now exist either way -- this person will show up
      // in the Users tab and can be retried with "Resend invite" rather
      // than silently disappearing the way a failed invite used to.
      console.error("Resend send failed (invite)", sendError);
      return jsonResponse({ userId, emailSent: false, emailError: sendError.message || "Failed to send invite email" });
    }

    return jsonResponse({ userId, emailSent: true });
  }

  if (action === "update_email") {
    const { userId, email } = body;
    if (!userId || !email) return jsonResponse({ error: "userId and email are required" }, 400);

    const { data: profile, error: profileError } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .eq("id", userId)
      .eq("org_id", orgId)
      .single();
    if (profileError || !profile) return jsonResponse({ error: "User not found" }, 404);

    // email_confirm: true -- this is Andy correcting a typo he made
    // inviting someone (the reason this exists: an invite that went to
    // the wrong address means "Signups not allowed for this instance"
    // at sign-in, because the email they actually type never matches an
    // auth.users row), not the person themselves changing their own
    // verified address. No need to make them re-confirm an email they
    // never had a chance to get wrong.
    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(userId, {
      email,
      email_confirm: true,
    });
    if (updateError) return jsonResponse({ error: updateError.message }, 500);

    return jsonResponse({ ok: true });
  }

  if (action === "resend") {
    const { userId, redirectTo } = body;
    if (!userId) return jsonResponse({ error: "userId is required" }, 400);

    const { data: profile, error: profileError } = await supabaseAdmin
      .from("profiles")
      .select("id, display_name")
      .eq("id", userId)
      .eq("org_id", orgId)
      .single();
    if (profileError || !profile) return jsonResponse({ error: "User not found" }, 404);

    const { data: userData, error: userError } = await supabaseAdmin.auth.admin.getUserById(userId);
    if (userError || !userData?.user?.email) {
      return jsonResponse({ error: "Could not look up this user's email" }, 500);
    }
    const email = userData.user.email;

    // "invite" links only work for accounts that have never signed in --
    // someone who signed in before and just wants a fresh link needs
    // "magiclink" instead. Try invite first (the common case for someone
    // stuck exactly like Jayne was) and fall back rather than making the
    // caller know which state the account is in.
    let { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
      type: "invite",
      email,
      options: { redirectTo },
    });
    if (linkError) {
      ({ data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
        type: "magiclink",
        email,
        options: { redirectTo },
      }));
    }
    if (linkError) {
      console.error("generateLink (resend) failed", linkError.name, linkError.status, linkError.message);
      return jsonResponse({ error: linkError.message || "Could not generate a new sign-in link" }, 400);
    }

    const { error: sendError } = await sendInviteEmail(email, profile.display_name, linkData.properties.action_link);
    if (sendError) {
      console.error("Resend send failed (resend)", sendError);
      return jsonResponse({ error: sendError.message || "Failed to send invite email" }, 500);
    }

    return jsonResponse({ ok: true });
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
