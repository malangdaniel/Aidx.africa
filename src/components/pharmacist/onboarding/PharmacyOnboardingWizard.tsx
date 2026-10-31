import { useCallback, useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Loader2, ChevronLeft, ChevronRight, Send, AlertTriangle, XCircle, Lock } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import {
  PharmacyOnboardingService, DOC_LABELS, missingLabel, stepForMissing,
  type ApplicationStatus, type DocType, type PharmacyDocumentRow, type PharmacyRow, errMsg } from '@/services/PharmacyOnboardingService';
import {
  formFromRows, pharmacyPatch, verificationPatch, validateSection,
  type PharmacyForm, type Section,
} from './pharmacyForm';
import { BusinessSection, ContactsSection, LocationSection, OperationsSection, PayoutSection } from './PharmacyFormSections';
import DocumentUploader from './DocumentUploader';

const STEPS = [
  { title: 'Pharmacy information', desc: 'Business details, registration and license numbers' },
  { title: 'Contacts & pharmacist', desc: 'Contact person and superintendent pharmacist' },
  { title: 'Location', desc: 'Where patients can find you' },
  { title: 'Documents', desc: 'Upload your certificates and licenses' },
  { title: 'Operations & payout', desc: 'Hours, delivery and bank details (can be completed later)' },
  { title: 'Review & submit', desc: 'Check everything before sending it for review' },
] as const;

interface Props {
  status: ApplicationStatus;
  onSubmitted: () => void;
}

