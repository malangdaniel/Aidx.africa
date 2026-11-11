import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';

type Tables = Database['public']['Tables'];
export type DoctorRow = Tables['doctors']['Row'];
export type DoctorVerificationRow = Tables['doctor_verification']['Row'];
export type DoctorDocumentRow = Tables['doctor_documents']['Row'];
export type DoctorEventRow = Tables['doctor_review_events']['Row'];

export type DoctorDocType = 'medical_license' | 'government_id' | 'profile_photo' | 'degree_certificate';

export const DOCTOR_DOC_LABELS: Record<DoctorDocType, string> = {
  medical_license: 'Valid practicing license (MDCN)',
  government_id: 'Government-issued ID',
  profile_photo: 'Professional profile photo',
  degree_certificate: 'Medical degree certificate (optional)',
};

export const DOCTOR_IMAGE_ONLY_DOCS: DoctorDocType[] = ['profile_photo'];

export interface DoctorApplicationStatus {
  has_doctor: boolean;
  doctor_id?: string;
  verification_status?: 'pending' | 'verified' | 'rejected';
  profile_status?: 'draft' | 'submitted' | 'needs_info';
  is_suspended?: boolean;
  suspended_reason?: string | null;
  rejection_reason?: string | null;
  latest_admin_message?: string | null;
  missing?: string[];
}

export const DOCTOR_MISSING_LABELS: Record<string, string> = {
  doctor_record: 'Doctor record',
  license_number: 'Medical license number',
  license_expiry: 'License expiry date',
  license_expired: 'Your license has expired',
  specialties: 'Specialty',
  years_of_experience: 'Years of experience',
  hospital_or_clinic: 'Hospital or clinic',
  state: 'State',
  city: 'City / LGA',
  contact_phone: 'Contact phone number',
  payout_bank_name: 'Bank name',
  payout_account_number: 'Account number',
  payout_account_name: 'Account name',
  terms_acceptance: 'Acceptance of the terms and privacy policy',
};

/** Which wizard step (1-based) a missing-code belongs to. */
export function doctorStepForMissing(code: string): number {
  if (code.startsWith('document:')) return 3;
  if (['license_number', 'license_expiry', 'license_expired', 'specialties', 'years_of_experience'].includes(code)) return 1;
  if (['hospital_or_clinic', 'state', 'city', 'contact_phone'].includes(code)) return 2;
  if (code.startsWith('payout_')) return 4;
  if (code === 'terms_acceptance') return 5;
  return 1;
}

export function doctorMissingLabel(code: string): string {
  if (code.startsWith('document:')) return DOCTOR_DOC_LABELS[code.slice(9) as DoctorDocType] ?? code;
  return DOCTOR_MISSING_LABELS[code] ?? code;
}

export function errMsg(e: unknown, fallback: string): string {
  if (e instanceof Error && e.message) return e.message;
  if (e && typeof e === 'object' && 'message' in e && typeof (e as { message: unknown }).message === 'string') {
    return (e as { message: string }).message;
  }
  return fallback;
}

export const MAX_FILE_BYTES = 5 * 1024 * 1024;
const DOC_MIME = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];
const IMG_MIME = ['image/jpeg', 'image/png', 'image/webp'];

export class DoctorOnboardingService {
  static async getStatus(): Promise<DoctorApplicationStatus> {
    const { data, error } = await supabase.rpc('doctor_application_status');
    if (error) throw error;
    return (data ?? { has_doctor: false }) as unknown as DoctorApplicationStatus;
  }

  static async getDoctor(userId: string): Promise<DoctorRow | null> {
    const { data, error } = await supabase.from('doctors').select('*').eq('user_id', userId).maybeSingle();
    if (error) throw error;
    return data as DoctorRow | null;
  }

