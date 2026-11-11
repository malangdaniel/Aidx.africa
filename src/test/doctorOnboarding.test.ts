import { describe, expect, it } from 'vitest';
import { doctorPatch, doctorVerificationPatch, validateDoctorSection, type DoctorForm } from '@/components/doctor/onboarding/doctorForm';
import { doctorStepForMissing, doctorMissingLabel } from '@/services/DoctorOnboardingService';

const blank: DoctorForm = {
  license_number: '', mdcn_folio_number: '', license_expiry: '', specialties: '', years_of_experience: '',
  alma_mater: '', graduation_year: '', bio: '', consult_price: '', hospital_or_clinic: '', state: '', city: '',
  contact_phone: '', payout_bank_name: '', payout_account_number: '', payout_account_name: '', terms_accepted: false,
};

describe('doctor onboarding form', () => {
  it('splits comma separated specialties and nulls blanks', () => {
    const p = doctorPatch({ ...blank, specialties: 'Paediatrics, ,General Practice', license_number: ' X1 ' }, 'professional');
    expect(p.specialties).toEqual(['Paediatrics', 'General Practice']);
    expect(p.license_number).toBe('X1');
    expect(p.years_of_experience).toBeNull();
  });

  it('keeps private fields out of the public doctors patch', () => {
    const p = doctorPatch({ ...blank, payout_account_number: '0123456789', contact_phone: '080' }, 'practice');
    expect(p).not.toHaveProperty('payout_account_number');
    expect(p).not.toHaveProperty('contact_phone');
    expect(doctorVerificationPatch({ ...blank, contact_phone: '080' }, 'practice').contact_phone).toBe('080');
  });

  it('validates expiry, account number and experience', () => {
    expect(validateDoctorSection({ ...blank, license_expiry: '2000-01-01' }, 'professional')).toMatch(/future/);
    expect(validateDoctorSection({ ...blank, payout_account_number: '123' }, 'payout')).toMatch(/10 digits/);
    expect(validateDoctorSection({ ...blank, years_of_experience: '-2' }, 'professional')).toMatch(/years/);
    expect(validateDoctorSection({ ...blank, payout_account_number: '0123456789' }, 'payout')).toBeNull();
  });

  it('maps server missing codes to wizard steps and labels', () => {
    expect(doctorStepForMissing('license_number')).toBe(1);
    expect(doctorStepForMissing('city')).toBe(2);
    expect(doctorStepForMissing('document:profile_photo')).toBe(3);
    expect(doctorStepForMissing('payout_bank_name')).toBe(4);
    expect(doctorStepForMissing('terms_acceptance')).toBe(5);
    expect(doctorMissingLabel('document:government_id')).toBe('Government-issued ID');
  });
});
