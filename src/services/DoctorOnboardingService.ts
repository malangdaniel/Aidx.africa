import { supabase } from '@/integrations/supabase/client';
import type {
  DoctorBasicInfoData,
  DoctorCredentialsData,
  DoctorExpertiseData,
  DoctorAvailabilityData,
} from '@/components/doctor/settings/DoctorProfileSettings';

export type DoctorDocType =
  | 'medical_license'
  | 'government_id'
  | 'degree_certificate'
  | 'fellowship_certificate';

export const DOCTOR_DOC_LABELS: Record<DoctorDocType, string> = {
  medical_license: 'Medical Practicing License (MDCN / Authority)',
  government_id: 'Government-Issued Photo ID (Passport / NIN / Driver’s License)',
  degree_certificate: 'Primary Medical Degree Certificate (MBBS / MD)',
  fellowship_certificate: 'Fellowship / Specialist Board Certificate (Optional)',
};

export const REQUIRED_DOCTOR_DOCS: DoctorDocType[] = [
  'medical_license',
  'government_id',
];

export interface DoctorUploadedDoc {
  docType: DoctorDocType;
  fileName: string;
  storagePath: string;
  sizeBytes: number;
  uploadedAt: string;
}

export interface DoctorApplicationStatus {
  has_profile: boolean;
  verification_status: 'pending' | 'verified' | 'rejected';
  profile_status: 'draft' | 'submitted';
  is_suspended?: boolean;
  suspended_reason?: string | null;
  rejection_reason?: string | null;
  submitted_at?: string | null;
  resubmitted_at?: string | null;
  is_resubmission?: boolean;
  missing?: string[];
}

export interface DoctorOnboardingData {
  firstName: string;
  lastName: string;
  phone: string;
  basicInfo: DoctorBasicInfoData;
  credentials: DoctorCredentialsData;
  expertise: DoctorExpertiseData;
  availability: DoctorAvailabilityData;
  documents: DoctorUploadedDoc[];
  declarationAccepted: boolean;
}

export const MAX_DOC_BYTES = 5 * 1024 * 1024; // 5MB
const ALLOWED_MIME = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];

export class DoctorOnboardingService {
  /**
   * Determine the current onboarding and verification status of a doctor.
   */
  static async getStatus(user: any, profile: any): Promise<DoctorApplicationStatus> {
    if (!user || !profile) {
      return {
        has_profile: false,
        verification_status: 'pending',
        profile_status: 'draft',
      };
    }

    const verificationStatus = (profile.verification_status as 'pending' | 'verified' | 'rejected') || 'pending';
    const metadata = (profile.metadata as Record<string, any>) || {};
    const onboardingMeta = metadata.doctor_onboarding || {};
    const isSuspended = !!metadata.is_suspended;
    const suspendedReason = metadata.suspended_reason || null;
    const rejectionReason = profile.rejection_reason || null;

    // Check if the doctor record already exists in doctors table
    const { data: doctorData } = await supabase
      .from('doctors')
      .select('license_number')
      .eq('user_id', user.id)
      .maybeSingle();

    // If verified in profile, they are approved
    if (verificationStatus === 'verified') {
      return {
        has_profile: true,
        verification_status: 'verified',
        profile_status: 'submitted',
        is_suspended: isSuspended,
        suspended_reason: suspendedReason,
        submitted_at: onboardingMeta.submitted_at || null,
      };
    }

    // If rejected, check if the doctor has resubmitted their corrections
    if (verificationStatus === 'rejected') {
      const isResubmitted =
        onboardingMeta.profile_status === 'submitted' &&
        (onboardingMeta.resubmitted_after_rejection === true ||
          (onboardingMeta.resubmitted_at &&
            new Date(onboardingMeta.resubmitted_at) > new Date(profile.updated_at || profile.created_at)));

      if (isResubmitted) {
        return {
          has_profile: true,
          verification_status: 'pending',
          profile_status: 'submitted',
          is_suspended: isSuspended,
          rejection_reason: rejectionReason,
          submitted_at: onboardingMeta.resubmitted_at || onboardingMeta.submitted_at || null,
          resubmitted_at: onboardingMeta.resubmitted_at || null,
          is_resubmission: true,
        };
      }

      return {
        has_profile: true,
        verification_status: 'rejected',
        profile_status: onboardingMeta.profile_status || 'draft',
        is_suspended: isSuspended,
        rejection_reason: rejectionReason,
        submitted_at: onboardingMeta.submitted_at || null,
      };
    }

    // If profile status is marked submitted or doctor record has license_number
    const isSubmitted = onboardingMeta.profile_status === 'submitted' || (doctorData?.license_number && onboardingMeta.profile_status !== 'draft');

    return {
      has_profile: true,
      verification_status: 'pending',
      profile_status: isSubmitted ? 'submitted' : 'draft',
      is_suspended: isSuspended,
      submitted_at: onboardingMeta.submitted_at || null,
    };
  }

