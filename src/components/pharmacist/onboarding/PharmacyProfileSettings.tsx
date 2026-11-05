import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
  ShieldCheck,
  Calendar,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
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

export interface PharmacyProfileSettingsProps {
  inModal?: boolean;
  onClose?: () => void;
}

function ExpiryBanner({ label, date }: { label: string; date: string }) {
  const d = daysUntil(date);
  if (d === null || d > 30) return null;
  const expired = d <= 0;
  return (
    <Alert
      variant={expired ? 'destructive' : 'default'}
      className={
        expired
          ? 'border-destructive/60 bg-destructive/10 text-destructive shadow-2xs'
          : 'border-amber-400/80 bg-amber-500/10 text-amber-900 dark:text-amber-200 shadow-2xs'
      }
    >
      {expired ? (
        <XCircle className="h-4 w-4 text-destructive flex-shrink-0" />
      ) : (
        <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400 flex-shrink-0" />
      )}
      <AlertTitle className="font-semibold text-xs tracking-tight">
        {expired ? `${label} has expired` : `${label} expires in ${d} day${d === 1 ? '' : 's'}`}
      </AlertTitle>
      <AlertDescription className="text-xs mt-0.5 leading-relaxed">
        {expired
          ? `Your ${label.toLowerCase()} expired on ${new Date(date).toLocaleDateString()}. Upload your renewed certificate in the Documents tab to prevent disruption to order dispatch.`
          : `Your ${label.toLowerCase()} is due to expire on ${new Date(date).toLocaleDateString()}. Please prepare your renewed certificate and update the expiry date in Documents.`}
      </AlertDescription>
    </Alert>
  );
}

