import { useCallback, useEffect, useRef, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Progress } from '@/components/ui/progress';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  Loader2, ChevronLeft, ChevronRight, Send, AlertTriangle, XCircle, Lock, Upload, FileText, ExternalLink, Trash2,
} from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { NIGERIA_STATES, citiesForState } from '@/lib/nigeriaLocations';
import {
  DoctorOnboardingService, DOCTOR_DOC_LABELS, DOCTOR_IMAGE_ONLY_DOCS, doctorMissingLabel, doctorStepForMissing, errMsg,
  type DoctorApplicationStatus, type DoctorDocType, type DoctorDocumentRow, type DoctorRow,
} from '@/services/DoctorOnboardingService';
import {
  doctorFormFromRows, doctorPatch, doctorVerificationPatch, validateDoctorSection,
  type DoctorForm, type DoctorSection,
} from './doctorForm';

const STEPS = [
  { title: 'Professional details', desc: 'Your medical license, specialty and experience' },
  { title: 'Practice & contact', desc: 'Where you practise and how we can reach you' },
  { title: 'Documents', desc: 'Upload your license, ID and a professional photo' },
  { title: 'Payout details', desc: 'The bank account your earnings are paid into' },
  { title: 'Review & submit', desc: 'Check everything before sending it for review' },
] as const;

const REQUIRED_DOCS: DoctorDocType[] = ['medical_license', 'government_id', 'profile_photo'];
const OPTIONAL_DOCS: DoctorDocType[] = ['degree_certificate'];

