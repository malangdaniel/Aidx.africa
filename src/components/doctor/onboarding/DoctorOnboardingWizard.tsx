import { useCallback, useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  Loader2,
  ChevronLeft,
  ChevronRight,
  Send,
  AlertTriangle,
  XCircle,
  FileText,
  ShieldCheck,
  CheckCircle2,
  User,
  GraduationCap,
  Stethoscope,
  Calendar,
  Lock,
} from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import {
  DoctorOnboardingService,
  DOCTOR_DOC_LABELS,
  REQUIRED_DOCTOR_DOCS,
  type DoctorDocType,
  type DoctorUploadedDoc,
  type DoctorApplicationStatus,
} from '@/services/DoctorOnboardingService';
import { DoctorBasicInfo } from '@/components/doctor/settings/DoctorBasicInfo';
import { DoctorCredentials } from '@/components/doctor/settings/DoctorCredentials';
import { DoctorExpertise } from '@/components/doctor/settings/DoctorExpertise';
import { DoctorAvailability } from '@/components/doctor/settings/DoctorAvailability';
import { DoctorDocumentUploader } from './DoctorDocumentUploader';
import {
  getDefaultBasicInfo,
  getDefaultCredentials,
  getDefaultExpertise,
  getDefaultAvailability,
  type DoctorBasicInfoData,
  type DoctorCredentialsData,
  type DoctorExpertiseData,
  type DoctorAvailabilityData,
} from '@/components/doctor/settings/DoctorProfileSettings';

const STEPS = [
  { id: 1, title: 'Basic Identification', short: 'Basic', desc: 'Your professional identity, title, bio, and license registration', icon: User },
  { id: 2, title: 'Credentials & Qualifications', short: 'Credentials', desc: 'Degrees, medical specialty, experience, and affiliations', icon: GraduationCap },
  { id: 3, title: 'Areas of Expertise', short: 'Expertise', desc: 'Conditions treated, clinical interests, and patient age groups', icon: Stethoscope },
  { id: 4, title: 'Consultation & Availability', short: 'Availability', desc: 'Consultation modes, working schedule, and appointment fees', icon: Calendar },
  { id: 5, title: 'Document Verification', short: 'Documents', desc: 'Upload your medical practicing license and government ID', icon: FileText },
  { id: 6, title: 'Review & Declaration', short: 'Submit', desc: 'Review your credentials and submit for medical board verification', icon: ShieldCheck },
] as const;

interface DoctorOnboardingWizardProps {
  status: DoctorApplicationStatus;
  onSubmitted: () => void | Promise<void>;
}

