import { useCallback, useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Loader2, Save, AlertTriangle, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import {
  PharmacyOnboardingService, daysUntil, DOC_LABELS,
  type DocType, type PharmacyDocumentRow, type PharmacyRow, errMsg } from '@/services/PharmacyOnboardingService';
import {
  formFromRows, pharmacyPatch, verificationPatch, validateSection, type PharmacyForm, type Section,
} from './pharmacyForm';
import { BusinessSection, ContactsSection, LocationSection, OperationsSection, PayoutSection } from './PharmacyFormSections';
import DocumentUploader from './DocumentUploader';
import { ReviewTimeline } from './PharmacyStatusScreens';

function ExpiryBanner({ label, date }: { label: string; date: string }) {
  const d = daysUntil(date);
  if (d === null || d > 30) return null;
  const expired = d <= 0;
  return (
    <Alert variant={expired ? 'destructive' : 'default'} className={expired ? '' : 'border-amber-300 bg-amber-50 text-amber-900'}>
      {expired ? <XCircle className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
      <AlertTitle>{expired ? `${label} has expired` : `${label} expires in ${d} day${d === 1 ? '' : 's'}`}</AlertTitle>
      <AlertDescription>
        Upload your renewed document and update the expiry date below{expired ? ' to avoid suspension' : ''}.
      </AlertDescription>
    </Alert>
  );
}

export default function PharmacyProfileSettings() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [savingSection, setSavingSection] = useState<string | null>(null);
  const [pharmacy, setPharmacy] = useState<PharmacyRow | null>(null);
  const [form, setForm] = useState<PharmacyForm | null>(null);
  const [docs, setDocs] = useState<PharmacyDocumentRow[]>([]);

  const load = useCallback(async () => {
    if (!user) return;
    try {
      const ph = await PharmacyOnboardingService.getPharmacy(user.id);
      if (!ph) throw new Error('No pharmacy record found.');
      const v = await PharmacyOnboardingService.ensureVerification(ph, user);
      setPharmacy(ph);
      setForm(formFromRows(ph, v));
      setDocs(await PharmacyOnboardingService.listDocuments(ph.id));
    } catch (e) {
      toast.error(errMsg(e, 'Could not load profile.'));
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => { load(); }, [load]);

  const set = useCallback(<K extends keyof PharmacyForm>(key: K, value: PharmacyForm[K]) => {
    setForm((f) => (f ? { ...f, [key]: value } : f));
  }, []);

  const save = async (name: string, sections: Section[]) => {
    if (!pharmacy || !form) return;
    for (const s of sections) {
      const err = validateSection(form, s);
      if (err) return toast.error(err);
    }
    setSavingSection(name);
    try {
      for (const s of sections) {
        const pPatch = pharmacyPatch(form, s, { licenseLocked: true });
        const vPatch = verificationPatch(form, s, { regLocked: true });
        if (Object.keys(pPatch).length) await PharmacyOnboardingService.savePharmacy(pharmacy.id, pPatch);
        if (Object.keys(vPatch).length) await PharmacyOnboardingService.saveVerification(pharmacy.id, vPatch);
      }
      toast.success('Saved');
    } catch (e) {
      toast.error(errMsg(e, 'Could not save.'));
    } finally {
      setSavingSection(null);
    }
  };

  if (loading || !form || !pharmacy || !user) {
    return <div className="flex justify-center py-16"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
  }

  const SaveBtn = ({ name, sections }: { name: string; sections: Section[] }) => (
    <Button size="sm" onClick={() => save(name, sections)} disabled={savingSection === name} className="gap-1.5">
      {savingSection === name ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />} Save changes
    </Button>
  );

  const docTypes: DocType[] = ['cac_certificate', 'pcn_premises_certificate', 'pharmacist_license', 'pharmacist_id', 'storefront_photo',
    ...(form.handles_controlled_drugs ? (['nafdac_ndlea_authorization'] as DocType[]) : [])];

  return (
    <div className="space-y-4 max-w-3xl">
      <h2 className="text-lg font-semibold">Pharmacy profile</h2>
      <ExpiryBanner label="PCN premises license" date={form.pcn_premises_license_expiry} />
      <ExpiryBanner label="Pharmacist annual license" date={form.pharmacist_license_expiry} />

      <Card>
        <CardHeader><CardTitle className="text-base">Pharmacy information</CardTitle>
          <CardDescription>Registration numbers are locked after approval. Contact support to change them.</CardDescription></CardHeader>
        <CardContent className="space-y-4">
          <BusinessSection form={form} set={set} regLocked pharmacyId={pharmacy.id} userId={user.id} />
          <SaveBtn name="business" sections={['business']} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Contacts & pharmacist</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <ContactsSection form={form} set={set} regLocked />
          <SaveBtn name="contacts" sections={['contacts']} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Location</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <LocationSection form={form} set={set} />
          <SaveBtn name="location" sections={['location']} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Operations</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <OperationsSection form={form} set={set} />
          <SaveBtn name="operations" sections={['operations']} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Payout details</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <PayoutSection form={form} set={set} />
          <SaveBtn name="payout" sections={['payout']} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Documents</CardTitle>
          <CardDescription>Replace a document when a license is renewed. Replacements go back to pending review.</CardDescription></CardHeader>
        <CardContent className="space-y-3">
          {docTypes.map((t) => (
            <DocumentUploader key={t} docType={t} doc={docs.find((d) => d.doc_type === t)} pharmacyId={pharmacy.id} userId={user.id}
              onChanged={async () => setDocs(await PharmacyOnboardingService.listDocuments(pharmacy.id))} />
          ))}
          <p className="text-[11px] text-muted-foreground">
            Required documents: {docTypes.map((t) => DOC_LABELS[t]).join(', ')}.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Review history</CardTitle></CardHeader>
        <CardContent><ReviewTimeline pharmacyId={pharmacy.id} /></CardContent>
      </Card>
    </div>
  );
}