export default function PharmacyOnboardingWizard({ status, onSubmitted }: Props) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [step, setStep] = useState(1);
  const [pharmacy, setPharmacy] = useState<PharmacyRow | null>(null);
  const [form, setForm] = useState<PharmacyForm | null>(null);
  const [docs, setDocs] = useState<PharmacyDocumentRow[]>([]);
  const [missing, setMissing] = useState<string[]>([]);

  const locked = status.profile_status === 'submitted' && status.verification_status === 'pending';

  const load = useCallback(async () => {
    if (!user) return;
    try {
      const ph = await PharmacyOnboardingService.getPharmacy(user.id);
      if (!ph) throw new Error('No pharmacy record found for this account.');
      const v = await PharmacyOnboardingService.ensureVerification(ph, user);
      setPharmacy(ph);
      setForm(formFromRows(ph, v));
      setDocs(await PharmacyOnboardingService.listDocuments(ph.id));
    } catch (e) {
      toast.error(errMsg(e, 'Could not load your application.'));
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => { load(); }, [load]);

  const reloadDocs = useCallback(async () => {
    if (pharmacy) setDocs(await PharmacyOnboardingService.listDocuments(pharmacy.id));
  }, [pharmacy]);

  const set = useCallback(<K extends keyof PharmacyForm>(key: K, value: PharmacyForm[K]) => {
    setForm((f) => (f ? { ...f, [key]: value } : f));
  }, []);

  const requiredDocs: DocType[] = useMemo(() => {
    const base: DocType[] = ['cac_certificate', 'pcn_premises_certificate', 'pharmacist_license', 'pharmacist_id', 'storefront_photo'];
    if (form?.handles_controlled_drugs) base.push('nafdac_ndlea_authorization');
    return base;
  }, [form?.handles_controlled_drugs]);

  const saveStep = async (n: number): Promise<boolean> => {
    if (!pharmacy || !form || locked) return true;
    const sections: Section[][] = [['business'], ['contacts'], ['location'], [], ['operations', 'payout'], []];
    for (const s of sections[n - 1]) {
      const err = validateSection(form, s);
      if (err) { toast.error(err); return false; }
    }
    setSaving(true);
    try {
      for (const s of sections[n - 1]) {
        const pPatch = pharmacyPatch(form, s);
        const vPatch = verificationPatch(form, s);
        if (Object.keys(pPatch).length) await PharmacyOnboardingService.savePharmacy(pharmacy.id, pPatch);
        if (Object.keys(vPatch).length) await PharmacyOnboardingService.saveVerification(pharmacy.id, vPatch);
      }
      return true;
    } catch (e) {
      toast.error(errMsg(e, 'Could not save this step.'));
      return false;
    } finally {
      setSaving(false);
    }
  };

  const next = async () => {
    if (await saveStep(step)) setStep((s) => Math.min(6, s + 1));
  };
  const back = () => setStep((s) => Math.max(1, s - 1));

  const submit = async () => {
    if (!pharmacy || !form) return;
    setSubmitting(true);
    try {
      // Terms acceptance is recorded just before submit if it was not captured at signup.
      if (form.terms_accepted) {
        await PharmacyOnboardingService.saveVerification(pharmacy.id, {
          terms_accepted_at: new Date().toISOString(), terms_version: 'v1',
        });
      }
      const res = await PharmacyOnboardingService.submit();
      if (!res.ok) {
        setMissing(res.missing);
        const first = Math.min(...res.missing.map(stepForMissing));
        toast.error('Some required information is still missing.');
        setStep(first === 6 ? 6 : first);
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

  if (loading || !form || !pharmacy || !user) {
    return <div className="flex justify-center py-16"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
  }

  const docFor = (t: DocType) => docs.find((d) => d.doc_type === t);
  const current = STEPS[step - 1];
  const termsNeeded = !form.terms_accepted;

  return (
    <div className="space-y-4 max-w-3xl mx-auto">
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
        <div className="hidden sm:flex justify-between pt-1">
          {STEPS.map((s, i) => (
            <button key={s.title} type="button" onClick={() => setStep(i + 1)}
              className={`text-[10px] ${i + 1 === step ? 'font-bold text-primary' : 'text-muted-foreground'}`}>
              {i + 1}. {s.title.split(' ')[0]}
            </button>
          ))}
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{current.title}</CardTitle>
          <CardDescription>{current.desc}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {step === 1 && <BusinessSection form={form} set={set} disabled={locked} pharmacyId={pharmacy.id} userId={user.id} />}
          {step === 2 && <ContactsSection form={form} set={set} disabled={locked} />}
          {step === 3 && <LocationSection form={form} set={set} disabled={locked} />}
          {step === 4 && (
            <div className="space-y-3">
              {requiredDocs.map((t) => (
                <DocumentUploader key={t} docType={t} doc={docFor(t)} pharmacyId={pharmacy.id} userId={user.id}
                  disabled={locked} required onChanged={reloadDocs} />
              ))}
              {!form.handles_controlled_drugs && (
                <p className="text-xs text-muted-foreground">
                  If you handle controlled drugs, turn that on in the next step and a NAFDAC / NDLEA authorization upload will appear here.
                </p>
              )}
            </div>
          )}
          {step === 5 && (
            <div className="space-y-6">
              <OperationsSection form={form} set={set} disabled={locked} />
              <div className="space-y-3">
                <h4 className="text-sm font-semibold">Payout details</h4>
                <PayoutSection form={form} set={set} disabled={locked} />
              </div>
            </div>
          )}
          {step === 6 && (
            <div className="space-y-4">
              {missing.length > 0 && (
                <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertTitle>Still missing</AlertTitle>
                  <AlertDescription>
                    <ul className="list-disc pl-4 mt-1 space-y-0.5">
                      {missing.map((m) => (
                        <li key={m}>
                          <button type="button" className="underline" onClick={() => setStep(stepForMissing(m))}>{missingLabel(m)}</button>
                        </li>
                      ))}
                    </ul>
                  </AlertDescription>
                </Alert>
              )}
              <ReviewSummary form={form} docs={docs} requiredDocs={requiredDocs} goTo={setStep} />
              {termsNeeded ? (
                <div className="flex items-start gap-2">
                  <Checkbox id="terms" checked={form.terms_accepted} disabled={locked} onCheckedChange={(v) => set('terms_accepted', !!v)} />
                  <Label htmlFor="terms" className="text-xs leading-relaxed">
                    I accept the e-commerce and vendor agreement and privacy policy, and I confirm that all information provided is accurate. <span className="text-destructive">*</span>
                  </Label>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">Vendor agreement and privacy policy accepted.</p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex justify-between">
        <Button variant="outline" onClick={back} disabled={step === 1 || saving || submitting} className="gap-1">
          <ChevronLeft className="w-4 h-4" /> Back
        </Button>
        {step < 6 ? (
          <Button onClick={next} disabled={saving} className="gap-1">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            {locked ? 'Next' : 'Save & continue'} <ChevronRight className="w-4 h-4" />
          </Button>
        ) : (
          <Button onClick={submit} disabled={locked || submitting || termsNeeded} className="gap-1.5">
            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            Submit for review
          </Button>
        )}
      </div>
    </div>
  );
}

function ReviewSummary({ form, docs, requiredDocs, goTo }: { form: PharmacyForm; docs: PharmacyDocumentRow[]; requiredDocs: DocType[]; goTo: (n: number) => void }) {
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
  return (
    <div className="space-y-3">
      <Block title="Pharmacy" step={1}>
        <Row k="Name" v={form.business_name} /><Row k="RC No." v={form.cac_rc_number} />
        <Row k="PCN premises license" v={form.license_number} /><Row k="License expiry" v={form.pcn_premises_license_expiry} />
        <Row k="Email" v={form.email} /><Row k="Phone" v={form.phone} />
      </Block>
      <Block title="Contacts & pharmacist" step={2}>
        <Row k="Contact person" v={form.contact_person_name} /><Row k="Contact phone" v={form.contact_person_phone} />
        <Row k="Superintendent pharmacist" v={form.pharmacist_full_name} /><Row k="Pharmacist PCN No." v={form.pharmacist_pcn_number} />
        <Row k="Pharmacist license expiry" v={form.pharmacist_license_expiry} />
        <Row k="Pharmacist phone" v={form.pharmacist_phone} /><Row k="Pharmacist email" v={form.pharmacist_email} />
      </Block>
      <Block title="Location" step={3}>
        <Row k="State" v={form.state} /><Row k="City / LGA" v={form.city} /><Row k="Street" v={form.street} />
      </Block>
      <Block title="Documents" step={4}>
        {requiredDocs.map((t) => (
          <Row key={t} k={DOC_LABELS[t]} v={docs.find((d) => d.doc_type === t) ? 'Uploaded' : ''} />
        ))}
      </Block>
    </div>
  );
}