  /**
   * Load existing onboarding data for doctor
   */
  static async loadDoctorData(userId: string, profile: any): Promise<{
    doctorProfile?: any;
    documents: DoctorUploadedDoc[];
    onboardingMeta?: any;
    doctorTableData?: any;
  }> {
    const metadata = (profile?.metadata as Record<string, any>) || {};
    const doctorProfile = metadata.doctorProfile || null;
    const onboardingMeta = metadata.doctor_onboarding || null;
    const docsInMeta: DoctorUploadedDoc[] = metadata.doctor_documents || [];

    // Also query files from ids bucket for redundancy
    let liveDocs: DoctorUploadedDoc[] = [...docsInMeta];
    try {
      const { data: storageFiles } = await supabase.storage.from('ids').list(userId, { limit: 50 });
      if (storageFiles && storageFiles.length > 0) {
        for (const file of storageFiles) {
          if (!file.name || file.name.startsWith('.')) continue;

          // Check if already in liveDocs
          const alreadyTracked = liveDocs.some(
            (d) => d.storagePath === `${userId}/${file.name}` || d.fileName === file.name
          );

          if (!alreadyTracked) {
            let docType: DoctorDocType = 'medical_license';
            if (file.name.includes('id') || file.name.includes('passport')) docType = 'government_id';
            else if (file.name.includes('degree')) docType = 'degree_certificate';
            else if (file.name.includes('fellowship')) docType = 'fellowship_certificate';

            liveDocs.push({
              docType,
              fileName: file.name,
              storagePath: `${userId}/${file.name}`,
              sizeBytes: (file.metadata as any)?.size || 0,
              uploadedAt: file.created_at || new Date().toISOString(),
            });
          }
        }
      }
    } catch (err) {
      console.warn('Could not list ids storage files:', err);
    }

    const { data: doctorTableData } = await supabase
      .from('doctors')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    return {
      doctorProfile,
      documents: liveDocs,
      onboardingMeta,
      doctorTableData,
    };
  }

