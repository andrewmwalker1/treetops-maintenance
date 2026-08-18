-- Tree Tops Maintenance Platform -- desktop-access permission
-- Run after 34-key-station-login-context.sql.
--
-- Andy's suggestion alongside 34's session-provenance fix: a per-role
-- switch on the Roles & Permissions admin screen (RolesPermissionsTab.jsx
-- lists every `permissions` row automatically, so no UI change is needed
-- to surface this) for roles that should never reach the full desktop app
-- at all, regardless of how they signed in -- e.g. a future Contractor
-- role for the key-cupboard terminal. This is a DIFFERENT, complementary
-- layer to 34's app_metadata claim: that one confines a specific
-- kiosk-tapped-in session no matter what role it belongs to; this one
-- confines a role no matter how it signed in (a completely normal email
-- login included). Neither replaces the other -- Andy's own Admin role,
-- for instance, legitimately needs desktop access, so this permission
-- alone wouldn't have stopped the kiosk-escape he found; 34 is still what
-- closes that specific path for roles that do have it.
--
-- Granted to every existing role so nobody's current access changes --
-- Andy can switch it off per role going forward.

insert into public.permissions (key, description) values
  ('can_access_desktop', 'Can access the full desktop app (jobs, admin, equipment) -- switch off for a role that should be confined to a kiosk/terminal')
on conflict (key) do nothing;

insert into public.role_permissions (role_id, permission_key, enabled)
select r.id, 'can_access_desktop', true
from public.roles r
on conflict do nothing;
