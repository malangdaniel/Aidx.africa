-- Admin approval of doctor / pharmacy profile change requests.
--
-- Why a function instead of client-side UPDATEs:
--   * profiles / doctors / pharmacies / pharmacy_verification only have "own row"
--     UPDATE policies, so an admin's UPDATE matched 0 rows and silently did nothing.
--   * guard_* triggers also restrict writes made as the `authenticated` role.
-- This SECURITY DEFINER function checks is_admin() and applies a whitelisted set of
-- columns, so only the approved (edited) fields are written.

create or replace function public.admin_apply_profile_change(
  p_kind text,                          -- 'doctor' | 'pharmacy'
  p_user_id uuid,                       -- auth user that owns the record
  p_profile jsonb default '{}'::jsonb,  -- doctor: first_name, last_name, metadata
  p_doctor jsonb default '{}'::jsonb,   -- doctor: license_number, specialties, consult_price, bio
  p_pharmacy jsonb default '{}'::jsonb, -- pharmacy: whitelisted columns (see below), metadata
  p_verification jsonb default '{}'::jsonb -- pharmacy_verification: whitelisted columns
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_pharmacy_id uuid;
  v_set text;
  v_rows int;
  v_result jsonb := '{}'::jsonb;
  c_profile_cols text[] := array['first_name','last_name','metadata'];
  -- license_number is deliberately NOT updatable here: it can only be set when the doctors row is first created
  c_doctor_cols text[] := array['specialties','consult_price','bio'];
  c_pharmacy_cols text[] := array[
    'business_name','trading_name','email','phone','whatsapp_number','year_established',
    'state','city','street','landmark','latitude','longitude','address','opening_hours',
    'is_24_hours','offers_delivery','delivery_radius_km','delivery_fee','offers_pickup',
    'handles_controlled_drugs','handles_cold_chain','accepts_hmo','hmo_partners','metadata'
  ];
  c_verif_cols text[] := array[
    'pcn_premises_license_expiry','nafdac_ndlea_number','contact_person_name','contact_person_phone',
    'contact_person_email','pharmacist_full_name','pharmacist_license_expiry','pharmacist_phone',
    'pharmacist_email','payout_bank_name','payout_account_number','payout_account_name'
  ];
begin
  if not public.is_admin() then
    raise exception 'Only admins can apply profile changes' using errcode = '42501';
  end if;

  if p_kind not in ('doctor','pharmacy') then
    raise exception 'Unknown change kind: %', p_kind using errcode = '22023';
  end if;

  if p_kind = 'doctor' then
    -- profiles row (name + metadata)
    select string_agg(format('%I = r.%I', k, k), ', ') into v_set
      from jsonb_object_keys(p_profile) k where k = any (c_profile_cols);
    if v_set is not null then
      execute format(
        'update public.profiles t set %s, updated_at = now()
           from jsonb_populate_record(null::public.profiles, $1) r
          where t.user_id = $2', v_set)
        using p_profile, p_user_id;
      get diagnostics v_rows = row_count;
      if v_rows = 0 then raise exception 'Profile not found for this doctor'; end if;
      v_result := v_result || jsonb_build_object('profile_rows', v_rows);
    end if;

    -- doctors row (specialty, price, bio). license_number is never changed on an existing row.
    if exists (select 1 from public.doctors where user_id = p_user_id) then
      select string_agg(format('%I = r.%I', k, k), ', ') into v_set
        from jsonb_object_keys(p_doctor) k where k = any (c_doctor_cols);
      if v_set is not null then
        execute format(
          'update public.doctors t set %s, updated_at = now()
             from jsonb_populate_record(null::public.doctors, $1) r
            where t.user_id = $2', v_set)
          using p_doctor, p_user_id;
        get diagnostics v_rows = row_count;
        v_result := v_result || jsonb_build_object('doctor_rows', v_rows);
      end if;
    elsif p_doctor <> '{}'::jsonb then
      -- first-time creation of the doctors row may set the license number
      insert into public.doctors (user_id, license_number, specialties, consult_price, bio)
      select p_user_id, r.license_number, coalesce(r.specialties, '{}'), coalesce(r.consult_price, 0), r.bio
        from jsonb_populate_record(null::public.doctors, p_doctor) r;
      get diagnostics v_rows = row_count;
      v_result := v_result || jsonb_build_object('doctor_rows', v_rows);
    end if;

  else
    select id into v_pharmacy_id from public.pharmacies where user_id = p_user_id;
    if v_pharmacy_id is null then
      raise exception 'Pharmacy not found for this user';
    end if;

    select string_agg(format('%I = r.%I', k, k), ', ') into v_set
      from jsonb_object_keys(p_pharmacy) k where k = any (c_pharmacy_cols);
    if v_set is not null then
      execute format(
        'update public.pharmacies t set %s, updated_at = now()
           from jsonb_populate_record(null::public.pharmacies, $1) r
          where t.id = $2', v_set)
        using p_pharmacy, v_pharmacy_id;
      get diagnostics v_rows = row_count;
      v_result := v_result || jsonb_build_object('pharmacy_rows', v_rows);
    end if;

    select string_agg(format('%I = r.%I', k, k), ', ') into v_set
      from jsonb_object_keys(p_verification) k where k = any (c_verif_cols);
    if v_set is not null then
      execute format(
        'update public.pharmacy_verification t set %s, updated_at = now()
           from jsonb_populate_record(null::public.pharmacy_verification, $1) r
          where t.pharmacy_id = $2', v_set)
        using p_verification, v_pharmacy_id;
      get diagnostics v_rows = row_count;
      if v_rows = 0 then raise exception 'Pharmacy verification record not found'; end if;
      v_result := v_result || jsonb_build_object('verification_rows', v_rows);
    end if;
  end if;

  return v_result;
end;
$$;

revoke all on function public.admin_apply_profile_change(text, uuid, jsonb, jsonb, jsonb, jsonb) from public, anon;
grant execute on function public.admin_apply_profile_change(text, uuid, jsonb, jsonb, jsonb, jsonb) to authenticated;