  /**
   * Upload verification document to storage bucket 'ids'
   */
  static async uploadDocument(params: {
    userId: string;
    docType: DoctorDocType;
    file: File;
    currentDocs: DoctorUploadedDoc[];
  }): Promise<DoctorUploadedDoc> {
    const { userId, docType, file, currentDocs } = params;

    if (file.size > MAX_DOC_BYTES) {
      throw new Error('File exceeds maximum size limit of 5MB.');
    }

    if (!ALLOWED_MIME.includes(file.type)) {
      throw new Error('Only PDF, JPG, PNG or WEBP documents are supported.');
    }

    const ext = (file.name.split('.').pop() || 'pdf').toLowerCase();
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');

    // Convention:
    // Medical license -> `${userId}/license.${ext}` AND `${userId}/license`
    // Government ID -> `${userId}/id.${ext}` AND `${userId}/id`
    // Others -> `${userId}/${docType}_${safeName}`
    let storagePath = `${userId}/${docType}_${Date.now()}.${ext}`;
    if (docType === 'medical_license') {
      storagePath = `${userId}/license.${ext}`;
    } else if (docType === 'government_id') {
      storagePath = `${userId}/id.${ext}`;
    }

    const { error: uploadError } = await supabase.storage.from('ids').upload(storagePath, file, {
      contentType: file.type,
      upsert: true,
    });

    if (uploadError) {
      throw uploadError;
    }

    // Also upload extension-less copy for AdminVerificationTab compatibility if needed
    if (docType === 'medical_license') {
      await supabase.storage.from('ids').upload(`${userId}/license`, file, {
        contentType: file.type,
        upsert: true,
      }).catch(() => null);
    } else if (docType === 'government_id') {
      await supabase.storage.from('ids').upload(`${userId}/id`, file, {
        contentType: file.type,
        upsert: true,
      }).catch(() => null);
    }

    const newDoc: DoctorUploadedDoc = {
      docType,
      fileName: file.name,
      storagePath,
      sizeBytes: file.size,
      uploadedAt: new Date().toISOString(),
    };

    // Update metadata on profile
    const updatedDocs = [
      ...currentDocs.filter((d) => d.docType !== docType),
      newDoc,
    ];

    const { data: profile } = await supabase.from('profiles').select('metadata').eq('user_id', userId).single();
    if (profile) {
      await supabase.from('profiles').update({
        metadata: {
          ...((profile.metadata as Record<string, any>) || {}),
          doctor_documents: updatedDocs,
        },
      }).eq('user_id', userId);
    }

    return newDoc;
  }

  /**
   * Delete uploaded document from storage and metadata
   */
  static async deleteDocument(params: {
    userId: string;
    docType: DoctorDocType;
    storagePath: string;
    currentDocs: DoctorUploadedDoc[];
  }): Promise<DoctorUploadedDoc[]> {
    const { userId, docType, storagePath, currentDocs } = params;

    await supabase.storage.from('ids').remove([storagePath]).catch(console.warn);

    const updatedDocs = currentDocs.filter((d) => d.storagePath !== storagePath && d.docType !== docType);

    const { data: profile } = await supabase.from('profiles').select('metadata').eq('user_id', userId).single();
    if (profile) {
      await supabase.from('profiles').update({
        metadata: {
          ...((profile.metadata as Record<string, any>) || {}),
          doctor_documents: updatedDocs,
        },
      }).eq('user_id', userId);
    }

    return updatedDocs;
  }

  /**
   * Generate signed URL to view private document
   */
  static async getSignedUrl(storagePath: string): Promise<string | null> {
    try {
      const { data, error } = await supabase.storage.from('ids').createSignedUrl(storagePath, 3600);
      if (error) throw error;
      return data?.signedUrl || null;
    } catch (err) {
      console.error('Error getting signed URL for document:', err);
      return null;
    }
  }

  /**
   * Save draft onboarding progress without submitting for review
   */
  static async saveDraft(userId: string, data: Partial<DoctorOnboardingData>): Promise<void> {
    const { data: profile } = await supabase.from('profiles').select('metadata').eq('user_id', userId).single();
    const existingMeta = (profile?.metadata as Record<string, any>) || {};

    const doctorProfile = {
      basicInfo: data.basicInfo,
      credentials: data.credentials,
      expertise: data.expertise,
      availability: data.availability,
    };

    await supabase.from('profiles').update({
      first_name: data.firstName,
      last_name: data.lastName,
      phone: data.phone,
      updated_at: new Date().toISOString(),
      metadata: {
        ...existingMeta,
        doctorProfile,
        doctor_onboarding: {
          ...(existingMeta.doctor_onboarding || {}),
          profile_status: 'draft',
          last_saved_at: new Date().toISOString(),
        },
      },
    }).eq('user_id', userId);
  }

