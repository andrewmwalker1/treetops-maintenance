-- Optional extra identifying fields for equipment, e.g. from a
-- manufacturer's data label (serial number, other printed ID number, and
-- the date the item was added to the fleet).
alter table public.equipment
  add column if not exists serial_number text,
  add column if not exists other_id_number text,
  add column if not exists date_added date;
