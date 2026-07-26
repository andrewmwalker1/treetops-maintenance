// Tree Tops Maintenance Platform — user invite + seed script (Section 9 /
// Section 10 step 3). Run manually, once, after 01-schema.sql,
// 02-rls-policies.sql and 03-seed-treetops.sql have all been applied.
//
// Needs the Supabase *service role* key (not the anon key) — it calls
// the Auth Admin API and writes profiles/group_members/site_scope
// directly, bypassing RLS by design. Never commit this key: pass it as
// an env var.
//
//   SUPABASE_URL=https://qkbpsqlrzygcairtidye.supabase.co \
//   SUPABASE_SERVICE_ROLE_KEY=... \
//   node scripts/seed-users.mjs
//
// Only Andy's email below is real. Hazel/Dave/Peter/Sam are placeholders
// — replace with real addresses before running (Section 9 / Section 11
// open item). Re-running is roughly idempotent: inviteUserByEmail on an
// already-invited address errors, which this script logs and skips
// rather than aborting the whole run.

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error("Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY before running this script.");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

const ORG_NAME = "Tree Tops Caravan Park Ltd";
const SITE_NAME = "Tree Tops";

// TODO: replace the placeholder.example.com addresses with real ones.
const SEED_USERS = [
  { email: "andy@treetopscaravanpark.co.uk", displayName: "Andy", role: "Admin", group: null },
  { email: "hazel@placeholder.example.com", displayName: "Hazel", role: "Head Gardener", group: "Gardeners" },
  { email: "dave@placeholder.example.com", displayName: "Dave", role: "Maintenance", group: "Maintenance" },
  { email: "peter@placeholder.example.com", displayName: "Peter", role: "Gardener", group: "Gardeners" },
  { email: "sam@placeholder.example.com", displayName: "Sam", role: "Office", group: "Office" },
];

async function main() {
  const { data: org, error: orgError } = await supabase
    .from("organisations")
    .select("id")
    .eq("name", ORG_NAME)
    .single();
  if (orgError || !org) {
    throw new Error(`Organisation "${ORG_NAME}" not found — run 03-seed-treetops.sql first.`);
  }

  const { data: site, error: siteError } = await supabase
    .from("sites")
    .select("id")
    .eq("org_id", org.id)
    .eq("name", SITE_NAME)
    .single();
  if (siteError || !site) {
    throw new Error(`Site "${SITE_NAME}" not found — run 03-seed-treetops.sql first.`);
  }

  const { data: roles, error: rolesError } = await supabase
    .from("roles")
    .select("id, name")
    .eq("org_id", org.id);
  if (rolesError) throw rolesError;
  const roleIdByName = Object.fromEntries(roles.map((r) => [r.name, r.id]));

  const { data: groups, error: groupsError } = await supabase
    .from("groups")
    .select("id, name")
    .eq("org_id", org.id);
  if (groupsError) throw groupsError;
  const groupIdByName = Object.fromEntries(groups.map((g) => [g.name, g.id]));

  for (const seedUser of SEED_USERS) {
    if (seedUser.email.endsWith("@placeholder.example.com")) {
      console.warn(`Skipping ${seedUser.displayName}: still has a placeholder email, not a real one.`);
      continue;
    }

    const { data: invited, error: inviteError } = await supabase.auth.admin.inviteUserByEmail(
      seedUser.email
    );
    if (inviteError) {
      console.error(`Failed to invite ${seedUser.email}:`, inviteError.message);
      continue;
    }

    const userId = invited.user.id;
    const roleId = roleIdByName[seedUser.role];
    if (!roleId) throw new Error(`Role "${seedUser.role}" not found for ${seedUser.email}`);

    const { error: profileError } = await supabase.from("profiles").upsert({
      id: userId,
      org_id: org.id,
      role_id: roleId,
      display_name: seedUser.displayName,
      is_contractor: false,
    });
    if (profileError) {
      console.error(`Failed to create profile for ${seedUser.email}:`, profileError.message);
      continue;
    }

    if (seedUser.group) {
      const groupId = groupIdByName[seedUser.group];
      if (!groupId) throw new Error(`Group "${seedUser.group}" not found for ${seedUser.email}`);
      const { error: groupError } = await supabase
        .from("group_members")
        .upsert({ group_id: groupId, profile_id: userId });
      if (groupError) console.error(`Failed to add ${seedUser.email} to group:`, groupError.message);
    }

    // Every Tree Tops user is scoped to the single site.
    const { error: scopeError } = await supabase
      .from("site_scope")
      .upsert({ profile_id: userId, site_id: site.id });
    if (scopeError) console.error(`Failed to set site scope for ${seedUser.email}:`, scopeError.message);

    console.log(`Invited and seeded ${seedUser.displayName} <${seedUser.email}> as ${seedUser.role}.`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