  /**
   * Final submission: validate required fields, save profile & doctor record, and set submitted status
   */
  static async submitApplication(userId: string, data: DoctorOnboardingData): Promise<{ ok: boolean; missing: string[] }> {
    const missing: string[] = [];

    // Validation
    if (!data.firstName?.trim()) missing.push('First name is required');
    if (!data.lastName?.trim()) missing.push('Last name is required');
    if (!data.basicInfo.professionalTitle?.trim()) missing.push('Professional title is required');
    if (!data.basicInfo.registrationNumber?.trim()) missing.push('Medical Registration Number (MDCN / Authority) is required');
    if (!data.basicInfo.licensingAuthority?.trim()) missing.push('Licensing authority is required');
    if (!data.credentials.primaryDegree?.trim()) missing.push('Primary medical degree is required');
    if (!data.credentials.specialty?.trim()) missing.push('Primary specialty is required');
    if (!data.availability.consultPrice || isNaN(Number(data.availability.consultPrice))) missing.push('Valid consultation fee is required');
    if (!data.declarationAccepted) missing.push('You must accept the clinical declaration and agreement to proceed');

    // Document validation
    const hasLicenseDoc = data.documents.some((d) => d.docType === 'medical_license');
    if (!hasLicenseDoc) missing.push('Medical Practicing License document must be uploaded');

    const hasIdDoc = data.documents.some((d) => d.docType === 'government_id');
    if (!hasIdDoc) missing.push('Government-issued ID document must be uploaded');

    if (missing.length > 0) {
      return { ok: false, missing };
    }

    const { data: profile } = await supabase.from('profiles').select('metadata, verification_status').eq('user_id', userId).single();
    const existingMeta = (profile?.metadata as Record<string, any>) || {};
    const isPriorRejection = profile?.verification_status === 'rejected';

    const doctorProfile = {
      basicInfo: data.basicInfo,
      credentials: data.credentials,
      expertise: data.expertise,
      availability: data.availability,
    };

    const nowIso = new Date().toISOString();

    // 1. Update profiles table safely without violating the trigger
    // Note: Database trigger 'guard_profiles_update' prohibits non-admin users from changing verification_status
    // or role directly. We preserve verification_status on the profiles table, and store the submission state
    // and resubmission timestamps in metadata.doctor_onboarding.
    const profileUpdatePayload: Record<string, any> = {
      first_name: data.firstName.trim(),
      last_name: data.lastName.trim(),
      phone: data.phone.trim() || null,
      updated_at: nowIso,
      metadata: {
        ...existingMeta,
        doctorProfile,
        doctor_documents: data.documents,
        doctor_onboarding: {
          profile_status: 'submitted',
          submitted_at: nowIso,
          declaration_accepted: true,
          declaration_accepted_at: nowIso,
          resubmitted_after_rejection: isPriorRejection,
          resubmitted_at: isPriorRejection ? nowIso : undefined,
        },
      },
    };

    const { error: profileError } = await supabase
      .from('profiles')
      .update(profileUpdatePayload)
      .eq('user_id', userId);

    if (profileError) throw profileError;

    // Attempt RPC call to doctor_submit_application if defined in PostgreSQL,
    // which has security definer rights to reset verification_status if needed.
    try {
      await supabase.rpc('doctor_submit_application');
    } catch (rpcErr) {
      // Non-fatal if the RPC is unavailable or has strict table prerequisites
      console.warn('doctor_submit_application RPC notice:', rpcErr);
    }

    // 2. Upsert into doctors table
    const { data: existingDoctor } = await supabase
      .from('doctors')
      .select('id')
      .eq('user_id', userId)
      .maybeSingle();

    const doctorTableData = {
      user_id: userId,
      license_number: data.basicInfo.registrationNumber.trim(),
      specialties: data.credentials.specialty ? [data.credentials.specialty] : [],
      consult_price: parseFloat(data.availability.consultPrice) || 0,
      bio: data.basicInfo.about?.trim()
        ? data.basicInfo.about.trim()
        : `${data.basicInfo.professionalTitle} ${data.firstName} ${data.lastName} - ${data.credentials.specialty || 'Medical Professional'}`,
      updated_at: new Date().toISOString(),
    };

    if (existingDoctor) {
      const { error: docError } = await supabase
        .from('doctors')
        .update(doctorTableData)
        .eq('id', existingDoctor.id);
      if (docError) throw docError;
    } else {
      const { error: docError } = await supabase
        .from('doctors')
        .insert(doctorTableData);
      if (docError) throw docError;
    }

    return { ok: true, missing: [] };
  }
}

