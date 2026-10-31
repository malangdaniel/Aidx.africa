import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';

export type PharmacyRow = Database['public']['Tables']['pharmacies']['Row'];
export type PharmacyVerificationRow = Database['public']['Tables']['pharmacy_verification']['Row'];
export type PharmacyDocumentRow = Database['public']['Tables']['pharmacy_documents']['Row'];
export type PharmacyEventRow = Database['public']['Tables']['pharmacy_review_events']['Row'];

export type DocType =
  | 'cac_certificate'
  | 'pcn_premises_certificate'
  | 'pharmacist_license'
  | 'pharmacist_id'
  | 'nafdac_ndlea_authorization'
  | 'storefront_photo';

export const DOC_LABELS: Record<DocType, string> = {
  cac_certificate: 'CAC Certificate',
  pcn_premises_certificate: 'PCN Premises Certificate',
  pharmacist_license: 'Pharmacist annual practicing license',
  pharmacist_id: 'Pharmacist government ID',
  nafdac_ndlea_authorization: 'NAFDAC / NDLEA authorization',
  storefront_photo: 'Photo of the pharmacy storefront',
};

export const IMAGE_ONLY_DOCS: DocType[] = ['storefront_photo'];

export interface ApplicationStatus {
  has_pharmacy: boolean;
  pharmacy_id?: string;
  verification_status?: 'pending' | 'verified' | 'rejected';
  profile_status?: 'draft' | 'submitted' | 'needs_info';
  is_suspended?: boolean;
  suspended_reason?: string | null;
  rejection_reason?: string | null;
  latest_admin_message?: string | null;
  missing?: string[];
}

export function errMsg(e: unknown, fallback: string): string {
  if (e instanceof Error && e.message) return e.message;
  if (e && typeof e === 'object' && 'message' in e && typeof (e as { message: unknown }).message === 'string') return (e as { message: string }).message;
  return fallback;
}

export const MAX_FILE_BYTES = 5 * 1024 * 1024;
const DOC_MIME = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];
const IMG_MIME = ['image/jpeg', 'image/png', 'image/webp'];

export const MISSING_LABELS: Record<string, string> = {
  pharmacy_record: 'Pharmacy record',
  pharmacy_name: 'Pharmacy name',
  cac_rc_number: 'Registration Number (RC No.)',
  pcn_premises_license_number: 'PCN Premises License Number',
  pcn_premises_license_expiry: 'PCN premises license expiry date',
  pcn_premises_license_expired: 'PCN premises license has expired',
  pharmacy_email: 'Pharmacy email',
  pharmacy_phone: 'Pharmacy phone number',
  state: 'State',
  city: 'City / LGA',
  street: 'Street address',
  contact_person_name: 'Contact person name',
  contact_person_phone: 'Contact person phone',
  pharmacist_full_name: 'Pharmacist full name',
  pharmacist_pcn_number: 'Pharmacist PCN registration number',
  pharmacist_license_expiry: 'Pharmacist license expiry date',
  pharmacist_license_expired: 'Pharmacist annual license has expired',
  pharmacist_phone: 'Pharmacist phone number',
  pharmacist_email: 'Pharmacist email',
  terms_acceptance: 'Acceptance of the vendor agreement and privacy policy',
};

/** Which wizard step (1-based) a missing-code belongs to. */
export function stepForMissing(code: string): number {
  if (code.startsWith('document:')) return 4;
  if (['state', 'city', 'street'].includes(code)) return 3;
  if (code.startsWith('contact_person') || code.startsWith('pharmacist_')) return 2;
  if (code === 'terms_acceptance') return 6;
  return 1;
}

export function missingLabel(code: string): string {
  if (code.startsWith('document:')) return DOC_LABELS[code.slice(9) as DocType] ?? code;
  return MISSING_LABELS[code] ?? code;
}

export class PharmacyOnboardingService {
  static async getStatus(): Promise<ApplicationStatus> {
    const { data, error } = await supabase.rpc('pharmacy_application_status');
    if (error) throw error;
    return (data ?? { has_pharmacy: false }) as unknown as ApplicationStatus;
  }

  static async getPharmacy(userId: string): Promise<PharmacyRow | null> {
    const { data, error } = await supabase.from('pharmacies').select('*').eq('user_id', userId).maybeSingle();
    if (error) throw error;
    return data;
  }

  /** Returns the private verification row, creating it from signup metadata if missing. */
  static async ensureVerification(
    pharmacy: PharmacyRow,
    user: { id: string; email?: string | null; user_metadata?: Record<string, unknown> },
  ): Promise<PharmacyVerificationRow> {
    const { data: existing, error } = await supabase
      .from('pharmacy_verification')
      .select('*')
      .eq('pharmacy_id', pharmacy.id)
      .maybeSingle();
    if (error) throw error;
    if (existing) return existing;

    const meta = user.user_metadata ?? {};
    const fullName = [meta.first_name, meta.last_name].filter((x): x is string => typeof x === 'string' && !!x).join(' ').trim();
    const { data: created, error: insErr } = await supabase
      .from('pharmacy_verification')
      .insert({
        pharmacy_id: pharmacy.id,
        user_id: user.id,
        contact_person_name: fullName || null,
        contact_person_phone: typeof meta.phone === 'string' && meta.phone ? meta.phone : null,
        contact_person_email: user.email ?? null,
        marketing_opt_in: !!meta.marketing_opt_in,
        ...(meta.terms_accepted ? { terms_accepted_at: new Date().toISOString(), terms_version: 'v1' } : {}),
      })
      .select('*')
      .single();
    if (insErr) throw insErr;
    return created;
  }

