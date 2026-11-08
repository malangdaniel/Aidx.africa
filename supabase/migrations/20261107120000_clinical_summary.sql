-- AI Clinical Summary + patient documents
-- Writes to summaries happen only through the clinical-summary edge function (service role).

-- 1. Patient-uploaded labs / scans -------------------------------------------------
create table if not exists public.patient_documents (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references auth.users(id) on delete cascade,
  doc_type text not null default 'lab_report'
    check (doc_type in ('lab_report', 'imaging', 'scan', 'other')),
  title text,
  storage_path text not null,
  file_name text,
  mime_type text not null
    check (mime_type in ('application/pdf', 'image/jpeg', 'image/png', 'image/webp')),
  size_bytes bigint check (size_bytes is null or size_bytes <= 10485760),
  doc_date date,
  extraction_status text not null default 'pending'
    check (extraction_status in ('pending', 'processed', 'failed')),
  extracted jsonb,
  created_at timestamptz not null default now()
);

create index if not exists patient_documents_patient_idx
  on public.patient_documents (patient_id, created_at desc);

alter table public.patient_documents enable row level security;

create policy "Patients view own documents" on public.patient_documents
  for select using (patient_id = auth.uid());
create policy "Patients add own documents" on public.patient_documents
  for insert with check (
    patient_id = auth.uid()
    and split_part(storage_path, '/', 1) = auth.uid()::text
  );
create policy "Patients delete own documents" on public.patient_documents
  for delete using (patient_id = auth.uid());
-- no update policy: extraction results are written by the edge function

-- storage: reports bucket had upload + view but no delete
create policy "Users can delete own reports" on storage.objects
  for delete using (
    bucket_id = 'reports' and (auth.uid())::text = (storage.foldername(name))[1]
  );

-- 2. Living clinical summary (one current row per patient) --------------------------
create table if not exists public.patient_clinical_summary (
  patient_id uuid primary key references auth.users(id) on delete cascade,
  summary jsonb not null default '{}'::jsonb,
  summary_text text,
  version integer not null default 0,
  is_stale boolean not null default true,
  stale_reason text,
  stale_since timestamptz,
  generated_at timestamptz,
  model text,
  sources jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists public.patient_summary_versions (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references auth.users(id) on delete cascade,
  version integer not null,
  summary jsonb not null,
  summary_text text,
  changelog text,
  trigger_reason text,
  created_at timestamptz not null default now(),
  unique (patient_id, version)
);

alter table public.patient_clinical_summary enable row level security;
alter table public.patient_summary_versions enable row level security;

create policy "Patients view own clinical summary" on public.patient_clinical_summary
  for select using (patient_id = auth.uid());
create policy "Patients view own summary versions" on public.patient_summary_versions
  for select using (patient_id = auth.uid());
-- doctors read summaries through the edge function, which enforces consent + relationship

-- 3. Mark the summary stale when relevant data changes -----------------------------
create or replace function public.mark_clinical_summary_stale(p_patient uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.patient_clinical_summary (patient_id, is_stale, stale_reason, stale_since)
  values (p_patient, true, p_reason, now())
  on conflict (patient_id) do update
    set is_stale = true,
        stale_reason = excluded.stale_reason,
        stale_since = coalesce(public.patient_clinical_summary.stale_since, now()),
        updated_at = now();
end $$;

revoke all on function public.mark_clinical_summary_stale(uuid, text) from public, anon, authenticated;

create or replace function public.trg_summary_stale_profile()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.role = 'patient'
     and (coalesce(old.metadata, '{}'::jsonb) - 'clinical_summary')
         is distinct from (coalesce(new.metadata, '{}'::jsonb) - 'clinical_summary')
  then
    perform public.mark_clinical_summary_stale(new.user_id, 'medical_history_updated');
  end if;
  return new;
end $$;

create or replace function public.trg_summary_stale_document()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform public.mark_clinical_summary_stale(new.patient_id, 'document_uploaded');
  return new;
end $$;

create or replace function public.trg_summary_stale_consultation()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.finalized_at is not null and old.finalized_at is distinct from new.finalized_at then
    perform public.mark_clinical_summary_stale(new.patient_id, 'consultation_finalized');
  end if;
  return new;
end $$;

create or replace function public.trg_summary_stale_ai_diagnosis()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform public.mark_clinical_summary_stale(new.user_id, 'ai_assessment_added');
  return new;
end $$;

create or replace function public.trg_summary_stale_vitals()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform public.mark_clinical_summary_stale(new.user_id, 'vitals_added');
  return new;
end $$;

drop trigger if exists summary_stale_profile on public.profiles;
create trigger summary_stale_profile after update of metadata on public.profiles
  for each row execute function public.trg_summary_stale_profile();

drop trigger if exists summary_stale_document on public.patient_documents;
create trigger summary_stale_document after insert on public.patient_documents
  for each row execute function public.trg_summary_stale_document();

drop trigger if exists summary_stale_consultation on public.consultations;
create trigger summary_stale_consultation after update of finalized_at on public.consultations
  for each row execute function public.trg_summary_stale_consultation();

drop trigger if exists summary_stale_ai_diagnosis on public.ai_diagnoses;
create trigger summary_stale_ai_diagnosis after insert on public.ai_diagnoses
  for each row execute function public.trg_summary_stale_ai_diagnosis();

drop trigger if exists summary_stale_vitals on public.vitals;
create trigger summary_stale_vitals after insert on public.vitals
  for each row execute function public.trg_summary_stale_vitals();
