import { describe, it, expect } from 'vitest';
import { stepForMissing, missingLabel, daysUntil, PharmacyOnboardingService } from '@/services/PharmacyOnboardingService';
import { validateSection, defaultHours, pharmacyPatch, verificationPatch, DAYS, type PharmacyForm } from '@/components/pharmacist/onboarding/pharmacyForm';
import { citiesForState, NIGERIA_STATES } from '@/lib/nigeriaLocations';

const blank = (over: Partial<PharmacyForm> = {}): PharmacyForm => ({
  business_name: '', trading_name: '', license_number: '', email: '', phone: '', whatsapp_number: '', year_established: '', logo_url: '',
  cac_rc_number: '', pcn_premises_license_expiry: '', nafdac_ndlea_number: '',
  contact_person_name: '', contact_person_phone: '', contact_person_email: '',
  pharmacist_full_name: '', pharmacist_pcn_number: '', pharmacist_license_expiry: '', pharmacist_phone: '', pharmacist_email: '',
  state: '', city: '', street: '', landmark: '', latitude: '', longitude: '',
  opening_hours: defaultHours(), is_24_hours: false, offers_delivery: false, delivery_radius_km: '', delivery_fee: '',
  offers_pickup: true, handles_controlled_drugs: false, handles_cold_chain: false, accepts_hmo: false, hmo_partners: [],
  payout_bank_name: '', payout_account_number: '', payout_account_name: '', terms_accepted: false, ...over,
});

describe('missing-field routing', () => {
  it('sends each backend code to the right wizard step', () => {
    expect(stepForMissing('cac_rc_number')).toBe(1);
    expect(stepForMissing('pharmacist_pcn_number')).toBe(2);
    expect(stepForMissing('contact_person_name')).toBe(2);
    expect(stepForMissing('city')).toBe(3);
    expect(stepForMissing('document:storefront_photo')).toBe(4);
    expect(stepForMissing('terms_acceptance')).toBe(6);
  });
  it('has human labels for backend codes', () => {
    expect(missingLabel('document:cac_certificate')).toBe('CAC Certificate');
    expect(missingLabel('pcn_premises_license_expired')).toMatch(/expired/);
  });
});

describe('section validation', () => {
  it('rejects past license expiry dates', () => {
    expect(validateSection(blank({ pcn_premises_license_expiry: '2020-01-01' }), 'business')).toMatch(/future/);
    expect(validateSection(blank({ pharmacist_license_expiry: '2020-01-01' }), 'contacts')).toMatch(/future/);
  });
  it('accepts future dates and empty drafts', () => {
    expect(validateSection(blank({ pcn_premises_license_expiry: '2999-01-01' }), 'business')).toBeNull();
    expect(validateSection(blank(), 'business')).toBeNull();
  });
  it('requires a 10 digit account number', () => {
    expect(validateSection(blank({ payout_account_number: '12345' }), 'payout')).toMatch(/10 digits/);
    expect(validateSection(blank({ payout_account_number: '0123456789' }), 'payout')).toBeNull();
  });
  it('bounds coordinates', () => {
    expect(validateSection(blank({ latitude: '95' }), 'location')).toMatch(/Latitude/);
    expect(validateSection(blank({ longitude: '200' }), 'location')).toMatch(/Longitude/);
  });
});

describe('patch builders', () => {
  it('omits locked registration fields after approval', () => {
    const f = blank({ license_number: 'PCN-1', cac_rc_number: 'RC1', pharmacist_pcn_number: 'P1' });
    expect('license_number' in pharmacyPatch(f, 'business', { licenseLocked: true })).toBe(false);
    expect('cac_rc_number' in verificationPatch(f, 'business', { regLocked: true })).toBe(false);
    expect('pharmacist_pcn_number' in verificationPatch(f, 'contacts', { regLocked: true })).toBe(false);
    expect(pharmacyPatch(f, 'business').license_number).toBe('PCN-1');
  });
  it('never sends protected status columns', () => {
    for (const s of ['business', 'location', 'operations'] as const) {
      const p = pharmacyPatch(blank({ business_name: 'X' }), s) as Record<string, unknown>;
      for (const k of ['profile_status', 'is_suspended', 'submitted_at', 'rating', 'total_orders', 'user_id']) expect(k in p).toBe(false);
    }
  });
  it('clears delivery fields when delivery is off', () => {
    const p = pharmacyPatch(blank({ offers_delivery: false, delivery_fee: '500', delivery_radius_km: '5' }), 'operations');
    expect(p.delivery_fee).toBeNull();
    expect(p.delivery_radius_km).toBeNull();
  });
  it('defaults opening hours for all 7 days with Sunday closed', () => {
    const h = defaultHours();
    expect(DAYS.every((d) => d in h)).toBe(true);
    expect(h.sun.closed).toBe(true);
  });
});

describe('file validation', () => {
  const file = (type: string, size = 1000) => new File([new Uint8Array(size)], 'f', { type });
  it('enforces size and type', () => {
    expect(PharmacyOnboardingService.validateFile(file('application/pdf', 6 * 1024 * 1024), 'cac_certificate')).toMatch(/5MB/);
    expect(PharmacyOnboardingService.validateFile(file('application/pdf'), 'cac_certificate')).toBeNull();
    expect(PharmacyOnboardingService.validateFile(file('application/pdf'), 'storefront_photo')).toMatch(/images/);
    expect(PharmacyOnboardingService.validateFile(file('application/pdf'), 'logo')).toMatch(/images/);
    expect(PharmacyOnboardingService.validateFile(file('image/webp'), 'logo')).toBeNull();
  });
});

describe('dates and locations', () => {
  it('computes days until', () => {
    expect(daysUntil(null)).toBeNull();
    expect(daysUntil('2000-01-01')!).toBeLessThan(0);
    expect(daysUntil('2999-01-01')!).toBeGreaterThan(30);
  });
  it('lists 37 states and cities per state', () => {
    expect(NIGERIA_STATES).toHaveLength(37);
    expect(NIGERIA_STATES[0]).toBe('FCT');
    expect(citiesForState('Lagos')).toContain('Ikeja');
    expect(citiesForState('')).toEqual([]);
  });
});
