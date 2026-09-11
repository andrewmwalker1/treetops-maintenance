-- Tree Tops Maintenance Platform -- Office Hub tile styling
-- Run after 65-equipment-documents.sql.
--
-- Adds a colour and icon to each Office Hub link/document so the
-- personal dashboard can render them as solid launcher tiles instead of
-- plain cards. `color` stores a key into the fixed palette in
-- src/lib/officeHubTiles.js (TILE_COLORS), not a raw hex value -- same
-- reasoning as job priority's own scale (tokens.css): a small curated
-- set kept in one place, not whatever an admin happens to type.
-- `icon` stores one emoji character from a matching fixed set
-- (TILE_ICONS) rather than free text or an upload, so every tile stays
-- visually consistent.
--
-- Both default to values that exist in the current TILE_COLORS/
-- TILE_ICONS arrays so already-created links/documents render sensibly
-- the moment this runs, with no separate backfill step.

alter table public.office_hub_links add column if not exists color text not null default 'navy';
alter table public.office_hub_links add column if not exists icon text not null default '🔗';

alter table public.office_hub_documents add column if not exists color text not null default 'slate';
alter table public.office_hub_documents add column if not exists icon text not null default '📄';