  static async savePharmacy(pharmacyId: string, patch: Database['public']['Tables']['pharmacies']['Update']) {
    const { error } = await supabase.from('pharmacies').update(patch).eq('id', pharmacyId);
    if (error) throw error;
  }

  static async saveVerification(
    pharmacyId: string,
    patch: Database['public']['Tables']['pharmacy_verification']['Update'],
  ) {
    const { error } = await supabase.from('pharmacy_verification').update(patch).eq('pharmacy_id', pharmacyId);
    if (error) throw error;
  }

  static async listDocuments(pharmacyId: string): Promise<PharmacyDocumentRow[]> {
    const { data, error } = await supabase.from('pharmacy_documents').select('*').eq('pharmacy_id', pharmacyId);
    if (error) throw error;
    return data ?? [];
  }

  static validateFile(file: File, docType: DocType | 'logo'): string | null {
    if (file.size > MAX_FILE_BYTES) return 'File is larger than 5MB.';
    const allowed = docType === 'logo' || IMAGE_ONLY_DOCS.includes(docType as DocType) ? IMG_MIME : DOC_MIME;
    if (!allowed.includes(file.type)) {
      return allowed === IMG_MIME ? 'Only JPG, PNG or WEBP images are allowed.' : 'Only PDF, JPG, PNG or WEBP files are allowed.';
    }
    return null;
  }

  static async uploadDocument(params: { pharmacyId: string; userId: string; docType: DocType; file: File }) {
    const { pharmacyId, userId, docType, file } = params;
    const err = this.validateFile(file, docType);
    if (err) throw new Error(err);
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const path = `${userId}/${docType}/${Date.now()}-${safeName}`;
    const { error: upErr } = await supabase.storage.from('pharmacy-docs').upload(path, file, {
      contentType: file.type,
      upsert: false,
    });
    if (upErr) throw upErr;
    const { error } = await supabase.from('pharmacy_documents').upsert(
      {
        pharmacy_id: pharmacyId,
        user_id: userId,
        doc_type: docType,
        storage_path: path,
        file_name: file.name,
        mime_type: file.type,
        size_bytes: file.size,
      },
      { onConflict: 'pharmacy_id,doc_type' },
    );
    if (error) {
      await supabase.storage.from('pharmacy-docs').remove([path]);
      throw error;
    }
  }

  static async uploadLogo(pharmacyId: string, userId: string, file: File): Promise<string> {
    const err = this.validateFile(file, 'logo');
    if (err) throw new Error(err);
    const ext = (file.name.split('.').pop() || 'png').toLowerCase();
    const path = `${userId}/logo.${ext}`;
    const { error } = await supabase.storage.from('pharmacy-logos').upload(path, file, {
      contentType: file.type,
      upsert: true,
    });
    if (error) throw error;
    const { data } = supabase.storage.from('pharmacy-logos').getPublicUrl(path);
    const url = `${data.publicUrl}?v=${Date.now()}`;
    await this.savePharmacy(pharmacyId, { logo_url: url });
    return url;
  }

  static async signedUrl(path: string, seconds = 300): Promise<string | null> {
    const { data, error } = await supabase.storage.from('pharmacy-docs').createSignedUrl(path, seconds);
    if (error) return null;
    return data.signedUrl;
  }

  static async deleteDocument(doc: PharmacyDocumentRow) {
    const { error } = await supabase.from('pharmacy_documents').delete().eq('id', doc.id);
    if (error) throw error;
    await supabase.storage.from('pharmacy-docs').remove([doc.storage_path]);
  }

  static async submit(): Promise<{ ok: boolean; missing: string[] }> {
    const { data, error } = await supabase.rpc('pharmacy_submit_application');
    if (error) throw error;
    const res = data as unknown as { ok: boolean; missing?: string[] };
    return { ok: !!res.ok, missing: res.missing ?? [] };
  }

  static async listEvents(pharmacyId: string): Promise<PharmacyEventRow[]> {
    const { data, error } = await supabase
      .from('pharmacy_review_events')
      .select('*')
      .eq('pharmacy_id', pharmacyId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data ?? [];
  }
}

export const daysUntil = (date?: string | null): number | null => {
  if (!date) return null;
  const ms = new Date(date + 'T00:00:00').getTime() - new Date(new Date().toDateString()).getTime();
  return Math.round(ms / 86400000);
};
