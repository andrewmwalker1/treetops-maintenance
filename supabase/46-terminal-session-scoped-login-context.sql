-- Tree Tops Maintenance Platform -- make login_context session-scoped
-- Run after 45-job-requires-photo-edit-permission.sql.
--
-- Andy reported staff getting logged out of the normal app on their own
-- phones whenever anyone used the workshop kiosk or key station. Root
-- cause: rfid-login (see 34-key-station-login-context.sql) stamped
-- app_metadata.login_context onto the profile's auth.users ROW, not onto
-- the one session it was minting -- app_metadata is per-user, not
-- per-session, and GoTrue re-reads it from auth.users on every token
-- refresh for EVERY session that user has open. So a normal phone session,
-- once it refreshed, would pick up a stale login_context left behind by an
-- unrelated kiosk scan, and App.jsx would treat that as a kiosk session
-- that had wandered off its terminal -- exactly the ambiguity App.jsx's
-- own comments already flagged as unresolvable from client state alone.
--
-- Fix: a Custom Access Token Hook (public.custom_access_token_hook below)
-- looks up THIS session's id -- session_id is a standard claim GoTrue puts
-- on every JWT -- in the new terminal_sessions table, and only then adds
-- app_metadata.login_context to the outgoing token: exactly the shape
-- session_login_context() (34-key-station-login-context.sql) and App.jsx
-- already read, so neither needed to change. auth.users.raw_app_meta_data
-- itself is never written by this flow, so no other session for that user
-- is ever affected.
--
-- terminal_sessions rows are written by the new register-terminal-session
-- Edge Function, called once by AuthContext.jsx right after a kiosk/key-
-- station magic-link redirect lands and a session actually exists (rfid-
-- login can't do it itself -- no session exists yet when it mints the
-- link). "on delete cascade" off auth.sessions means a row disappears the
-- moment that session ends, so nothing needs separate cleanup.
--
-- IMPORTANT -- one manual step this file can't do: the Custom Access Token
-- Hook still needs enabling in Supabase Dashboard -> Authentication ->
-- Hooks -> "Customize Access Token (JWT) Claims hook" -> select the
-- public.custom_access_token_hook Postgres function -> Save. That's a
-- project-config setting, not reachable via SQL or the CLI. Until that's
-- done, no session carries login_context at all (kiosk/key-station
-- confinement is temporarily off, same as the old pathname-only check
-- pre-34-key-station-login-context.sql), but nothing is broken and no one
-- gets spuriously logged out either way.

create table if not exists public.terminal_sessions (
  session_id uuid primary key references auth.sessions(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  login_context text not null check (login_context in ('kiosk', 'key_station')),
  created_at timestamptz not null default now()
);

alter table public.terminal_sessions enable row level security;

-- No policies for anon/authenticated -- the only writer is
-- register-terminal-session, which uses the service role (after verifying
-- the caller's own token itself, so RLS isn't what's protecting writes
-- here). Only supabase_auth_admin (the role GoTrue runs hooks as) can read.
drop policy if exists terminal_sessions_auth_admin_select on public.terminal_sessions;
create policy terminal_sessions_auth_admin_select on public.terminal_sessions
  for select
  to supabase_auth_admin
  using (true);

grant usage on schema public to supabase_auth_admin;
grant select on public.terminal_sessions to supabase_auth_admin;
revoke all on public.terminal_sessions from authenticated, anon, public;

create or replace function public.custom_access_token_hook(event jsonb)
returns jsonb
language plpgsql
stable
as $$
declare
  v_claims jsonb;
  v_session_id uuid;
  v_context text;
begin
  v_claims := event->'claims';

  begin
    v_session_id := (event->'claims'->>'session_id')::uuid;
  exception when others then
    v_session_id := null;
  end;

  v_context := null;
  if v_session_id is not null then
    select ts.login_context into v_context
    from public.terminal_sessions ts
    where ts.session_id = v_session_id;
  end if;

  if v_context is not null then
    v_claims := jsonb_set(
      v_claims,
      '{app_metadata}',
      coalesce(v_claims->'app_metadata', '{}'::jsonb) || jsonb_build_object('login_context', v_context)
    );
  elsif v_claims->'app_metadata' ? 'login_context' then
    -- Belt-and-braces: strip any stale value already sitting in the real
    -- app_metadata row (e.g. left over from before this migration) rather
    -- than letting it leak through just because this session isn't
    -- registered.
    v_claims := jsonb_set(v_claims, '{app_metadata}', (v_claims->'app_metadata') - 'login_context');
  end if;

  return jsonb_set(event, '{claims}', v_claims);
end;
$$;

grant execute on function public.custom_access_token_hook to supabase_auth_admin;
revoke execute on function public.custom_access_token_hook from authenticated, anon, public;

-- One-time cleanup: strip any stale login_context already sitting on
-- auth.users from before this migration (rfid-login no longer writes it
-- going forward -- see the accompanying rfid-login/index.ts change), so no
-- one hits the old bug even once more while waiting for the hook above to
-- be enabled in the Dashboard.
update auth.users
set raw_app_meta_data = raw_app_meta_data - 'login_context'
where raw_app_meta_data ? 'login_context';
