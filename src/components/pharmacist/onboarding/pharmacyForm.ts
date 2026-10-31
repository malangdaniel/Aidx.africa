import type { PharmacyRow, PharmacyVerificationRow } from '@/services/PharmacyOnboardingService';
import type { Database } from '@/integrations/supabase/types';

export const DAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const;
export type Day = (typeof DAYS)[number];
export const DAY_LABELS: Record<Day, string> = {
  mon: 'Monday', tue: 'Tuesday', wed: 'Wednesday', thu: 'Thursday', fri: 'Friday', sat: 'Saturday', sun: 'Sunday',
};
export type DayHours = { open: string; close: string; closed: boolean };
export type OpeningHours = Record<Day, DayHours>;

export const defaultHours = (): OpeningHours =>
  Object.fromEntries(
    DAYS.map((d) => [d, { open: '08:00', close: '20:00', closed: d === 'sun' }]),
  ) as OpeningHours;

export interface PharmacyForm {
  business_name: string; trading_name: string; license_number: string; email: string; phone: string;
  whatsapp_number: string; year_established: string; logo_url: string;
  cac_rc_number: string; pcn_premises_license_expiry: string; nafdac_ndlea_number: string;
  contact_person_name: string; contact_person_phone: string; contact_person_email: string;
  pharmacist_full_name: string; pharmacist_pcn_number: string; pharmacist_license_expiry: string;
  pharmacist_phone: string; pharmacist_email: string;
  state: string; city: string; street: string; landmark: string; latitude: string; longitude: string;
  opening_hours: OpeningHours; is_24_hours: boolean; offers_delivery: boolean; delivery_radius_km: string;
  delivery_fee: string; offers_pickup: boolean; handles_controlled_drugs: boolean; handles_cold_chain: boolean;
  accepts_hmo: boolean; hmo_partners: string[];
  payout_bank_name: string; payout_account_number: string; payout_account_name: string;
  terms_accepted: boolean;
}

const s = (v: unknown) => (v === null || v === undefined ? '' : String(v));

export function formFromRows(p: PharmacyRow, v: PharmacyVerificationRow): PharmacyForm {
  const stored = (p.opening_hours ?? {}) as Partial<OpeningHours>;
  const hours = defaultHours();
  DAYS.forEach((d) => { if (stored[d]) hours[d] = { ...hours[d], ...stored[d] }; });
  return {
    business_name: p.business_name === 'Pharmacy' ? '' : s(p.business_name),
    trading_name: s(p.trading_name), license_number: s(p.license_number), email: s(p.email), phone: s(p.phone),
    whatsapp_number: s(p.whatsapp_number), year_established: s(p.year_established), logo_url: s(p.logo_url),
    cac_rc_number: s(v.cac_rc_number), pcn_premises_license_expiry: s(v.pcn_premises_license_expiry),
    nafdac_ndlea_number: s(v.nafdac_ndlea_number),
    contact_person_name: s(v.contact_person_name), contact_person_phone: s(v.contact_person_phone),
    contact_person_email: s(v.contact_person_email),
    pharmacist_full_name: s(v.pharmacist_full_name), pharmacist_pcn_number: s(v.pharmacist_pcn_number),
    pharmacist_license_expiry: s(v.pharmacist_license_expiry), pharmacist_phone: s(v.pharmacist_phone),
    pharmacist_email: s(v.pharmacist_email),
    state: s(p.state), city: s(p.city), street: s(p.street), landmark: s(p.landmark),
    latitude: s(p.latitude), longitude: s(p.longitude),
    opening_hours: hours, is_24_hours: p.is_24_hours, offers_delivery: p.offers_delivery,
    delivery_radius_km: s(p.delivery_radius_km), delivery_fee: s(p.delivery_fee), offers_pickup: p.offers_pickup,
    handles_controlled_drugs: p.handles_controlled_drugs, handles_cold_chain: p.handles_cold_chain,
    accepts_hmo: p.accepts_hmo, hmo_partners: p.hmo_partners ?? [],
    payout_bank_name: s(v.payout_bank_name), payout_account_number: s(v.payout_account_number),
    payout_account_name: s(v.payout_account_name),
    terms_accepted: !!v.terms_accepted_at,
  };
}

const t = (v: string) => (v.trim() === '' ? null : v.trim());
const n = (v: string) => (v.trim() === '' || isNaN(Number(v)) ? null : Number(v));

