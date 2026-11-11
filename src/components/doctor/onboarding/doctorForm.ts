import type { DoctorRow, DoctorVerificationRow } from '@/services/DoctorOnboardingService';

export interface DoctorForm {
  license_number: string;
  mdcn_folio_number: string;
  license_expiry: string;
  specialties: string; // comma separated in the UI
  years_of_experience: string;
  alma_mater: string;
  graduation_year: string;
  bio: string;
  consult_price: string;
  hospital_or_clinic: string;
  state: string;
  city: string;
  contact_phone: string;
  payout_bank_name: string;
  payout_account_number: string;
  payout_account_name: string;
  terms_accepted: boolean;
}

export type DoctorSection = 'professional' | 'practice' | 'payout';

const s = (v: unknown) => (v === null || v === undefined ? '' : String(v));
const t = (v: string) => (v.trim() === '' ? null : v.trim());
const n = (v: string) => (v.trim() === '' || isNaN(Number(v)) ? null : Number(v));

export function doctorFormFromRows(d: DoctorRow, v: DoctorVerificationRow): DoctorForm {
  return {
    license_number: s(d.license_number),
    mdcn_folio_number: s(v.mdcn_folio_number),
    license_expiry: s(v.license_expiry),
    specialties: (d.specialties ?? []).join(', '),
    years_of_experience: s(d.years_of_experience),
    alma_mater: s(v.alma_mater),
    graduation_year: s(v.graduation_year),
    bio: s(d.bio),
    consult_price: d.consult_price ? s(d.consult_price) : '',
    hospital_or_clinic: s(d.hospital_or_clinic),
    state: s(d.state),
    city: s(d.city),
    contact_phone: s(v.contact_phone),
    payout_bank_name: s(v.payout_bank_name),
    payout_account_number: s(v.payout_account_number),
    payout_account_name: s(v.payout_account_name),
    terms_accepted: !!v.terms_accepted_at,
  };
}

export function doctorPatch(f: DoctorForm, section: DoctorSection): Partial<DoctorRow> {
  switch (section) {
    case 'professional':
      return {
        license_number: t(f.license_number),
        specialties: f.specialties.split(',').map((x) => x.trim()).filter(Boolean),
        years_of_experience: n(f.years_of_experience),
        bio: t(f.bio),
        consult_price: n(f.consult_price),
      };
    case 'practice':
      return { hospital_or_clinic: t(f.hospital_or_clinic), state: t(f.state), city: t(f.city) };
    default:
      return {};
  }
}

export function doctorVerificationPatch(f: DoctorForm, section: DoctorSection): Partial<DoctorVerificationRow> {
  switch (section) {
    case 'professional':
      return {
        mdcn_folio_number: t(f.mdcn_folio_number),
        license_expiry: t(f.license_expiry),
        alma_mater: t(f.alma_mater),
        graduation_year: n(f.graduation_year),
      };
    case 'practice':
      return { contact_phone: t(f.contact_phone) };
    case 'payout':
      return {
        payout_bank_name: t(f.payout_bank_name),
        payout_account_number: t(f.payout_account_number),
        payout_account_name: t(f.payout_account_name),
      };
    default:
      return {};
  }
}

/** Format rules only; completeness is enforced by the server on submit. */
export function validateDoctorSection(f: DoctorForm, section: DoctorSection): string | null {
  const today = new Date().toISOString().slice(0, 10);
  if (section === 'professional') {
    if (f.license_expiry && f.license_expiry <= today) return 'Your license expiry date must be in the future.';
    if (f.years_of_experience && (isNaN(Number(f.years_of_experience)) || Number(f.years_of_experience) < 0 || Number(f.years_of_experience) > 70))
      return 'Enter a valid number of years of experience.';
    const year = new Date().getFullYear();
    if (f.graduation_year && (Number(f.graduation_year) < 1950 || Number(f.graduation_year) > year))
      return 'Enter a valid graduation year.';
    if (f.consult_price && Number(f.consult_price) < 0) return 'Consultation price cannot be negative.';
  }
  if (section === 'payout' && f.payout_account_number && !/^[0-9]{10}$/.test(f.payout_account_number))
    return 'Account number must be exactly 10 digits.';
  return null;
}
