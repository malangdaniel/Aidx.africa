import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Loader2,
  Building2,
  Phone,
  MapPin,
  Clock,
  Wallet,
  FileText,
  Send,
  X,
  AlertTriangle,
  XCircle,
  CheckCircle2,
} from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import {
  PharmacyOnboardingService,
  daysUntil,
  DOC_LABELS,
  type DocType,
  type PharmacyDocumentRow,
  type PharmacyRow,
  errMsg,
} from '@/services/PharmacyOnboardingService';
import {
  formFromRows,
  validateSection,
  type PharmacyForm,
  type Section,
} from './pharmacyForm';
import {
  BusinessSection,
  ContactsSection,
  LocationSection,
  OperationsSection,
  PayoutSection,
} from './PharmacyFormSections';
import DocumentUploader from './DocumentUploader';
import { ReviewTimeline } from './PharmacyStatusScreens';

export interface PendingPharmacyChangesPayload {
  form: PharmacyForm;
  status: 'pending' | 'approved' | 'rejected';
  submitted_at: string;
  rejection_reason: string | null;
}

function ExpiryBanner({ label, date }: { label: string; date: string }) {
  const d = daysUntil(date);
  if (d === null || d > 30) return null;
  const expired = d <= 0;
  return (
    <Alert
      variant={expired ? 'destructive' : 'default'}
      className={expired ? 'mb-2' : 'border-amber-300 bg-amber-50 text-amber-900 mb-2'}
    >
      {expired ? <XCircle className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
      <AlertTitle>{expired ? `${label} has expired` : `${label} expires in ${d} day${d === 1 ? '' : 's'}`}</AlertTitle>
      <AlertDescription className="text-xs">
        Upload your renewed document and update the expiry date below{expired ? ' to avoid suspension' : ''}.
      </AlertDescription>
    </Alert>
  );
}

export default function PharmacyProfileSettings() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [pharmacy, setPharmacy] = useState<PharmacyRow | null>(null);
  const [form, setForm] = useState<PharmacyForm | null>(null);
  const [docs, setDocs] = useState<PharmacyDocumentRow[]>([]);

  // Pending changes state
  const [pendingStatus, setPendingStatus] = useState<'pending' | 'approved' | 'rejected' | null>(null);
  const [submittedAt, setSubmittedAt] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user) return;
    try {
      const ph = await PharmacyOnboardingService.getPharmacy(user.id);
      if (!ph) throw new Error('No pharmacy record found.');
      const v = await PharmacyOnboardingService.ensureVerification(ph, user);
      setPharmacy(ph);

      // Current live data from pharmacy & verification rows
      const liveForm = formFromRows(ph, v);
      setForm(liveForm);

      const dList = await PharmacyOnboardingService.listDocuments(ph.id);
      setDocs(dList);

      // Check pending changes in pharmacies.metadata
      const meta = (ph.metadata as Record<string, any>) || {};
      const pendingBlob = meta.pending_changes as PendingPharmacyChangesPayload | undefined;

      if (pendingBlob && pendingBlob.status === 'pending') {
        setPendingStatus('pending');
        setSubmittedAt(pendingBlob.submitted_at || null);
        setRejectionReason(null);
      } else if (pendingBlob && pendingBlob.status === 'rejected') {
        setPendingStatus('rejected');
        setSubmittedAt(pendingBlob.submitted_at || null);
        setRejectionReason(pendingBlob.rejection_reason || 'No specific reason provided.');
      } else if (pendingBlob && pendingBlob.status === 'approved') {
        setPendingStatus('approved');
        setSubmittedAt(pendingBlob.submitted_at || null);
        setRejectionReason(null);
      } else {
        setPendingStatus(null);
        setSubmittedAt(null);
        setRejectionReason(null);
      }
    } catch (e) {
      toast.error(errMsg(e, 'Could not load profile.'));
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    load();
  }, [load]);

  const set = useCallback(<K extends keyof PharmacyForm>(key: K, value: PharmacyForm[K]) => {
    setForm((f) => (f ? { ...f, [key]: value } : f));
  }, []);

  const save = async () => {
    if (!pharmacy || !form) return;

    // Validate format across all sections before submitting
    const sections: Section[] = ['business', 'contacts', 'location', 'operations', 'payout'];
    for (const s of sections) {
      const err = validateSection(form, s);
      if (err) {
        toast.error(`Error in ${s} section: ${err}`);
        return;
      }
    }

    setSaving(true);
    try {
      const now = new Date().toISOString();
      const pendingChangesPayload: PendingPharmacyChangesPayload = {
        form,
        status: 'pending',
        submitted_at: now,
        rejection_reason: null,
      };

      const existingMeta = (pharmacy.metadata as Record<string, any>) || {};
      const updatedMeta = {
        ...existingMeta,
        pending_changes: pendingChangesPayload,
      };

      const { error } = await supabase
        .from('pharmacies')
        .update({
          metadata: updatedMeta,
          updated_at: now,
        })
        .eq('id', pharmacy.id);

      if (error) throw error;

      setPharmacy((prev) => (prev ? { ...prev, metadata: updatedMeta } : prev));
      setPendingStatus('pending');
      setSubmittedAt(now);
      setRejectionReason(null);

      toast.success('Pharmacy profile changes submitted for admin review');
    } catch (e) {
      toast.error(errMsg(e, 'Could not submit changes.'));
    } finally {
      setSaving(false);
    }
  };

  const cancelPending = async () => {
    if (!pharmacy) return;
    setCancelling(true);
    try {
      const existingMeta = { ...((pharmacy.metadata as Record<string, any>) || {}) };
      delete existingMeta.pending_changes;

      const { error } = await supabase
        .from('pharmacies')
        .update({
          metadata: existingMeta,
          updated_at: new Date().toISOString(),
        })
        .eq('id', pharmacy.id);

      if (error) throw error;

      setPharmacy((prev) => (prev ? { ...prev, metadata: existingMeta } : prev));
      setPendingStatus(null);
      setSubmittedAt(null);
      setRejectionReason(null);

      // Reload live data from database
      await load();
      toast.success('Pending change request has been cancelled');
    } catch (e) {
      toast.error(errMsg(e, 'Could not cancel pending request.'));
    } finally {
      setCancelling(false);
    }
  };

  const getButtonText = () => {
    if (pendingStatus === 'rejected') return 'Resubmit for Review';
    if (pendingStatus === 'pending') return 'Update Pending Request';
    return 'Submit Changes for Review';
  };

  if (loading || !form || !pharmacy || !user) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  const docTypes: DocType[] = [
    'cac_certificate',
    'pcn_premises_certificate',
    'pharmacist_license',
    'pharmacist_id',
    'storefront_photo',
    ...(form.handles_controlled_drugs ? (['nafdac_ndlea_authorization'] as DocType[]) : []),
  ];

  return (
    <div className="space-y-4 max-w-4xl mx-auto flex flex-col h-full">
      <div className="flex items-center justify-between pb-2 border-b">
        <div>
          <h2 className="text-xl font-bold tracking-tight">Pharmacy Profile</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Manage your premises, clinical contacts, operating schedule, and banking details
          </p>
        </div>
      </div>

      {/* Pending status banner */}
      {pendingStatus === 'pending' && (
        <Alert className="border-amber-400 bg-amber-500/10 text-amber-900 dark:text-amber-200">
          <Clock className="h-4 w-4 text-amber-600 dark:text-amber-400" />
          <AlertTitle className="font-semibold text-amber-900 dark:text-amber-200">
            Changes Pending Review
          </AlertTitle>
          <AlertDescription className="text-xs text-amber-800 dark:text-amber-300 mt-1">
            Your pharmacy profile changes are pending admin review. Your current live details will
            remain visible to customers and in the dispatch directory until approved.
            {submittedAt && (
              <span className="block mt-0.5 text-muted-foreground dark:text-amber-400/80">
                Submitted on {new Date(submittedAt).toLocaleDateString()} at{' '}
                {new Date(submittedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}.
              </span>
            )}
          </AlertDescription>
        </Alert>
      )}

      {/* Rejected status banner */}
      {pendingStatus === 'rejected' && (
        <Alert variant="destructive">
          <XCircle className="h-4 w-4" />
          <AlertTitle className="font-semibold">Profile Change Request Rejected</AlertTitle>
          <AlertDescription className="text-xs mt-1 space-y-1">
            <p>
              Your profile change request was rejected:{' '}
              <span className="font-medium">{rejectionReason || 'No specific reason provided.'}</span>
            </p>
            <p className="text-[11px] opacity-90">
              Please review the feedback, adjust your details below, and resubmit for review.
            </p>
          </AlertDescription>
        </Alert>
      )}

      {/* Approved recently notice */}
      {pendingStatus === 'approved' && (
        <Alert className="border-emerald-400 bg-emerald-500/10 text-emerald-900 dark:text-emerald-200">
          <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
          <AlertTitle className="font-semibold text-emerald-900 dark:text-emerald-200">
            Changes Approved
          </AlertTitle>
          <AlertDescription className="text-xs text-emerald-800 dark:text-emerald-300 mt-1">
            Your latest profile changes have been approved and published to your live storefront.
          </AlertDescription>
        </Alert>
      )}

      {/* License Expiry Warnings */}
      <ExpiryBanner label="PCN premises license" date={form.pcn_premises_license_expiry} />
      <ExpiryBanner label="Pharmacist annual license" date={form.pharmacist_license_expiry} />

      <Tabs defaultValue="business" className="flex-1 flex flex-col overflow-hidden">
        <TabsList className="grid grid-cols-3 sm:grid-cols-6 mb-4 flex-shrink-0">
          <TabsTrigger value="business" className="gap-1.5 text-xs">
            <Building2 className="h-4 w-4 hidden sm:inline" />
            Business
          </TabsTrigger>
          <TabsTrigger value="contacts" className="gap-1.5 text-xs">
            <Phone className="h-4 w-4 hidden sm:inline" />
            Contacts
          </TabsTrigger>
          <TabsTrigger value="location" className="gap-1.5 text-xs">
            <MapPin className="h-4 w-4 hidden sm:inline" />
            Location
          </TabsTrigger>
          <TabsTrigger value="operations" className="gap-1.5 text-xs">
            <Clock className="h-4 w-4 hidden sm:inline" />
            Operations
          </TabsTrigger>
          <TabsTrigger value="payout" className="gap-1.5 text-xs">
            <Wallet className="h-4 w-4 hidden sm:inline" />
            Payout
          </TabsTrigger>
          <TabsTrigger value="documents" className="gap-1.5 text-xs">
            <FileText className="h-4 w-4 hidden sm:inline" />
            Documents
          </TabsTrigger>
        </TabsList>

        <ScrollArea className="flex-1 pr-4 max-h-[65vh]">
          <div className="space-y-4">
            <TabsContent value="business" className="mt-0 space-y-4">
              <div className="space-y-1">
                <h3 className="font-semibold text-lg">Pharmacy Information</h3>
                <p className="text-xs text-muted-foreground">
                  Registration numbers are locked after initial approval. Contact support to change them.
                </p>
              </div>
              <BusinessSection
                form={form}
                set={set}
                regLocked
                pharmacyId={pharmacy.id}
                userId={user.id}
              />
            </TabsContent>

            <TabsContent value="contacts" className="mt-0 space-y-4">
              <div className="space-y-1">
                <h3 className="font-semibold text-lg">Contacts & Superintendent Pharmacist</h3>
                <p className="text-xs text-muted-foreground">
                  Key personnel details and regulatory contact channels
                </p>
              </div>
              <ContactsSection form={form} set={set} regLocked />
            </TabsContent>

            <TabsContent value="location" className="mt-0 space-y-4">
              <div className="space-y-1">
                <h3 className="font-semibold text-lg">Physical Location</h3>
                <p className="text-xs text-muted-foreground">
                  Storefront address and geographic positioning for order routing
                </p>
              </div>
              <LocationSection form={form} set={set} />
            </TabsContent>

            <TabsContent value="operations" className="mt-0 space-y-4">
              <div className="space-y-1">
                <h3 className="font-semibold text-lg">Operating Schedule & Services</h3>
                <p className="text-xs text-muted-foreground">
                  Store opening hours, delivery radius, cold-chain, and controlled substances handling
                </p>
              </div>
              <OperationsSection form={form} set={set} />
            </TabsContent>

            <TabsContent value="payout" className="mt-0 space-y-4">
              <div className="space-y-1">
                <h3 className="font-semibold text-lg">Payout Details</h3>
                <p className="text-xs text-muted-foreground">
                  Bank account configuration for prescription and OTC order settlements
                </p>
              </div>
              <PayoutSection form={form} set={set} />
            </TabsContent>

            <TabsContent value="documents" className="mt-0 space-y-4">
              <div className="space-y-1">
                <h3 className="font-semibold text-lg">Regulatory Documents</h3>
                <p className="text-xs text-muted-foreground">
                  Replace a document when a license is renewed. Replacements go back to pending review.
                </p>
              </div>
              <div className="space-y-3">
                {docTypes.map((t) => (
                  <DocumentUploader
                    key={t}
                    docType={t}
                    doc={docs.find((d) => d.doc_type === t)}
                    pharmacyId={pharmacy.id}
                    userId={user.id}
                    onChanged={async () => setDocs(await PharmacyOnboardingService.listDocuments(pharmacy.id))}
                  />
                ))}
                <p className="text-[11px] text-muted-foreground">
                  Required documents: {docTypes.map((t) => DOC_LABELS[t]).join(', ')}.
                </p>
              </div>

              <div className="mt-6 pt-4 border-t">
                <h4 className="text-sm font-semibold mb-2">Review History</h4>
                <ReviewTimeline pharmacyId={pharmacy.id} />
              </div>
            </TabsContent>
          </div>
        </ScrollArea>
      </Tabs>

      {/* Global Save / Action Bar */}
      <div className="pt-4 border-t mt-auto flex-shrink-0 flex flex-col sm:flex-row gap-2">
        {pendingStatus === 'pending' && (
          <Button
            type="button"
            variant="outline"
            onClick={cancelPending}
            disabled={cancelling || saving}
            className="border-destructive/40 text-destructive hover:bg-destructive/10 gap-2 sm:w-auto"
          >
            {cancelling ? <Loader2 className="h-4 w-4 animate-spin" /> : <X className="h-4 w-4" />}
            Cancel Pending Request
          </Button>
        )}

        <Button
          onClick={save}
          disabled={saving || cancelling}
          className="flex-1 gap-2"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          {getButtonText()}
        </Button>
      </div>
    </div>
  );
}