export default function PharmacyProfileSettings({ inModal = false, onClose }: PharmacyProfileSettingsProps) {
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
      // Cast so the payload satisfies the generated Json type for metadata.
      const updatedMeta = {
        ...existingMeta,
        pending_changes: pendingChangesPayload,
      } as unknown as Record<string, any>;

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
      <div className="flex flex-col items-center justify-center py-20 gap-3">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
        <p className="text-xs text-muted-foreground animate-pulse">Loading pharmacy profile details...</p>
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

  const pcnExpiryDays = daysUntil(form.pcn_premises_license_expiry);
  const pharmExpiryDays = daysUntil(form.pharmacist_license_expiry);
  const hasExpiredDoc = (pcnExpiryDays !== null && pcnExpiryDays <= 0) || (pharmExpiryDays !== null && pharmExpiryDays <= 0);
  const hasExpiringDoc = (pcnExpiryDays !== null && pcnExpiryDays <= 30) || (pharmExpiryDays !== null && pharmExpiryDays <= 30);

  return (
    <div className={cn('flex flex-col h-full overflow-hidden', !inModal && 'max-w-5xl mx-auto space-y-4 p-4')}>
      {/* Standalone outer title if not rendered inside modal */}
      {!inModal && (
        <div className="flex items-center justify-between pb-3 border-b">
          <div>
            <h2 className="text-xl font-bold tracking-tight">Pharmacy Profile</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Manage premises, licensing, operating hours, delivery, and banking details
            </p>
          </div>
        </div>
      )}

      <Tabs defaultValue="business" className="flex-1 flex flex-col min-h-0 overflow-hidden">
        {/* Navigation Tabs Header */}
        <div className="flex-shrink-0 px-4 sm:px-6 pt-3 pb-2.5 bg-background/80 border-b border-border/50">
          <TabsList className="grid grid-cols-3 sm:grid-cols-6 w-full h-auto p-1 bg-muted/70 rounded-xl gap-1">
            <TabsTrigger
              value="business"
              className="gap-1.5 py-2 text-xs font-medium rounded-lg data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-xs transition-all"
            >
              <Building2 className="h-3.5 w-3.5 flex-shrink-0" />
              <span>Business</span>
            </TabsTrigger>
            <TabsTrigger
              value="contacts"
              className="gap-1.5 py-2 text-xs font-medium rounded-lg data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-xs transition-all"
            >
              <Phone className="h-3.5 w-3.5 flex-shrink-0" />
              <span>Contacts</span>
            </TabsTrigger>
            <TabsTrigger
              value="location"
              className="gap-1.5 py-2 text-xs font-medium rounded-lg data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-xs transition-all"
            >
              <MapPin className="h-3.5 w-3.5 flex-shrink-0" />
              <span>Location</span>
            </TabsTrigger>
            <TabsTrigger
              value="operations"
              className="gap-1.5 py-2 text-xs font-medium rounded-lg data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-xs transition-all"
            >
              <Clock className="h-3.5 w-3.5 flex-shrink-0" />
              <span>Operations</span>
            </TabsTrigger>
            <TabsTrigger
              value="payout"
              className="gap-1.5 py-2 text-xs font-medium rounded-lg data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-xs transition-all"
            >
              <Wallet className="h-3.5 w-3.5 flex-shrink-0" />
              <span>Payout</span>
            </TabsTrigger>
            <TabsTrigger
              value="documents"
              className="relative gap-1.5 py-2 text-xs font-medium rounded-lg data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-xs transition-all"
            >
              <FileText className="h-3.5 w-3.5 flex-shrink-0" />
              <span>Documents</span>
              {(hasExpiredDoc || hasExpiringDoc) && (
                <span
                  className={cn(
                    'absolute top-1.5 right-1.5 w-2 h-2 rounded-full ring-2 ring-background',
                    hasExpiredDoc ? 'bg-destructive animate-pulse' : 'bg-amber-500'
                  )}
                />
              )}
            </TabsTrigger>
          </TabsList>
        </div>

        {/* Scrollable Tab Content Container */}
        <div className="flex-1 min-h-0 overflow-y-auto px-4 sm:px-6 py-5 space-y-4">
          {/* Pending Status Banner */}
          {pendingStatus === 'pending' && (
            <Alert className="border-amber-400 bg-amber-500/10 text-amber-900 dark:text-amber-200 shadow-2xs">
              <Clock className="h-4 w-4 text-amber-600 dark:text-amber-400 flex-shrink-0" />
              <AlertTitle className="font-semibold text-xs text-amber-900 dark:text-amber-200">
                Changes Under Administrative Review
              </AlertTitle>
              <AlertDescription className="text-xs text-amber-800 dark:text-amber-300 mt-1 leading-relaxed">
                Your pharmacy profile updates are awaiting compliance verification. Your current live details
                remain active and visible to patients and delivery riders until approved.
                {submittedAt && (
                  <span className="block mt-1 font-medium opacity-90">
                    Submitted on {new Date(submittedAt).toLocaleDateString()} at{' '}
                    {new Date(submittedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}.
                  </span>
                )}
              </AlertDescription>
            </Alert>
          )}

          {/* Rejected Status Banner */}
          {pendingStatus === 'rejected' && (
            <Alert variant="destructive" className="shadow-2xs">
              <XCircle className="h-4 w-4 flex-shrink-0" />
              <AlertTitle className="font-semibold text-xs">Profile Change Request Rejected</AlertTitle>
              <AlertDescription className="text-xs mt-1 space-y-1 leading-relaxed">
                <p>
                  Compliance administrator noted:{' '}
                  <span className="font-semibold">{rejectionReason || 'No specific reason provided.'}</span>
                </p>
                <p className="text-[11px] opacity-90">
                  Please adjust the required information in the sections below and resubmit for verification.
                </p>
              </AlertDescription>
            </Alert>
          )}

          {/* Approved Recently Banner */}
          {pendingStatus === 'approved' && (
            <Alert className="border-emerald-400 bg-emerald-500/10 text-emerald-900 dark:text-emerald-200 shadow-2xs">
              <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
              <AlertTitle className="font-semibold text-xs text-emerald-900 dark:text-emerald-200">
                Latest Changes Approved
              </AlertTitle>
              <AlertDescription className="text-xs text-emerald-800 dark:text-emerald-300 mt-1">
                Your latest profile modifications were approved and are now live across the platform.
              </AlertDescription>
            </Alert>
          )}

          {/* License Expiry Warnings */}
          <ExpiryBanner label="PCN premises license" date={form.pcn_premises_license_expiry} />
          <ExpiryBanner label="Pharmacist annual license" date={form.pharmacist_license_expiry} />

          {/* Tab 1: Business */}
          <TabsContent value="business" className="mt-0 space-y-4 focus-visible:outline-none">
            <BusinessSection
              form={form}
              set={set}
              regLocked
              pharmacyId={pharmacy.id}
              userId={user.id}
            />
          </TabsContent>

          {/* Tab 2: Contacts */}
          <TabsContent value="contacts" className="mt-0 space-y-4 focus-visible:outline-none">
            <ContactsSection form={form} set={set} regLocked />
          </TabsContent>

          {/* Tab 3: Location */}
          <TabsContent value="location" className="mt-0 space-y-4 focus-visible:outline-none">
            <LocationSection form={form} set={set} />
          </TabsContent>

          {/* Tab 4: Operations */}
          <TabsContent value="operations" className="mt-0 space-y-4 focus-visible:outline-none">
            <OperationsSection form={form} set={set} />
          </TabsContent>

          {/* Tab 5: Payout */}
          <TabsContent value="payout" className="mt-0 space-y-4 focus-visible:outline-none">
            <PayoutSection form={form} set={set} />
          </TabsContent>

          {/* Tab 6: Documents */}
          <TabsContent value="documents" className="mt-0 space-y-4 focus-visible:outline-none">
            <div className="rounded-xl border border-border/70 bg-card p-4 sm:p-5 shadow-2xs space-y-4">
              <div className="border-b border-border/50 pb-3">
                <h4 className="text-sm font-semibold tracking-tight text-foreground flex items-center gap-2">
                  <FileText className="h-4 w-4 text-primary" />
                  Official Regulatory Documents & Certifications
                </h4>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Replace a document whenever a license or certificate is renewed. Replacing an active document
                  will queue it for compliance verification.
                </p>
              </div>

              <div className="space-y-3.5">
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
              </div>

              <p className="text-[11px] text-muted-foreground pt-1">
                Required documents: {docTypes.map((t) => DOC_LABELS[t]).join(', ')}.
              </p>

              <div className="mt-6 pt-4 border-t border-border/50">
                <h5 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
                  Compliance Review History
                </h5>
                <ReviewTimeline pharmacyId={pharmacy.id} />
              </div>
            </div>
          </TabsContent>
        </div>
      </Tabs>

      {/* Sticky Bottom Action Bar */}
      <div className="flex-shrink-0 px-4 sm:px-6 py-3.5 border-t border-border/60 bg-card/85 backdrop-blur-md flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="text-xs text-muted-foreground flex items-center gap-2 w-full sm:w-auto">
          <ShieldCheck className="h-4 w-4 text-primary flex-shrink-0" />
          <span className="text-[11px] sm:text-xs">
            Profile modifications require administrator review prior to live publication.
          </span>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
          {onClose && (
            <Button
              type="button"
              variant="ghost"
              onClick={onClose}
              disabled={saving || cancelling}
              className="h-9 px-4 text-xs font-medium"
            >
              Close
            </Button>
          )}

          {pendingStatus === 'pending' && (
            <Button
              type="button"
              variant="outline"
              onClick={cancelPending}
              disabled={cancelling || saving}
              className="border-destructive/40 text-destructive hover:bg-destructive/10 gap-1.5 h-9 px-3.5 text-xs font-medium"
            >
              {cancelling ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <X className="h-3.5 w-3.5" />}
              Cancel Request
            </Button>
          )}

          <Button
            onClick={save}
            disabled={saving || cancelling}
            className="gap-2 h-9 px-5 text-xs font-medium shadow-sm flex-1 sm:flex-initial"
          >
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
            {getButtonText()}
          </Button>
        </div>
      </div>
    </div>
  );
}