type PUpdate = Database['public']['Tables']['pharmacies']['Update'];
type VUpdate = Database['public']['Tables']['pharmacy_verification']['Update'];
export type Section = 'business' | 'contacts' | 'location' | 'operations' | 'payout';

/** Patch for the public `pharmacies` row, restricted to the fields of a section. */
export function pharmacyPatch(f: PharmacyForm, section: Section, opts: { licenseLocked?: boolean } = {}): PUpdate {
  switch (section) {
    case 'business':
      return {
        business_name: f.business_name.trim() || undefined,
        trading_name: t(f.trading_name), email: t(f.email), phone: t(f.phone),
        whatsapp_number: t(f.whatsapp_number), year_established: n(f.year_established),
        ...(opts.licenseLocked ? {} : { license_number: t(f.license_number) }),
      };
    case 'location':
      return { state: t(f.state), city: t(f.city), street: t(f.street), landmark: t(f.landmark), latitude: n(f.latitude), longitude: n(f.longitude), address: [f.street, f.city, f.state].filter((x) => x.trim()).join(', ') || null };
    case 'operations':
      return {
        opening_hours: f.opening_hours as unknown as PUpdate['opening_hours'], is_24_hours: f.is_24_hours,
        offers_delivery: f.offers_delivery, delivery_radius_km: f.offers_delivery ? n(f.delivery_radius_km) : null,
        delivery_fee: f.offers_delivery ? n(f.delivery_fee) : null, offers_pickup: f.offers_pickup,
        handles_controlled_drugs: f.handles_controlled_drugs, handles_cold_chain: f.handles_cold_chain,
        accepts_hmo: f.accepts_hmo, hmo_partners: f.accepts_hmo ? f.hmo_partners : [],
      };
    default:
      return {};
  }
}

/** Patch for the private `pharmacy_verification` row. */
export function verificationPatch(f: PharmacyForm, section: Section, opts: { regLocked?: boolean } = {}): VUpdate {
  switch (section) {
    case 'business':
      return {
        pcn_premises_license_expiry: t(f.pcn_premises_license_expiry), nafdac_ndlea_number: t(f.nafdac_ndlea_number),
        ...(opts.regLocked ? {} : { cac_rc_number: t(f.cac_rc_number) }),
      };
    case 'contacts':
      return {
        contact_person_name: t(f.contact_person_name), contact_person_phone: t(f.contact_person_phone),
        contact_person_email: t(f.contact_person_email),
        pharmacist_full_name: t(f.pharmacist_full_name), pharmacist_license_expiry: t(f.pharmacist_license_expiry),
        pharmacist_phone: t(f.pharmacist_phone), pharmacist_email: t(f.pharmacist_email),
        ...(opts.regLocked ? {} : { pharmacist_pcn_number: t(f.pharmacist_pcn_number) }),
      };
    case 'payout':
      return {
        payout_bank_name: t(f.payout_bank_name), payout_account_number: t(f.payout_account_number),
        payout_account_name: t(f.payout_account_name),
      };
    default:
      return {};
  }
}

/** Returns an error message, or null if the section's *format* rules pass (completeness is checked on submit). */
export function validateSection(f: PharmacyForm, section: Section): string | null {
  const today = new Date().toISOString().slice(0, 10);
  if (section === 'business' && f.pcn_premises_license_expiry && f.pcn_premises_license_expiry <= today)
    return 'The PCN premises license expiry date must be in the future.';
  if (section === 'contacts' && f.pharmacist_license_expiry && f.pharmacist_license_expiry <= today)
    return 'The pharmacist license expiry date must be in the future.';
  if (section === 'payout' && f.payout_account_number && !/^[0-9]{10}$/.test(f.payout_account_number))
    return 'Account number must be exactly 10 digits.';
  if (section === 'location') {
    if (f.latitude && (isNaN(Number(f.latitude)) || Math.abs(Number(f.latitude)) > 90)) return 'Latitude must be between -90 and 90.';
    if (f.longitude && (isNaN(Number(f.longitude)) || Math.abs(Number(f.longitude)) > 180)) return 'Longitude must be between -180 and 180.';
  }
  if (section === 'operations' && f.offers_delivery) {
    if (f.delivery_fee && Number(f.delivery_fee) < 0) return 'Delivery fee cannot be negative.';
    if (f.delivery_radius_km && Number(f.delivery_radius_km) < 0) return 'Delivery radius cannot be negative.';
  }
  return null;
}