function Field({ label, required, hint, children }: { label: string; required?: boolean; hint?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{label} {required && <span className="text-destructive">*</span>}</Label>
      {children}
      {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

interface Props {
  status: DoctorApplicationStatus;
  onSubmitted: () => void;
}

export default function DoctorOnboardingWizard({ status, onSubmitted }: Props) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [step, setStep] = useState(1);
  const [doctor, setDoctor] = useState<DoctorRow | null>(null);
  const [form, setForm] = useState<DoctorForm | null>(null);
  const [docs, setDocs] = useState<DoctorDocumentRow[]>([]);
  const [missing, setMissing] = useState<string[]>([]);

  const locked = status.profile_status === 'submitted' && status.verification_status === 'pending';

  const load = useCallback(async () => {
    if (!user) return;
    try {
      const d = await DoctorOnboardingService.getDoctor(user.id);
      if (!d) throw new Error('No doctor record found for this account.');
      const v = await DoctorOnboardingService.ensureVerification(d, user);
      setDoctor(d);
      setForm(doctorFormFromRows(d, v));
      setDocs(await DoctorOnboardingService.listDocuments(d.id));
    } catch (e) {
      toast.error(errMsg(e, 'Could not load your application.'));
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => { load(); }, [load]);

  const reloadDocs = useCallback(async () => {
    if (doctor) setDocs(await DoctorOnboardingService.listDocuments(doctor.id));
  }, [doctor]);

  const set = useCallback(<K extends keyof DoctorForm>(key: K, value: DoctorForm[K]) => {
    setForm((f) => (f ? { ...f, [key]: value } : f));
  }, []);

  const saveStep = async (n: number): Promise<boolean> => {
    if (!doctor || !form || locked) return true;
    const sections: DoctorSection[][] = [['professional'], ['practice'], [], ['payout'], []];
    for (const s of sections[n - 1]) {
      const err = validateDoctorSection(form, s);
      if (err) { toast.error(err); return false; }
    }
    setSaving(true);
    try {
      for (const s of sections[n - 1]) {
        const dPatch = doctorPatch(form, s);
        const vPatch = doctorVerificationPatch(form, s);
        if (Object.keys(dPatch).length) await DoctorOnboardingService.saveDoctor(doctor.id, dPatch);
        if (Object.keys(vPatch).length) await DoctorOnboardingService.saveVerification(doctor.id, vPatch);
      }
      return true;
    } catch (e) {
      toast.error(errMsg(e, 'Could not save this step.'));
      return false;
    } finally {
      setSaving(false);
    }
  };

  const next = async () => { if (await saveStep(step)) setStep((s) => Math.min(STEPS.length, s + 1)); };
  const back = () => setStep((s) => Math.max(1, s - 1));

  const submit = async () => {
    if (!doctor || !form) return;
    setSubmitting(true);
    try {
      if (form.terms_accepted) {
        await DoctorOnboardingService.saveVerification(doctor.id, {
          terms_accepted_at: new Date().toISOString(), terms_version: 'v1',
        });
      }
      const res = await DoctorOnboardingService.submit();
      if (!res.ok) {
        setMissing(res.missing);
        setStep(Math.min(...res.missing.map(doctorStepForMissing)));
        toast.error('Some required information is still missing.');
        return;
      }
      toast.success('Application submitted for review.');
      onSubmitted();
    } catch (e) {
      toast.error(errMsg(e, 'Could not submit your application.'));
    } finally {
      setSubmitting(false);
    }
  };

  if (loading || !form || !doctor || !user) {
    return <div className="flex justify-center py-16"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
  }

  const current = STEPS[step - 1];
  const termsNeeded = !form.terms_accepted;
  const cities = citiesForState(form.state);
  const docFor = (t: DoctorDocType) => docs.find((d) => d.doc_type === t);

  return (
    <div className="space-y-4 max-w-3xl mx-auto">
      {step === 1 && !locked && status.profile_status === 'draft' && status.verification_status !== 'rejected' && (
        <Alert>
          <AlertTitle>Welcome, Doctor</AlertTitle>
          <AlertDescription>
            Complete your professional profile and submit it for approval. You'll get full access to consultations, patients and earnings once our team verifies your details.
          </AlertDescription>
        </Alert>
      )}
      {status.profile_status === 'needs_info' && (
        <Alert className="border-amber-300 bg-amber-50 text-amber-900">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>More information needed</AlertTitle>
          <AlertDescription>{status.latest_admin_message || 'Our team asked for additional information. Update your application and resubmit.'}</AlertDescription>
        </Alert>
      )}
      {status.verification_status === 'rejected' && (
        <Alert variant="destructive">
          <XCircle className="h-4 w-4" />
          <AlertTitle>Application rejected</AlertTitle>
          <AlertDescription>{status.rejection_reason || 'Please review your details, fix the issues and resubmit.'}</AlertDescription>
        </Alert>
      )}
      {locked && (
        <Alert>
          <Lock className="h-4 w-4" />
          <AlertTitle>Under review</AlertTitle>
          <AlertDescription>Your application is being reviewed and cannot be edited right now.</AlertDescription>
        </Alert>
      )}

      <div className="space-y-1.5">
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>Step {step} of {STEPS.length}</span>
          <span>{Math.round((step / STEPS.length) * 100)}%</span>
        </div>
        <Progress value={(step / STEPS.length) * 100} className="h-2" />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{current.title}</CardTitle>
          <CardDescription>{current.desc}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {step === 1 && (
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Medical license number" required>
                <Input value={form.license_number} disabled={locked} onChange={(e) => set('license_number', e.target.value)} placeholder="Enter your license number" />
              </Field>
              <Field label="License expiry date" required>
                <Input type="date" value={form.license_expiry} disabled={locked} onChange={(e) => set('license_expiry', e.target.value)} />
              </Field>
              <Field label="MDCN folio number">
                <Input value={form.mdcn_folio_number} disabled={locked} onChange={(e) => set('mdcn_folio_number', e.target.value)} />
              </Field>
              <Field label="Specialty" required hint="Separate multiple specialties with commas">
                <Input value={form.specialties} disabled={locked} onChange={(e) => set('specialties', e.target.value)} placeholder="e.g. General Practice, Paediatrics" />
              </Field>
              <Field label="Years of experience" required>
                <Input type="number" min={0} max={70} value={form.years_of_experience} disabled={locked} onChange={(e) => set('years_of_experience', e.target.value)} />
              </Field>
              <Field label="Consultation price (₦)">
                <Input type="number" min={0} value={form.consult_price} disabled={locked} onChange={(e) => set('consult_price', e.target.value)} />
              </Field>
              <Field label="Medical school">
                <Input value={form.alma_mater} disabled={locked} onChange={(e) => set('alma_mater', e.target.value)} />
              </Field>
              <Field label="Year of graduation">
                <Input type="number" value={form.graduation_year} disabled={locked} onChange={(e) => set('graduation_year', e.target.value)} />
              </Field>
              <div className="sm:col-span-2">
                <Field label="About you">
                  <Textarea rows={4} value={form.bio} disabled={locked} onChange={(e) => set('bio', e.target.value)} placeholder="A short professional bio patients will see" />
                </Field>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <Field label="Hospital or clinic" required>
                  <Input value={form.hospital_or_clinic} disabled={locked} onChange={(e) => set('hospital_or_clinic', e.target.value)} placeholder="Where you currently practise" />
                </Field>
              </div>
              <Field label="State" required>
                <Select value={form.state} disabled={locked} onValueChange={(v) => { set('state', v); set('city', ''); }}>
                  <SelectTrigger><SelectValue placeholder="Select state" /></SelectTrigger>
                  <SelectContent>{NIGERIA_STATES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                </Select>
              </Field>
              <Field label="City / LGA" required>
                <Select value={form.city} disabled={locked || !form.state} onValueChange={(v) => set('city', v)}>
                  <SelectTrigger><SelectValue placeholder={form.state ? 'Select city / LGA' : 'Select state first'} /></SelectTrigger>
                  <SelectContent>{cities.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                </Select>
              </Field>
              <div className="sm:col-span-2">
                <Field label="Contact phone number" required>
                  <Input type="tel" value={form.contact_phone} disabled={locked} onChange={(e) => set('contact_phone', e.target.value)} placeholder="+234 800 000 0000" />
                </Field>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-3">
              {REQUIRED_DOCS.map((t) => (
                <DoctorDocumentUploader key={t} docType={t} doc={docFor(t)} doctorId={doctor.id} userId={user.id}
                  disabled={locked} required onChanged={reloadDocs} />
              ))}
              {OPTIONAL_DOCS.map((t) => (
                <DoctorDocumentUploader key={t} docType={t} doc={docFor(t)} doctorId={doctor.id} userId={user.id}
                  disabled={locked} onChanged={reloadDocs} />
              ))}
            </div>
          )}

          {step === 4 && (
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Bank name" required>
                <Input value={form.payout_bank_name} disabled={locked} onChange={(e) => set('payout_bank_name', e.target.value)} />
              </Field>
              <Field label="Account number" required hint="Exactly 10 digits">
                <Input value={form.payout_account_number} disabled={locked} inputMode="numeric" maxLength={10}
                  onChange={(e) => set('payout_account_number', e.target.value.replace(/\D/g, ''))} />
              </Field>
              <div className="sm:col-span-2">
                <Field label="Account name" required hint="Should match your name on your license">
                  <Input value={form.payout_account_name} disabled={locked} onChange={(e) => set('payout_account_name', e.target.value)} />
                </Field>
              </div>
            </div>
          )}

          {step === 5 && (
            <div className="space-y-4">
              {missing.length > 0 && (
                <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertTitle>Still missing</AlertTitle>
                  <AlertDescription>
                    <ul className="list-disc pl-4 mt-1 space-y-0.5">
                      {missing.map((m) => (
                        <li key={m}>
                          <button type="button" className="underline" onClick={() => setStep(doctorStepForMissing(m))}>{doctorMissingLabel(m)}</button>
                        </li>
                      ))}
                    </ul>
                  </AlertDescription>
                </Alert>
              )}
              <ReviewSummary form={form} docs={docs} goTo={setStep} />
              {termsNeeded ? (
                <div className="flex items-start gap-2">
                  <Checkbox id="doctor-terms" checked={form.terms_accepted} disabled={locked} onCheckedChange={(v) => set('terms_accepted', !!v)} />
                  <Label htmlFor="doctor-terms" className="text-xs leading-relaxed">
                    I accept the terms of service and privacy policy, and I confirm that all information and documents provided are accurate and belong to me. <span className="text-destructive">*</span>
                  </Label>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">Terms and privacy policy accepted.</p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex justify-between">
        <Button variant="outline" onClick={back} disabled={step === 1 || saving || submitting} className="gap-1">
          <ChevronLeft className="w-4 h-4" /> Back
        </Button>
        {step < STEPS.length ? (
          <Button onClick={next} disabled={saving} className="gap-1">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            {locked ? 'Next' : 'Save & continue'} <ChevronRight className="w-4 h-4" />
          </Button>
        ) : (
          <Button onClick={submit} disabled={locked || submitting || termsNeeded} className="gap-1.5">
            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            Submit for approval
          </Button>
        )}
      </div>
    </div>
  );
}

function ReviewSummary({ form, docs, goTo }: { form: DoctorForm; docs: DoctorDocumentRow[]; goTo: (n: number) => void }) {
  const Row = ({ k, v }: { k: string; v?: string | null }) => (
    <div className="flex justify-between gap-3 text-xs py-1">
      <span className="text-muted-foreground">{k}</span>
      <span className="font-medium text-right break-words">{v?.trim() ? v : <span className="text-destructive">Not provided</span>}</span>
    </div>
  );
  const Block = ({ title, step, children }: { title: string; step: number; children: React.ReactNode }) => (
    <div className="rounded-lg border p-3">
      <div className="flex items-center justify-between mb-1">
        <h4 className="text-sm font-semibold">{title}</h4>
        <Button type="button" variant="link" size="sm" className="h-auto p-0 text-xs" onClick={() => goTo(step)}>Edit</Button>
      </div>
      {children}
    </div>
  );
  const masked = form.payout_account_number ? `••••${form.payout_account_number.slice(-4)}` : '';
  return (
    <div className="space-y-3">
      <Block title="Professional" step={1}>
        <Row k="License number" v={form.license_number} /><Row k="License expiry" v={form.license_expiry} />
        <Row k="Specialty" v={form.specialties} /><Row k="Years of experience" v={form.years_of_experience} />
      </Block>
      <Block title="Practice & contact" step={2}>
        <Row k="Hospital / clinic" v={form.hospital_or_clinic} /><Row k="State" v={form.state} />
        <Row k="City / LGA" v={form.city} /><Row k="Phone" v={form.contact_phone} />
      </Block>
      <Block title="Documents" step={3}>
        {REQUIRED_DOCS.map((t) => (
          <Row key={t} k={DOCTOR_DOC_LABELS[t]} v={docs.find((d) => d.doc_type === t) ? 'Uploaded' : ''} />
        ))}
      </Block>
      <Block title="Payout" step={4}>
        <Row k="Bank" v={form.payout_bank_name} /><Row k="Account number" v={masked} /><Row k="Account name" v={form.payout_account_name} />
      </Block>
    </div>
  );
}

const STATUS_STYLE: Record<string, string> = {
  pending: 'bg-amber-100 text-amber-800 border-amber-200',
  approved: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  rejected: 'bg-red-100 text-red-800 border-red-200',
};

function DoctorDocumentUploader({ docType, doc, doctorId, userId, disabled, required, onChanged }: {
  docType: DoctorDocType; doc?: DoctorDocumentRow; doctorId: string; userId: string;
  disabled?: boolean; required?: boolean; onChanged: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const imageOnly = DOCTOR_IMAGE_ONLY_DOCS.includes(docType);

  const pick = async (file?: File) => {
    if (!file) return;
    setBusy(true);
    try {
      await DoctorOnboardingService.uploadDocument({ doctorId, userId, docType, file });
      toast.success('File uploaded');
      onChanged();
    } catch (e) {
      toast.error(errMsg(e, 'Upload failed'));
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  const view = async () => {
    if (!doc) return;
    const url = await DoctorOnboardingService.signedUrl(doc.storage_path);
    if (url) window.open(url, '_blank', 'noopener,noreferrer');
    else toast.error('Could not open this file.');
  };

  const remove = async () => {
    if (!doc) return;
    setBusy(true);
    try {
      await DoctorOnboardingService.deleteDocument(doc);
      onChanged();
    } catch (e) {
      toast.error(errMsg(e, 'Could not remove file'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-lg border p-3 space-y-2">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-sm font-medium">{DOCTOR_DOC_LABELS[docType]} {required && <span className="text-destructive">*</span>}</p>
          <p className="text-[11px] text-muted-foreground">{imageOnly ? 'JPG, PNG or WEBP' : 'PDF or image'} · max 5MB</p>
        </div>
        {doc && <Badge variant="outline" className={`capitalize ${STATUS_STYLE[doc.status] ?? ''}`}>{doc.status}</Badge>}
      </div>
      {doc?.status === 'rejected' && doc.review_note && (
        <p className="text-xs text-destructive bg-destructive/10 rounded p-2">Rejected: {doc.review_note}</p>
      )}
      {doc && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <FileText className="w-3.5 h-3.5 shrink-0" />
          <span className="truncate">{doc.file_name ?? 'Uploaded file'}</span>
        </div>
      )}
      <input ref={inputRef} type="file" className="hidden"
        accept={imageOnly ? 'image/jpeg,image/png,image/webp' : 'application/pdf,image/jpeg,image/png,image/webp'}
        onChange={(e) => pick(e.target.files?.[0])} />
      <div className="flex flex-wrap gap-2">
        <Button type="button" size="sm" variant="outline" disabled={disabled || busy} onClick={() => inputRef.current?.click()} className="gap-1.5 text-xs">
          {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
          {doc ? 'Replace' : 'Upload'}
        </Button>
        {doc && (
          <Button type="button" size="sm" variant="ghost" onClick={view} className="gap-1.5 text-xs">
            <ExternalLink className="w-3.5 h-3.5" /> View
          </Button>
        )}
        {doc && doc.status !== 'approved' && !disabled && (
          <Button type="button" size="sm" variant="ghost" disabled={busy} onClick={remove} className="gap-1.5 text-xs text-destructive">
            <Trash2 className="w-3.5 h-3.5" /> Remove
          </Button>
        )}
      </div>
    </div>
  );
}
