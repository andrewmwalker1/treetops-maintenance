-- Tree Tops Maintenance Platform -- Sales CRM: permissions only
-- Run after 79-linked-jobs.sql.
--
-- The Sales CRM (buyer enquiries, pipeline, stock list, deal builder --
-- see the Sales CRM build brief, 26 Sep 2026) lives inside this app as a
-- "Sales" section rather than a separate site, for the same reason as
-- Office Hub (62) and the License Agreement Builder (63): it rides the
-- existing login/roles instead of a second auth system, and the deal
-- builder reads the License Agreement Builder's pitch-fee and
-- area-season tables directly rather than duplicating them.
--
-- This file creates no tables -- it only sets up who can get in. The
-- stock list and everything after it get their own numbered files once
-- their detail is agreed.
--
-- Three permissions, mapping the brief's sales / sales_deals / admin:
--   can_use_sales_crm       -- the Sales section at all (contacts,
--                              pipeline, public stock fields)
--   can_view_sales_deals    -- restricted data: unit cost, margin, deals,
--                              deal profit. Enforced by RLS on separate
--                              tables, never just hidden in the UI.
--   can_manage_sales_stock  -- add/edit/delete stock units and settings
--
-- Granted to Admin only for now. Who else gets which (Jayne, Nic, Mark)
-- is still an open question in the brief -- grant those per role on the
-- Roles & Permissions admin screen once confirmed, not here.
insert into public.permissions (key, description) values
  ('can_use_sales_crm', 'Can use the Sales CRM (contacts, pipeline, public stock list)'),
  ('can_view_sales_deals', 'Can see restricted sales data: unit cost, margin, deals and deal profit'),
  ('can_manage_sales_stock', 'Can add, edit and delete Sales stock units and Sales settings')
on conflict (key) do nothing;

insert into public.role_permissions (role_id, permission_key, enabled)
select r.id, p.key, true
from public.roles r
cross join (values ('can_use_sales_crm'), ('can_view_sales_deals'), ('can_manage_sales_stock')) as p(key)
where r.name = 'Admin'
  and r.org_id = (select id from public.organisations where name = 'Tree Tops Caravan Park Ltd')
on conflict do nothing;
