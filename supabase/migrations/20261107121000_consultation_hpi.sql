-- Doctor-only AI HPI / decision support, kept out of public.consultations because
-- patients can read their whole consultation row.
create table if not exists public.consultation_hpi (
  consultation_id uuid primary key references public.consultations(id) on delete cascade,
  doctor_id uuid not null references auth.users(id) on delete cascade,
  patient_id uuid not null references auth.users(id) on delete cascade,
  hpi jsonb not null default '{}'::jsonb,
  hpi_text text,
  summary_version integer,
  model text,
  generated_at timestamptz not null default now(),
  doctor_feedback jsonb not null default '{}'::jsonb
);

alter table public.consultation_hpi enable row level security;

create policy "Doctors view own HPI" on public.consultation_hpi
  for select using (doctor_id = auth.uid());

create policy "Doctors record feedback on own HPI" on public.consultation_hpi
  for update using (doctor_id = auth.uid()) with check (doctor_id = auth.uid());

create or replace function public.guard_consultation_hpi_update()
returns trigger language plpgsql as $$
begin
  if auth.uid() is not null and auth.role() = 'authenticated' then
    if new.hpi is distinct from old.hpi
       or new.hpi_text is distinct from old.hpi_text
       or new.doctor_id is distinct from old.doctor_id
       or new.patient_id is distinct from old.patient_id
       or new.consultation_id is distinct from old.consultation_id then
      raise exception 'Only doctor_feedback can be changed' using errcode = '42501';
    end if;
  end if;
  return new;
end $$;

create trigger guard_consultation_hpi_update before update on public.consultation_hpi
  for each row execute function public.guard_consultation_hpi_update();