export default function DoctorOnboardingWizard({ status, onSubmitted }: DoctorOnboardingWizardProps) {
  const { user, profile, refetchProfile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [step, setStep] = useState(1);

  // Form states
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [basicInfo, setBasicInfo] = useState<DoctorBasicInfoData>(getDefaultBasicInfo());
  const [credentials, setCredentials] = useState<DoctorCredentialsData>(getDefaultCredentials());
  const [expertise, setExpertise] = useState<DoctorExpertiseData>(getDefaultExpertise());
  const [availability, setAvailability] = useState<DoctorAvailabilityData>(getDefaultAvailability());
  const [documents, setDocuments] = useState<DoctorUploadedDoc[]>([]);
  const [declarationAccepted, setDeclarationAccepted] = useState(false);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);

  // Load existing profile & metadata
  const loadData = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const data = await DoctorOnboardingService.loadDoctorData(user.id, profile);

      if (profile) {
        setFirstName(profile.first_name || '');
        setLastName(profile.last_name || '');
        setPhone(profile.phone || '');
      }

      if (data.doctorProfile) {
        const dp = data.doctorProfile;
        if (dp.basicInfo) setBasicInfo((prev) => ({ ...prev, ...dp.basicInfo }));
        if (dp.credentials) setCredentials((prev) => ({ ...prev, ...dp.credentials }));
        if (dp.expertise) setExpertise((prev) => ({ ...prev, ...dp.expertise }));
        if (dp.availability) setAvailability((prev) => ({ ...prev, ...dp.availability }));
      }

      // If doctors table already has license_number or specialties
      if (data.doctorTableData) {
        const dt = data.doctorTableData;
        if (dt.license_number) {
          setBasicInfo((prev) => ({ ...prev, registrationNumber: dt.license_number }));
        }
        if (dt.specialties?.[0]) {
          setCredentials((prev) => ({ ...prev, specialty: dt.specialties[0] }));
        }
        if (dt.consult_price) {
          setAvailability((prev) => ({ ...prev, consultPrice: String(dt.consult_price) }));
        }
        if (dt.bio) {
          setBasicInfo((prev) => ({ ...prev, about: prev.about || dt.bio }));
        }
      }

      setDocuments(data.documents);
    } catch (err) {
      console.error('Error loading doctor onboarding data:', err);
      toast.error('Could not load existing application details.');
    } finally {
      setLoading(false);
    }
  }, [user, profile]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleBasicInfoChange = (field: string, value: any) => {
    setBasicInfo((prev) => ({ ...prev, [field]: value }));
  };

  const handleCredentialsChange = (field: string, value: any) => {
    setCredentials((prev) => ({ ...prev, [field]: value }));
  };

  const handleExpertiseChange = (field: string, value: any) => {
    setExpertise((prev) => ({ ...prev, [field]: value }));
  };

  const handleAvailabilityChange = (field: string, value: any) => {
    setAvailability((prev) => ({ ...prev, [field]: value }));
  };

  // Validate individual steps
  const validateCurrentStep = (stepNumber: number): boolean => {
    if (stepNumber === 1) {
      if (!firstName.trim()) {
        toast.error('First name is required');
        return false;
      }
      if (!lastName.trim()) {
        toast.error('Last name is required');
        return false;
      }
      if (!basicInfo.professionalTitle?.trim()) {
        toast.error('Please select your professional title');
        return false;
      }
      if (!basicInfo.registrationNumber?.trim()) {
        toast.error('Medical registration number (MDCN or equivalent) is required');
        return false;
      }
      if (!basicInfo.licensingAuthority?.trim()) {
        toast.error('Please select your licensing authority');
        return false;
      }
    } else if (stepNumber === 2) {
      if (!credentials.primaryDegree?.trim()) {
        toast.error('Please select your primary medical degree (e.g. MBBS, MD)');
        return false;
      }
      if (!credentials.specialty?.trim()) {
        toast.error('Please select your primary medical specialty');
        return false;
      }
    } else if (stepNumber === 4) {
      if (!availability.consultPrice || isNaN(Number(availability.consultPrice)) || Number(availability.consultPrice) < 0) {
        toast.error('Please set a valid consultation price in ₦');
        return false;
      }
      if (availability.consultationModes.length === 0) {
        toast.error('Please select at least one consultation mode (Chat, Voice, or Video)');
        return false;
      }
      if (availability.availableDays.length === 0) {
        toast.error('Please select at least one available day of the week');
        return false;
      }
    } else if (stepNumber === 5) {
      const hasLicense = documents.some((d) => d.docType === 'medical_license');
      if (!hasLicense) {
        toast.error('Please upload your Medical Practicing License document before continuing');
        return false;
      }
      const hasId = documents.some((d) => d.docType === 'government_id');
      if (!hasId) {
        toast.error('Please upload your Government-Issued ID document before continuing');
        return false;
      }
    }
    return true;
  };

  // Save draft and advance to next step
  const handleNext = async () => {
    if (!validateCurrentStep(step)) return;

    if (user) {
      setSaving(true);
      try {
        await DoctorOnboardingService.saveDraft(user.id, {
          firstName,
          lastName,
          phone,
          basicInfo,
          credentials,
          expertise,
          availability,
        });
      } catch (e) {
        console.warn('Could not auto-save draft:', e);
      } finally {
        setSaving(false);
      }
    }

    setStep((s) => Math.min(6, s + 1));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleBack = () => {
    setStep((s) => Math.max(1, s - 1));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Submit complete application
  const handleSubmit = async () => {
    if (!user) return;

    if (!declarationAccepted) {
      toast.error('You must agree to the clinical declaration to submit your application');
      return;
    }

    setSubmitting(true);
    setValidationErrors([]);

    try {
      const result = await DoctorOnboardingService.submitApplication(user.id, {
        firstName,
        lastName,
        phone,
        basicInfo,
        credentials,
        expertise,
        availability,
        documents,
        declarationAccepted,
      });

      if (!result.ok) {
        setValidationErrors(result.missing);
        toast.error('Please complete all required fields before submitting.');
        return;
      }

      await refetchProfile();
      toast.success('Your medical application has been submitted for review!');
      await onSubmitted();
    } catch (error: any) {
      console.error('Error submitting doctor onboarding application:', error);
      toast.error(error.message || 'Failed to submit application. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 space-y-3">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
        <p className="text-xs text-muted-foreground">Loading credentialing application...</p>
      </div>
    );
  }

  const currentStepInfo = STEPS[step - 1];

  return (
    <div className="max-w-3xl mx-auto space-y-6 py-4 px-4 sm:px-6">
      {/* Rejection Alert if returning after rejection */}
      {status.verification_status === 'rejected' && (
        <Alert variant="destructive" className="border-destructive/40 bg-destructive/5">
          <XCircle className="h-4 w-4" />
          <AlertTitle className="font-bold">Application Returned for Revision</AlertTitle>
          <AlertDescription className="text-xs mt-1 leading-relaxed">
            {status.rejection_reason || 'Please review your credentials, correct the identified discrepancies, and resubmit for verification.'}
          </AlertDescription>
        </Alert>
      )}

      {/* Header Banner */}
      <div className="rounded-2xl bg-gradient-to-r from-primary/10 via-primary/5 to-secondary/10 border border-primary/20 p-5 sm:p-6 space-y-2">
        <div className="flex items-center gap-2 text-primary font-semibold text-xs tracking-wide uppercase">
          <Stethoscope className="w-4 h-4" />
          Doctor Credentialing & Verification
        </div>
        <h1 className="text-xl sm:text-2xl font-bold text-foreground">
          Welcome to Sanari AI Medical Network
        </h1>
        <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
          Complete the 6 simple steps below to register your medical practice, set your consultation availability, and upload your practicing license for verification.
        </p>
      </div>

      {/* Progress & Stepper */}
      <div className="space-y-2.5 bg-card rounded-xl border p-4">
        <div className="flex justify-between items-center text-xs">
          <span className="font-semibold text-foreground">
            Step {step} of {STEPS.length}: <span className="text-primary font-bold">{currentStepInfo.title}</span>
          </span>
          <span className="text-muted-foreground font-mono font-medium">
            {Math.round((step / STEPS.length) * 100)}% Complete
          </span>
        </div>
        <Progress value={(step / STEPS.length) * 100} className="h-2 rounded-full" />

        {/* Stepper buttons (clickable for visited steps) */}
        <div className="hidden sm:grid grid-cols-6 gap-1 pt-2">
          {STEPS.map((s) => {
            const isCurrent = s.id === step;
            const isCompleted = s.id < step;
            const StepIcon = s.icon;
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => {
                  if (s.id < step || validateCurrentStep(step)) {
                    setStep(s.id);
                  }
                }}
                className={`flex flex-col items-center gap-1 p-1.5 rounded-lg text-center transition-all ${
                  isCurrent
                    ? 'bg-primary/10 text-primary font-bold ring-1 ring-primary/30'
                    : isCompleted
                    ? 'text-foreground hover:bg-muted font-medium'
                    : 'text-muted-foreground opacity-60'
                }`}
              >
                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] ${
                  isCurrent
                    ? 'bg-primary text-primary-foreground font-bold'
                    : isCompleted
                    ? 'bg-emerald-600 text-white font-bold'
                    : 'bg-muted text-muted-foreground'
                }`}>
                  {isCompleted ? '✓' : s.id}
                </div>
                <span className="text-[10px] truncate max-w-full">{s.short}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Step Card */}
      <Card className="border shadow-sm">
        <CardHeader className="pb-4 border-b">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
              <currentStepInfo.icon className="w-4 h-4" />
            </div>
            <div>
              <CardTitle className="text-base sm:text-lg font-bold">{currentStepInfo.title}</CardTitle>
              <CardDescription className="text-xs">{currentStepInfo.desc}</CardDescription>
            </div>
          </div>
        </CardHeader>

        <CardContent className="pt-6 space-y-6">
          {/* STEP 1: BASIC IDENTIFICATION */}
          {step === 1 && (
            <div className="space-y-4">
              <DoctorBasicInfo
                data={basicInfo}
                firstName={firstName}
                lastName={lastName}
                onFirstNameChange={setFirstName}
                onLastNameChange={setLastName}
                onChange={handleBasicInfoChange}
              />
            </div>
          )}

          {/* STEP 2: CREDENTIALS */}
          {step === 2 && (
            <div className="space-y-4">
              <DoctorCredentials
                data={credentials}
                onChange={handleCredentialsChange}
              />
            </div>
          )}

          {/* STEP 3: EXPERTISE */}
          {step === 3 && (
            <div className="space-y-4">
              <DoctorExpertise
                data={expertise}
                onChange={handleExpertiseChange}
              />
            </div>
          )}

          {/* STEP 4: AVAILABILITY & FEES */}
          {step === 4 && (
            <div className="space-y-4">
              <DoctorAvailability
                data={availability}
                onChange={handleAvailabilityChange}
              />
            </div>
          )}

          {/* STEP 5: DOCUMENTS UPLOAD */}
          {step === 5 && (
            <div className="space-y-4">
              <div className="rounded-lg bg-primary/5 border border-primary/20 p-3 text-xs text-muted-foreground space-y-1">
                <p className="font-semibold text-foreground flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-primary" />
                  Statutory Licensing & Identity Verification
                </p>
                <p className="leading-relaxed">
                  In compliance with telemedicine regulations and MDCN guidelines, all practitioners must provide an authentic copy of their current practicing license and a verified government photo ID.
                </p>
              </div>

              <div className="space-y-3">
                <DoctorDocumentUploader
                  docType="medical_license"
                  doc={documents.find((d) => d.docType === 'medical_license')}
                  userId={user!.id}
                  required
                  currentDocs={documents}
                  onDocUpdated={setDocuments}
                />

                <DoctorDocumentUploader
                  docType="government_id"
                  doc={documents.find((d) => d.docType === 'government_id')}
                  userId={user!.id}
                  required
                  currentDocs={documents}
                  onDocUpdated={setDocuments}
                />

                <DoctorDocumentUploader
                  docType="degree_certificate"
                  doc={documents.find((d) => d.docType === 'degree_certificate')}
                  userId={user!.id}
                  currentDocs={documents}
                  onDocUpdated={setDocuments}
                />

                <DoctorDocumentUploader
                  docType="fellowship_certificate"
                  doc={documents.find((d) => d.docType === 'fellowship_certificate')}
                  userId={user!.id}
                  currentDocs={documents}
                  onDocUpdated={setDocuments}
                />
              </div>
            </div>
          )}

          {/* STEP 6: REVIEW & DECLARATION */}
          {step === 6 && (
            <div className="space-y-6">
              {validationErrors.length > 0 && (
                <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertTitle>Please address the following:</AlertTitle>
                  <AlertDescription>
                    <ul className="list-disc pl-4 mt-1 space-y-0.5 text-xs">
                      {validationErrors.map((err, i) => (
                        <li key={i}>{err}</li>
                      ))}
                    </ul>
                  </AlertDescription>
                </Alert>
              )}

              {/* Summary Cards */}
              <DoctorReviewSummary
                firstName={firstName}
                lastName={lastName}
                basicInfo={basicInfo}
                credentials={credentials}
                expertise={expertise}
                availability={availability}
                documents={documents}
                onGoToStep={setStep}
              />

              {/* Ethical & Statutory Declaration */}
              <div className="rounded-xl border bg-muted/30 p-4 space-y-3">
                <h4 className="font-semibold text-sm text-foreground flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-primary" />
                  Clinical Practitioner Declaration & Agreement
                </h4>

                <div className="flex items-start gap-3 pt-1">
                  <Checkbox
                    id="declaration"
                    checked={declarationAccepted}
                    onCheckedChange={(c) => setDeclarationAccepted(!!c)}
                    className="mt-0.5"
                  />
                  <Label htmlFor="declaration" className="text-xs leading-relaxed font-normal text-muted-foreground cursor-pointer">
                    I solemnly affirm that I am a duly licensed medical practitioner in good standing with the <strong className="text-foreground">{basicInfo.licensingAuthority || 'relevant medical licensing body'}</strong>. I confirm that all submitted details and credentials are authentic and accurate. I agree to uphold Sanari AI’s clinical practice ethics, patient data confidentiality protocols, and telemedicine terms of service. <span className="text-destructive font-bold">*</span>
                  </Label>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Navigation Footer */}
      <div className="flex items-center justify-between pt-2">
        <Button
          type="button"
          variant="outline"
          onClick={handleBack}
          disabled={step === 1 || saving || submitting}
          className="gap-1.5 text-xs"
        >
          <ChevronLeft className="w-4 h-4" />
          Back
        </Button>

        {step < 6 ? (
          <Button
            type="button"
            onClick={handleNext}
            disabled={saving}
            className="gap-1.5 text-xs font-semibold"
          >
            {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            Save & Continue
            <ChevronRight className="w-4 h-4" />
          </Button>
        ) : (
          <Button
            type="button"
            onClick={handleSubmit}
            disabled={submitting || !declarationAccepted}
            className="gap-2 text-xs font-bold bg-primary hover:bg-primary/90 text-primary-foreground shadow-md"
          >
            {submitting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
            Submit Application for Review
          </Button>
        )}
      </div>
    </div>
  );
}

// Sub-component for Review Step
interface SummaryProps {
  firstName: string;
  lastName: string;
  basicInfo: DoctorBasicInfoData;
  credentials: DoctorCredentialsData;
  expertise: DoctorExpertiseData;
  availability: DoctorAvailabilityData;
  documents: DoctorUploadedDoc[];
  onGoToStep: (stepNumber: number) => void;
}

function DoctorReviewSummary({
  firstName,
  lastName,
  basicInfo,
  credentials,
  expertise,
  availability,
  documents,
  onGoToStep,
}: SummaryProps) {
  const Row = ({ label, value }: { label: string; value?: string | null }) => (
    <div className="flex justify-between gap-3 text-xs py-1">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium text-right text-foreground break-words">
        {value?.trim() ? value : <span className="text-destructive">Not provided</span>}
      </span>
    </div>
  );

  const SectionBlock = ({
    title,
    stepNum,
    children,
  }: {
    title: string;
    stepNum: number;
    children: React.ReactNode;
  }) => (
    <div className="rounded-xl border bg-card p-3.5 space-y-2">
      <div className="flex items-center justify-between border-b pb-2">
        <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{title}</h4>
        <Button
          type="button"
          variant="link"
          size="sm"
          className="h-auto p-0 text-xs text-primary font-medium"
          onClick={() => onGoToStep(stepNum)}
        >
          Edit
        </Button>
      </div>
      <div className="divide-y divide-border/40">{children}</div>
    </div>
  );

  return (
    <div className="space-y-3">
      {/* Basic Info */}
      <SectionBlock title="1. Identification & License" stepNum={1}>
        <Row label="Full Name" value={`${basicInfo.professionalTitle || 'Dr.'} ${firstName} ${lastName}`} />
        <Row label="Medical Reg Number" value={basicInfo.registrationNumber} />
        <Row label="Licensing Authority" value={basicInfo.licensingAuthority} />
        <Row label="Graduation Year" value={basicInfo.yearOfGraduation} />
        <Row label="Country & City" value={[basicInfo.city, basicInfo.country].filter(Boolean).join(', ')} />
        <Row label="Languages" value={basicInfo.languages?.join(', ')} />
      </SectionBlock>

      {/* Credentials */}
      <SectionBlock title="2. Medical Credentials" stepNum={2}>
        <Row label="Primary Degree" value={credentials.primaryDegree} />
        <Row label="Primary Specialty" value={credentials.specialty} />
        <Row label="Sub-Specialty" value={credentials.subSpecialty || 'None specified'} />
        <Row label="Experience" value={credentials.yearsExperience ? `${credentials.yearsExperience} years` : ''} />
        <Row label="Current Affiliations" value={credentials.currentAffiliations?.join(', ') || 'Private Practice'} />
      </SectionBlock>

      {/* Expertise */}
      <SectionBlock title="3. Clinical Areas of Expertise" stepNum={3}>
        <Row label="Conditions Treated" value={expertise.conditionsTreated?.slice(0, 5).join(', ') + (expertise.conditionsTreated?.length > 5 ? ` +${expertise.conditionsTreated.length - 5} more` : '')} />
        <Row label="Clinical Interests" value={expertise.clinicalInterests?.join(', ')} />
        <Row label="Age Groups" value={expertise.ageGroups?.join(', ')} />
      </SectionBlock>

      {/* Availability */}
      <SectionBlock title="4. Consultation & Fees" stepNum={4}>
        <Row label="Consultation Fee" value={availability.consultPrice ? `₦${Number(availability.consultPrice).toLocaleString()}` : ''} />
        <Row label="Consultation Modes" value={availability.consultationModes?.map((m) => m.toUpperCase()).join(', ')} />
        <Row label="Available Days" value={availability.availableDays?.map((d) => d.charAt(0).toUpperCase() + d.slice(1)).join(', ')} />
        <Row label="Working Hours" value={`${availability.workingHoursStart} - ${availability.workingHoursEnd} (${availability.timezone})`} />
      </SectionBlock>

      {/* Documents */}
      <SectionBlock title="5. Uploaded Documents" stepNum={5}>
        {REQUIRED_DOCTOR_DOCS.map((docType) => {
          const doc = documents.find((d) => d.docType === docType);
          return (
            <Row
              key={docType}
              label={DOCTOR_DOC_LABELS[docType]}
              value={doc ? `Uploaded (${doc.fileName})` : ''}
            />
          );
        })}
      </SectionBlock>
    </div>
  );
}

