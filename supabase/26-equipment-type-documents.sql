-- Tree Tops Maintenance Platform -- RA/MS documents on equipment types
-- (Andy: "I want to be able to add RA's / MS's to equipment types in the
-- same way that you've done with the activity types"). Mirrors
-- activity_type_documents (06-activity-types-and-safety-library.sql)
-- exactly, just against equipment_types instead of task_types.
--
-- Gated behind can_manage_equipment_status rather than
-- can_manage_reference_data (which activity_type_documents uses) --
-- equipment_types' own insert/update/delete policies already use
-- can_manage_equipment_status (12-equipment-types.sql), so this follows
-- the same table's existing permission rather than introducing a
-- mismatch between "who can edit the type" and "who can edit its safety
-- documents".

create table if not exists public.equipment_type_documents (
  equipment_type_id uuid not null references public.equipment_types(id) on delete cascade,
  document_id uuid not null references public.ra_ms_documents(id) on delete cascade,
  primary key (equipment_type_id, document_id)
);

alter table public.equipment_type_documents enable row level security;

drop policy if exists equipment_type_documents_select on public.equipment_type_documents;
create policy equipment_type_documents_select on public.equipment_type_documents
  for select using (
    exists (select 1 from public.equipment_types et where et.id = equipment_type_documents.equipment_type_id and et.org_id = public.current_org_id())
  );

drop policy if exists equipment_type_documents_insert on public.equipment_type_documents;
create policy equipment_type_documents_insert on public.equipment_type_documents
  for insert with check (
    exists (select 1 from public.equipment_types et where et.id = equipment_type_documents.equipment_type_id and et.org_id = public.current_org_id())
    and public.has_permission('can_manage_equipment_status')
  );

drop policy if exists equipment_type_documents_delete on public.equipment_type_documents;
create policy equipment_type_documents_delete on public.equipment_type_documents
  for delete using (
    exists (select 1 from public.equipment_types et where et.id = equipment_type_documents.equipment_type_id and et.org_id = public.current_org_id())
    and public.has_permission('can_manage_equipment_status')
  );