  /** Returns the private verification row, creating it from signup metadata if missing. */
  static async ensureVerification(
    doctor: DoctorRow,
    user: { id: string; user_metadata?: Record<string, unknown> },
  ): Promise<DoctorVerificationRow> {
    const { data: existing, error } = await supabase.from('doctor_verification').select('*').eq('doctor_id', doctor.id).maybeSingle();
    if (error) throw error;
    if (existing) return existing as DoctorVerificationRow;

    const meta = user.user_metadata ?? {};
    const { data: created, error: insErr } = await supabase
      .from('doctor_verification')
      .insert({
        doctor_id: doctor.id,
        user_id: user.id,
        contact_phone: typeof meta.phone === 'string' && meta.phone ? meta.phone : null,
      })
      .select('*')
      .single();
    if (insErr) throw insErr;
    return created as DoctorVerificationRow;
  }

  static async saveDoctor(doctorId: string, patch: Partial<DoctorRow>) {
    const { error } = await supabase.from('doctors').update(patch).eq('id', doctorId);
    if (error) throw error;
  }

  static async saveVerification(doctorId: string, patch: Partial<DoctorVerificationRow>) {
    const { error } = await supabase.from('doctor_verification').update(patch).eq('doctor_id', doctorId);
    if (error) throw error;
  }

  static async listDocuments(doctorId: string): Promise<DoctorDocumentRow[]> {
    const { data, error } = await supabase.from('doctor_documents').select('*').eq('doctor_id', doctorId);
    if (error) throw error;
    return (data ?? []) as DoctorDocumentRow[];
  }

  static validateFile(file: File, docType: DoctorDocType): string | null {
    if (file.size > MAX_FILE_BYTES) return 'File is larger than 5MB.';
    const imageOnly = DOCTOR_IMAGE_ONLY_DOCS.includes(docType);
    const allowed = imageOnly ? IMG_MIME : DOC_MIME;
    if (!allowed.includes(file.type)) {
      return imageOnly ? 'Only JPG, PNG or WEBP images are allowed.' : 'Only PDF, JPG, PNG or WEBP files are allowed.';
    }
    return null;
  }

  static async uploadDocument(params: { doctorId: string; userId: string; docType: DoctorDocType; file: File }) {
    const { doctorId, userId, docType, file } = params;
    const err = this.validateFile(file, docType);
    if (err) throw new Error(err);
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const path = `${userId}/${docType}/${Date.now()}-${safeName}`;
    const { error: upErr } = await supabase.storage.from('doctor-docs').upload(path, file, {
      contentType: file.type,
      upsert: false,
    });
    if (upErr) throw upErr;
    const { error } = await supabase.from('doctor_documents').upsert(
      {
        doctor_id: doctorId,
        user_id: userId,
        doc_type: docType,
        storage_path: path,
        file_name: file.name,
        mime_type: file.type,
        size_bytes: file.size,
      },
      { onConflict: 'doctor_id,doc_type' },
    );
    if (error) {
      await supabase.storage.from('doctor-docs').remove([path]);
      throw error;
    }
  }

  static async signedUrl(path: string, seconds = 300): Promise<string | null> {
    const { data, error } = await supabase.storage.from('doctor-docs').createSignedUrl(path, seconds);
    if (error) return null;
    return data.signedUrl;
  }

  static async deleteDocument(doc: DoctorDocumentRow) {
    const { error } = await supabase.from('doctor_documents').delete().eq('id', doc.id);
    if (error) throw error;
    await supabase.storage.from('doctor-docs').remove([doc.storage_path]);
  }

  static async submit(): Promise<{ ok: boolean; missing: string[] }> {
    const { data, error } = await supabase.rpc('doctor_submit_application');
    if (error) throw error;
    const res = data as unknown as { ok: boolean; missing?: string[] };
    return { ok: !!res.ok, missing: res.missing ?? [] };
  }

  static async listEvents(doctorId: string): Promise<DoctorEventRow[]> {
    const { data, error } = await supabase
      .from('doctor_review_events')
      .select('id, action, message, created_at')
      .eq('doctor_id', doctorId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return (data ?? []) as DoctorEventRow[];
  }
}
