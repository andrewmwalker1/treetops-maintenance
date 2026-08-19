-- Tree Tops Maintenance Platform -- key management: Sam gets relocate/force-check-in access
-- Run after 37-key-checkouts-and-contractor-reasons.sql.
--
-- Andy: Sam needs to relocate a key between pitches/special locations and
-- force-check-in a stuck one, from both the key station and the desktop
-- app, but this shouldn't be handed to everyone with ordinary
-- can_use_key_system access.
--
-- can_manage_keys already gates exactly these two actions on the desktop
-- side (Admin > Key Tags' "Move" button; Admin > Key Activity Log's
-- "Force check-in" button, calling admin_force_check_in_key) -- reused
-- here rather than inventing a narrower permission, since Sam's
-- "Caravan Prep" role is hers alone (confirmed: nobody else shares it),
-- so granting it there can't leak to anyone else. Granting it also
-- surfaces both of those Admin tabs to her, satisfying "the desktop app"
-- half of the request with no code change needed there.
--
-- The key-station half (new Relocate and Force check-in screens, both
-- gated on this same permission) ships in the same change as this
-- migration -- see src/keys/KeyStationRelocate.jsx and
-- KeyStationForceCheckIn.jsx.

insert into public.role_permissions (role_id, permission_key, enabled)
select r.id, 'can_manage_keys', true
from public.roles r
where r.name = 'Caravan Prep'
  and r.org_id = (select id from public.organisations where name = 'Tree Tops Caravan Park Ltd')
on conflict do nothing;
