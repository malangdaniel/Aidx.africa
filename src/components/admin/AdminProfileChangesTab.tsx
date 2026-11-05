import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Stethoscope,
  Building2,
  Clock,
  CheckCircle2,
  XCircle,
  Search,
  RefreshCw,
  Loader2,
  ArrowRight,
  User,
  MapPin,
  Phone,
  Wallet,
  Calendar,
  AlertTriangle,
  ChevronRight,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  DAYS,
  DAY_LABELS,
  formFromRows,
  pharmacyPatch,
  verificationPatch,
  type PharmacyForm,
  type Section,
} from '@/components/pharmacist/onboarding/pharmacyForm';
import type { PharmacyRow, PharmacyVerificationRow } from '@/services/PharmacyOnboardingService';
import { AdminRpcService } from '@/services/AdminRpcService';
import {
  getDefaultBasicInfo,
  getDefaultCredentials,
  getDefaultExpertise,
  getDefaultAvailability,
  type DoctorBasicInfoData,
  type DoctorCredentialsData,
  type DoctorExpertiseData,
  type DoctorAvailabilityData,
  type PendingDoctorChangesPayload,
} from '@/components/doctor/settings/DoctorProfileSettings';
import type { PendingPharmacyChangesPayload } from '@/components/pharmacist/onboarding/PharmacyProfileSettings';
import { has, isSameValue } from '@/lib/profileChanges';

export interface DoctorChangeItem {
  id: string; // profile id
  userId: string;
  role: 'doctor';
  displayName: string;
  email: string | null;
  submittedAt: string;
  pendingPayload: PendingDoctorChangesPayload;
  currentProfile: {
    first_name: string | null;
    last_name: string | null;
    metadata: Record<string, any>;
  };
  currentDoctorRecord?: {
    license_number: string | null;
    specialties: string[] | null;
    consult_price: number | null;
    bio: string | null;
  } | null;
}

export interface PharmacyChangeItem {
  id: string; // pharmacy id
  userId: string;
  role: 'pharmacy';
  displayName: string;
  email: string | null;
  submittedAt: string;
  pendingPayload: PendingPharmacyChangesPayload;
  currentPharmacy: PharmacyRow;
  currentVerification?: PharmacyVerificationRow | null;
  currentForm: PharmacyForm;
  /** Live form with the proposed (edited) fields applied on top. */
  proposedForm: PharmacyForm;
}

export type ProfileChangeItem = DoctorChangeItem | PharmacyChangeItem;

// Supabase update payloads must match the generated Json type; arbitrary
// metadata blobs are safe to cast since they are written verbatim.
const toMeta = (value: unknown): Record<string, any> => value as Record<string, any>;

// -------------------------------------------------------------
// Live vs proposed data
// -------------------------------------------------------------
interface DoctorSnapshot {
  firstName: string;
  lastName: string;
  basicInfo: DoctorBasicInfoData;
  credentials: DoctorCredentialsData;
  expertise: DoctorExpertiseData;
  availability: DoctorAvailabilityData;
}

/** The doctor's current live data (same sources/precedence the doctor's own settings page uses). */
function buildLiveDoctor(item: DoctorChangeItem): DoctorSnapshot {
  const dp = item.currentProfile.metadata?.doctorProfile || {};
  const doc = item.currentDoctorRecord;
  const basicInfo = { ...getDefaultBasicInfo(), ...(dp.basicInfo || {}) };
  const credentials = { ...getDefaultCredentials(), ...(dp.credentials || {}) };
  const expertise = { ...getDefaultExpertise(), ...(dp.expertise || {}) };
  const availability = { ...getDefaultAvailability(), ...(dp.availability || {}) };
  if (doc) {
    credentials.specialty = doc.specialties?.[0] || credentials.specialty;
    availability.consultPrice = doc.consult_price?.toString() || availability.consultPrice;
    basicInfo.registrationNumber = doc.license_number || basicInfo.registrationNumber;
    basicInfo.about = basicInfo.about || doc.bio || '';
  }
  return {
    firstName: item.currentProfile.first_name || '',
    lastName: item.currentProfile.last_name || '',
    basicInfo,
    credentials,
    expertise,
    availability,
  };
}

/** Live data with only the edited fields from the request applied (also handles legacy full snapshots). */
function buildProposedDoctor(live: DoctorSnapshot, p: PendingDoctorChangesPayload['pendingChanges']): DoctorSnapshot {
  // The license / registration number is locked once set, so any proposed change to it is ignored.
  const basicInfo = { ...live.basicInfo, ...(p.basicInfo || {}) };
  if (live.basicInfo.registrationNumber?.trim()) basicInfo.registrationNumber = live.basicInfo.registrationNumber;
  return {
    firstName: p.firstName ?? live.firstName,
    lastName: p.lastName ?? live.lastName,
    basicInfo,
    credentials: { ...live.credentials, ...(p.credentials || {}) },
    expertise: { ...live.expertise, ...(p.expertise || {}) },
    availability: { ...live.availability, ...(p.availability || {}) },
  };
}

/** Keeps only the keys of `next` whose serialised value differs from `prev`. */
function diffPatch<T extends Record<string, any>>(next: T, prev: T): Partial<T> {
  const out: Record<string, any> = {};
  Object.keys(next).forEach((k) => {
    if (JSON.stringify(next[k]) !== JSON.stringify(prev[k])) out[k] = next[k];
  });
  return out as Partial<T>;
}

interface Props {
  onCountChange?: (count: number) => void;
}

export default function AdminProfileChangesTab({ onCountChange }: Props) {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [filterRole, setFilterRole] = useState<'all' | 'doctor' | 'pharmacy'>('all');

  const [doctorItems, setDoctorItems] = useState<DoctorChangeItem[]>([]);
  const [pharmacyItems, setPharmacyItems] = useState<PharmacyChangeItem[]>([]);

  // Selected item for detail view modal
  const [selectedItem, setSelectedItem] = useState<ProfileChangeItem | null>(null);

  // Approval / Rejection action state
  const [confirmApproveOpen, setConfirmApproveOpen] = useState(false);
  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [actionBusy, setActionBusy] = useState(false);

  const loadRequests = useCallback(async () => {
    try {
      // 1. Fetch pending doctors
      const { data: profilesData, error: profErr } = await supabase
        .from('profiles')
        .select('id, user_id, first_name, last_name, role, metadata, phone, updated_at')
        .eq('role', 'doctor');

      if (profErr) throw profErr;

      // Filter in JS for pending status
      const pendingDoctorsRaw = (profilesData || []).filter((p) => {
        const meta = (p.metadata as Record<string, any>) || {};
        const pending = meta.pending_doctor_changes as PendingDoctorChangesPayload | undefined;
        return pending && pending.pendingChangesStatus === 'pending';
      });

      // Load associated doctors table rows and user emails
      const doctorUserIds = pendingDoctorsRaw.map((p) => p.user_id).filter(Boolean);
      let doctorRowsMap: Record<string, any> = {};
      let userEmailMap: Record<string, string> = {};

      if (doctorUserIds.length > 0) {
        const { data: dRows } = await supabase
          .from('doctors')
          .select('id, user_id, license_number, specialties, consult_price, bio')
          .in('user_id', doctorUserIds);
        if (dRows) {
          dRows.forEach((r) => {
            if (r.user_id) doctorRowsMap[r.user_id] = r;
          });
        }

        try {
          const adminUsers = await AdminRpcService.listUsers({ role: 'doctor', limit: 200 });
          adminUsers.forEach((u) => {
            if (u.user_id && u.email) userEmailMap[u.user_id] = u.email;
          });
        } catch (e) {
          console.warn('Could not fetch doctor emails via AdminRpcService:', e);
        }
      }

      const docItems: DoctorChangeItem[] = pendingDoctorsRaw.map((p) => {
        const meta = (p.metadata as Record<string, any>) || {};
        const pending = meta.pending_doctor_changes as PendingDoctorChangesPayload;
        const dRec = doctorRowsMap[p.user_id] || null;
        const doctorEmail =
          userEmailMap[p.user_id] ||
          meta.email ||
          p.phone ||
          null;

        const displayName =
          [pending.pendingChanges?.firstName || p.first_name, pending.pendingChanges?.lastName || p.last_name]
            .filter(Boolean)
            .join(' ') ||
          doctorEmail ||
          'Unnamed Doctor';

        return {
          id: p.id,
          userId: p.user_id,
          role: 'doctor',
          displayName,
          email: doctorEmail,
          submittedAt: pending.pendingChangesSubmittedAt || p.updated_at,
          pendingPayload: pending,
          currentProfile: {
            first_name: p.first_name,
            last_name: p.last_name,
            metadata: meta,
          },
          currentDoctorRecord: dRec,
        };
      });

      // 2. Fetch pending pharmacies
      const { data: pharmaciesData, error: pharmErr } = await supabase
        .from('pharmacies')
        .select('*');

      if (pharmErr) throw pharmErr;

      const pendingPharmaciesRaw = (pharmaciesData || []).filter((ph) => {
        const meta = (ph.metadata as Record<string, any>) || {};
        const pending = meta.pending_changes as PendingPharmacyChangesPayload | undefined;
        return pending && pending.status === 'pending';
      });

      const pharmacyIds = pendingPharmaciesRaw.map((ph) => ph.id);
      let verifMap: Record<string, PharmacyVerificationRow> = {};
      if (pharmacyIds.length > 0) {
        const { data: vRows } = await supabase
          .from('pharmacy_verification')
          .select('*')
          .in('pharmacy_id', pharmacyIds);
        if (vRows) {
          vRows.forEach((v) => {
            if (v.pharmacy_id) verifMap[v.pharmacy_id] = v as PharmacyVerificationRow;
          });
        }
      }

      const pharmItems: PharmacyChangeItem[] = pendingPharmaciesRaw.map((ph) => {
        const meta = (ph.metadata as Record<string, any>) || {};
        const pending = meta.pending_changes as PendingPharmacyChangesPayload;
        const vRec = verifMap[ph.id] || null;
        const currentForm = vRec ? formFromRows(ph as PharmacyRow, vRec) : formFromRows(ph as PharmacyRow, {} as any);
        // New requests store only the edited fields (`changes`); legacy ones stored the whole form.
        const proposedForm: PharmacyForm = pending.changes
          ? { ...currentForm, ...pending.changes }
          : pending.form
          ? { ...currentForm, ...pending.form }
          : currentForm;

        return {
          id: ph.id,
          userId: ph.user_id,
          role: 'pharmacy',
          displayName: proposedForm.business_name || ph.business_name || 'Unnamed Pharmacy',
          email: proposedForm.email || ph.email,
          submittedAt: pending.submitted_at || ph.updated_at,
          pendingPayload: pending,
          currentPharmacy: ph as PharmacyRow,
          currentVerification: vRec,
          currentForm,
          proposedForm,
        };
      });

      setDoctorItems(docItems);
      setPharmacyItems(pharmItems);
      onCountChange?.(docItems.length + pharmItems.length);
    } catch (err: any) {
      console.error('Error loading pending profile changes:', err);
      toast.error('Failed to load profile changes: ' + err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [onCountChange]);

  useEffect(() => {
    loadRequests();
  }, [loadRequests]);

  const handleRefresh = () => {
    setRefreshing(true);
    loadRequests();
  };

  // Combined and filtered items
  const allItems: ProfileChangeItem[] = useMemo(() => {
    const list = [...doctorItems, ...pharmacyItems];
    return list.sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime());
  }, [doctorItems, pharmacyItems]);

  const filteredItems = useMemo(() => {
    return allItems.filter((item) => {
      if (filterRole !== 'all' && item.role !== filterRole) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        const matchesName = item.displayName.toLowerCase().includes(q);
        const matchesEmail = item.email?.toLowerCase().includes(q) ?? false;
        return matchesName || matchesEmail;
      }
      return true;
    });
  }, [allItems, filterRole, search]);

  // Compute key diff summary tags for cards
  const getDiffSummary = (item: ProfileChangeItem): string[] => {
    const diffs: string[] = [];
    if (item.role === 'doctor') {
      const live = buildLiveDoctor(item);
      const prop = buildProposedDoctor(live, item.pendingPayload.pendingChanges || {});
      const changed = (a: Record<string, any>, b: Record<string, any>) =>
        Object.keys(b).some((k) => !isSameValue(a[k], b[k]));

      if (prop.firstName !== live.firstName || prop.lastName !== live.lastName) diffs.push('Name');
      if (!isSameValue(prop.credentials.specialty, live.credentials.specialty)) diffs.push('Specialty');
      if (!isSameValue(prop.availability.consultPrice, live.availability.consultPrice)) diffs.push('Consult Price');
      if (!isSameValue(prop.basicInfo.registrationNumber, live.basicInfo.registrationNumber)) diffs.push('License Number');
      if (!isSameValue(prop.basicInfo.about, live.basicInfo.about)) diffs.push('Bio');
      if (
        prop.availability.workingHoursStart !== live.availability.workingHoursStart ||
        prop.availability.workingHoursEnd !== live.availability.workingHoursEnd
      ) {
        diffs.push('Working Hours');
      }
      if (changed(live.expertise, prop.expertise)) diffs.push('Expertise');
      // Anything else that was edited (other basic info / credentials / availability fields)
      const otherBasic = Object.keys(prop.basicInfo).some(
        (k) => !['registrationNumber', 'about'].includes(k) && !isSameValue((live.basicInfo as any)[k], (prop.basicInfo as any)[k])
      );
      const otherCred =
        Object.keys(prop.credentials).some(
          (k) => k !== 'specialty' && !isSameValue((live.credentials as any)[k], (prop.credentials as any)[k])
        );
      const otherAvail = Object.keys(prop.availability).some(
        (k) =>
          !['consultPrice', 'workingHoursStart', 'workingHoursEnd'].includes(k) &&
          !isSameValue((live.availability as any)[k], (prop.availability as any)[k])
      );
      if (otherBasic) diffs.push('Basic Info');
      if (otherCred) diffs.push('Credentials');
      if (otherAvail) diffs.push('Availability');
      if (diffs.length === 0) diffs.push('Profile details');
    } else {
      const pForm = item.proposedForm;
      const cForm = item.currentForm;

      if (pForm.business_name !== cForm.business_name) diffs.push('Business Name');
      if (pForm.phone !== cForm.phone || pForm.whatsapp_number !== cForm.whatsapp_number) diffs.push('Phone / WhatsApp');
      if (pForm.state !== cForm.state || pForm.city !== cForm.city || pForm.street !== cForm.street) diffs.push('Location');
      if (pForm.offers_delivery !== cForm.offers_delivery || pForm.delivery_fee !== cForm.delivery_fee) diffs.push('Delivery Settings');
      if (pForm.payout_bank_name !== cForm.payout_bank_name || pForm.payout_account_number !== cForm.payout_account_number) diffs.push('Payout Account');
      if (pForm.pharmacist_full_name !== cForm.pharmacist_full_name) diffs.push('Superintendent Pharmacist');
      if (diffs.length === 0) diffs.push('Operational Settings');
    }
    return diffs;
  };

  // All writes go through one admin-only database function: the profiles / doctors /
  // pharmacies tables only allow owners to update their own rows, and guard triggers
  // restrict direct writes, so a plain client-side UPDATE by the admin matches 0 rows.
  const applyChange = async (args: {
    kind: 'doctor' | 'pharmacy';
    userId: string;
    profile?: Record<string, any>;
    doctor?: Record<string, any>;
    pharmacy?: Record<string, any>;
    verification?: Record<string, any>;
  }) => {
    const { error } = await (supabase.rpc as any)('admin_apply_profile_change', {
      p_kind: args.kind,
      p_user_id: args.userId,
      p_profile: args.profile ?? {},
      p_doctor: args.doctor ?? {},
      p_pharmacy: args.pharmacy ?? {},
      p_verification: args.verification ?? {},
    });
    if (error) throw error;
  };

  // APPROVAL HANDLER
  const handleApprove = async () => {
    if (!selectedItem) return;
    setActionBusy(true);

    try {
      const now = new Date().toISOString();

      if (selectedItem.role === 'doctor') {
        const changes = selectedItem.pendingPayload.pendingChanges || {};
        const curMeta = selectedItem.currentProfile.metadata || {};
        const live = buildLiveDoctor(selectedItem);
        const prop = buildProposedDoctor(live, changes);

        // doctors table: only touch the columns whose source field was edited
        const doctorPatch: Record<string, any> = {};
        if (has(changes.credentials, 'specialty')) {
          doctorPatch.specialties = prop.credentials.specialty ? [prop.credentials.specialty] : [];
        }
        if (has(changes.availability, 'consultPrice')) {
          doctorPatch.consult_price = parseFloat(prop.availability.consultPrice) || 0;
        }
        if (has(changes.basicInfo, 'about')) {
          doctorPatch.bio =
            prop.basicInfo.about?.trim() ||
            `${prop.basicInfo.professionalTitle || 'Dr.'} ${prop.firstName} ${prop.lastName} - ${
              prop.credentials.specialty || 'Medical Professional'
            }`;
        }
        // A doctor with no doctors row yet needs the full set to create one
        if (!selectedItem.currentDoctorRecord) {
          doctorPatch.license_number = prop.basicInfo.registrationNumber?.trim() || null;
          doctorPatch.specialties = prop.credentials.specialty ? [prop.credentials.specialty] : [];
          doctorPatch.consult_price = parseFloat(prop.availability.consultPrice) || 0;
          doctorPatch.bio =
            prop.basicInfo.about?.trim() ||
            `${prop.basicInfo.professionalTitle || 'Dr.'} ${prop.firstName} ${prop.lastName} - ${
              prop.credentials.specialty || 'Medical Professional'
            }`;
        }

        await applyChange({
          kind: 'doctor',
          userId: selectedItem.userId,
          profile: {
            ...(has(changes, 'firstName') ? { first_name: prop.firstName } : {}),
            ...(has(changes, 'lastName') ? { last_name: prop.lastName } : {}),
            metadata: toMeta({
              ...curMeta,
              doctorProfile: {
                basicInfo: prop.basicInfo,
                credentials: prop.credentials,
                expertise: prop.expertise,
                availability: prop.availability,
              },
              pending_doctor_changes: {
                ...selectedItem.pendingPayload,
                pendingChangesStatus: 'approved',
                approvedAt: now,
              },
            }),
          },
          doctor: doctorPatch,
        });

        toast.success(`Approved profile changes for Dr. ${prop.firstName} ${prop.lastName}`);
      } else {
        // PHARMACY APPROVAL — apply only the columns that actually changed
        const cur = selectedItem.currentForm;
        const prop = selectedItem.proposedForm;
        const sections: Section[] = ['business', 'contacts', 'location', 'operations', 'payout'];

        const pharmacyPatchAll: Record<string, any> = {};
        const verificationPatchAll: Record<string, any> = {};
        for (const s of sections) {
          Object.assign(
            pharmacyPatchAll,
            diffPatch(
              pharmacyPatch(prop, s, { licenseLocked: true }) as Record<string, any>,
              pharmacyPatch(cur, s, { licenseLocked: true }) as Record<string, any>,
            ),
          );
          Object.assign(
            verificationPatchAll,
            diffPatch(
              verificationPatch(prop, s, { regLocked: true }) as Record<string, any>,
              verificationPatch(cur, s, { regLocked: true }) as Record<string, any>,
            ),
          );
        }

        const existingMeta = (selectedItem.currentPharmacy.metadata as Record<string, any>) || {};
        await applyChange({
          kind: 'pharmacy',
          userId: selectedItem.userId,
          pharmacy: {
            ...pharmacyPatchAll,
            metadata: toMeta({
              ...existingMeta,
              pending_changes: {
                ...selectedItem.pendingPayload,
                status: 'approved',
                approved_at: now,
              },
            }),
          },
          verification: verificationPatchAll,
        });

        toast.success(`Approved profile changes for ${prop.business_name || 'pharmacy'}`);
      }

      setConfirmApproveOpen(false);
      setSelectedItem(null);
      await loadRequests();
    } catch (err: any) {
      console.error('Error approving profile changes:', err);
      toast.error('Failed to approve changes: ' + (err?.message || 'unknown error'));
    } finally {
      setActionBusy(false);
    }
  };

  // REJECTION HANDLER
  const handleReject = async () => {
    if (!selectedItem) return;
    if (rejectReason.trim().length < 3) {
      toast.error('Please specify a rejection reason (minimum 3 characters).');
      return;
    }

    setActionBusy(true);
    try {
      const now = new Date().toISOString();
      const reasonText = rejectReason.trim();

      if (selectedItem.role === 'doctor') {
        const curMeta = selectedItem.currentProfile.metadata || {};
        await applyChange({
          kind: 'doctor',
          userId: selectedItem.userId,
          profile: {
            metadata: toMeta({
              ...curMeta,
              pending_doctor_changes: {
                ...selectedItem.pendingPayload,
                pendingChangesStatus: 'rejected',
                pendingChangesRejectionReason: reasonText,
                rejectedAt: now,
              },
            }),
          },
        });
        toast.success('Doctor change request rejected with feedback.');
      } else {
        const existingMeta = (selectedItem.currentPharmacy.metadata as Record<string, any>) || {};
        await applyChange({
          kind: 'pharmacy',
          userId: selectedItem.userId,
          pharmacy: {
            metadata: toMeta({
              ...existingMeta,
              pending_changes: {
                ...selectedItem.pendingPayload,
                status: 'rejected',
                rejection_reason: reasonText,
                rejected_at: now,
              },
            }),
          },
        });
        toast.success('Pharmacy change request rejected with feedback.');
      }

      setRejectModalOpen(false);
      setRejectReason('');
      setSelectedItem(null);
      await loadRequests();
    } catch (err: any) {
      console.error('Error rejecting profile changes:', err);
      toast.error('Failed to reject changes: ' + (err?.message || 'unknown error'));
    } finally {
      setActionBusy(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 space-y-3">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
        <p className="text-xs text-muted-foreground">Checking for pending profile change requests...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Top Header & Metrics */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold tracking-tight">Profile Change Requests</h2>
            <Badge variant="secondary" className="font-semibold text-xs">
              {allItems.length} Pending
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            Review and approve modifications to doctor and pharmacy public profiles before they go live
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={refreshing}
            className="gap-1.5 text-xs h-8"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
        <div className="flex items-center gap-1.5 p-1 bg-muted/60 rounded-lg border w-fit">
          <Button
            variant={filterRole === 'all' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setFilterRole('all')}
            className="text-xs h-7 px-3 rounded-md"
          >
            All ({allItems.length})
          </Button>
          <Button
            variant={filterRole === 'doctor' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setFilterRole('doctor')}
            className="text-xs h-7 px-3 rounded-md gap-1"
          >
            <Stethoscope className="w-3.5 h-3.5" />
            Doctors ({doctorItems.length})
          </Button>
          <Button
            variant={filterRole === 'pharmacy' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setFilterRole('pharmacy')}
            className="text-xs h-7 px-3 rounded-md gap-1"
          >
            <Building2 className="w-3.5 h-3.5" />
            Pharmacies ({pharmacyItems.length})
          </Button>
        </div>

        <div className="relative w-full sm:w-64">
          <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Search provider or email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 text-xs h-8"
          />
        </div>
      </div>

      {/* Request Cards Grid / List */}
      {filteredItems.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center space-y-3">
            <div className="w-12 h-12 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-600">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <p className="text-sm font-semibold">No Pending Change Requests</p>
              <p className="text-xs text-muted-foreground max-w-sm">
                {allItems.length === 0
                  ? 'All doctor and pharmacy profiles are up to date. New submissions will appear here.'
                  : 'No requests matched your filter or search query.'}
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredItems.map((item) => {
            const diffs = getDiffSummary(item);
            const isDoc = item.role === 'doctor';

            return (
              <Card
                key={`${item.role}-${item.id}`}
                className="hover:border-primary/50 transition-colors cursor-pointer flex flex-col justify-between group"
                onClick={() => setSelectedItem(item)}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <div
                        className={`w-8 h-8 rounded-full flex items-center justify-center ${
                          isDoc
                            ? 'bg-blue-500/10 text-blue-600'
                            : 'bg-emerald-500/10 text-emerald-600'
                        }`}
                      >
                        {isDoc ? (
                          <Stethoscope className="w-4 h-4" />
                        ) : (
                          <Building2 className="w-4 h-4" />
                        )}
                      </div>
                      <div>
                        <CardTitle className="text-sm font-semibold group-hover:text-primary transition-colors line-clamp-1">
                          {item.displayName}
                        </CardTitle>
                        <CardDescription className="text-[11px] line-clamp-1">
                          {item.email || (isDoc ? 'Doctor account' : 'Pharmacy storefront')}
                        </CardDescription>
                      </div>
                    </div>

                    <Badge
                      variant="outline"
                      className={`text-[10px] shrink-0 font-medium ${
                        isDoc
                          ? 'border-blue-300 text-blue-700 bg-blue-50/50 dark:bg-blue-950/30 dark:text-blue-300'
                          : 'border-emerald-300 text-emerald-700 bg-emerald-50/50 dark:bg-emerald-950/30 dark:text-emerald-300'
                      }`}
                    >
                      {isDoc ? 'Doctor' : 'Pharmacy'}
                    </Badge>
                  </div>
                </CardHeader>

                <CardContent className="space-y-3 pt-0">
                  <div className="flex flex-wrap gap-1">
                    {diffs.map((d, i) => (
                      <span
                        key={i}
                        className="text-[10px] px-1.5 py-0.5 rounded bg-muted font-medium text-foreground/80"
                      >
                        {d}
                      </span>
                    ))}
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t text-[11px] text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {new Date(item.submittedAt).toLocaleDateString()}
                    </span>

                    <span className="flex items-center gap-1 font-medium text-primary group-hover:translate-x-0.5 transition-transform">
                      Review diff <ChevronRight className="w-3.5 h-3.5" />
                    </span>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* DETAIL VIEW MODAL */}
      <Dialog
        open={!!selectedItem}
        onOpenChange={(open) => {
          // The confirm / reject dialogs render in their own portals, so clicking inside them counts as an
          // "outside" click for this dialog. Ignore that, otherwise the selected request is cleared before
          // the Approve / Reject handler runs and the click silently does nothing.
          if (!open && !actionBusy && !confirmApproveOpen && !rejectModalOpen) setSelectedItem(null);
        }}
      >
        <DialogContent
          className="max-w-3xl max-h-[90vh] flex flex-col p-0"
          onInteractOutside={(e) => {
            if (confirmApproveOpen || rejectModalOpen) e.preventDefault();
          }}
        >
          <DialogHeader className="p-6 pb-3 border-b">
            <div className="flex items-center justify-between pr-6">
              <div className="flex items-center gap-2.5">
                <div
                  className={`w-9 h-9 rounded-full flex items-center justify-center ${
                    selectedItem?.role === 'doctor'
                      ? 'bg-blue-500/10 text-blue-600'
                      : 'bg-emerald-500/10 text-emerald-600'
                  }`}
                >
                  {selectedItem?.role === 'doctor' ? (
                    <Stethoscope className="w-5 h-5" />
                  ) : (
                    <Building2 className="w-5 h-5" />
                  )}
                </div>
                <div>
                  <DialogTitle className="text-base font-bold">
                    {selectedItem?.displayName}
                  </DialogTitle>
                  <DialogDescription className="text-xs">
                    {selectedItem?.role === 'doctor' ? 'Doctor Profile' : 'Pharmacy Storefront'} •
                    Submitted on {selectedItem && new Date(selectedItem.submittedAt).toLocaleString()}
                  </DialogDescription>
                </div>
              </div>

              <Badge variant="outline" className="text-xs font-semibold">
                Status: Pending Review
              </Badge>
            </div>
          </DialogHeader>

          <ScrollArea className="flex-1 p-6">
            {selectedItem?.role === 'doctor' && (
              <DoctorDiffSection item={selectedItem as DoctorChangeItem} />
            )}

            {selectedItem?.role === 'pharmacy' && (
              <PharmacyDiffSection item={selectedItem as PharmacyChangeItem} />
            )}
          </ScrollArea>

          <DialogFooter className="p-4 border-t bg-muted/20 flex flex-row items-center justify-end gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSelectedItem(null)}
              disabled={actionBusy}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => setRejectModalOpen(true)}
              disabled={actionBusy}
              className="gap-1.5"
            >
              <XCircle className="w-4 h-4" />
              Reject Request
            </Button>
            <Button
              variant="default"
              size="sm"
              onClick={() => setConfirmApproveOpen(true)}
              disabled={actionBusy}
              className="gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              <CheckCircle2 className="w-4 h-4" />
              Approve Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* CONFIRM APPROVAL MODAL */}
      <Dialog open={confirmApproveOpen} onOpenChange={setConfirmApproveOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-bold flex items-center gap-2 text-emerald-600">
              <CheckCircle2 className="w-5 h-5" />
              Confirm Approval
            </DialogTitle>
            <DialogDescription className="text-xs">
              Are you sure you want to approve these changes for{' '}
              <span className="font-semibold text-foreground">{selectedItem?.displayName}</span>?
              The modifications will be immediately applied to the live database and made visible to
              all patients and customers.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setConfirmApproveOpen(false)}
              disabled={actionBusy}
            >
              Cancel
            </Button>
            <Button
              variant="default"
              size="sm"
              onClick={handleApprove}
              disabled={actionBusy}
              className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5"
            >
              {actionBusy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
              Yes, Publish Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* REJECTION REASON MODAL */}
      <Dialog open={rejectModalOpen} onOpenChange={setRejectModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-bold flex items-center gap-2 text-destructive">
              <XCircle className="w-5 h-5" />
              Reject Profile Changes
            </DialogTitle>
            <DialogDescription className="text-xs">
              Please explain why these changes cannot be approved. This reason will be displayed directly
              to the provider so they can correct their information and resubmit.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2 py-2">
            <Label htmlFor="rejection-reason" className="text-xs font-semibold">
              Rejection Reason <span className="text-destructive">*</span>
            </Label>
            <Textarea
              id="rejection-reason"
              rows={4}
              placeholder="e.g. The uploaded license number does not match MDCN records, or consultation price is outside allowed limits."
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              className="text-xs"
            />
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setRejectModalOpen(false)}
              disabled={actionBusy}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={handleReject}
              disabled={actionBusy || rejectReason.trim().length < 3}
              className="gap-1.5"
            >
              {actionBusy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <XCircle className="w-3.5 h-3.5" />}
              Confirm Rejection
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// -------------------------------------------------------------
// HELPERS: Field diff rows (only edited fields are shown)
// -------------------------------------------------------------
interface DiffEntry {
  label: string;
  oldVal: any;
  newVal: any;
}

const displayValue = (v: any): string =>
  v === null || v === undefined || v === ''
    ? '—'
    : Array.isArray(v)
    ? v.join(', ') || '—'
    : String(v);

const yn = (b: unknown) => (b ? 'Yes' : 'No');

const isEntryChanged = (e: DiffEntry) => displayValue(e.oldVal) !== displayValue(e.newVal);

function DiffRow({ label, oldVal, newVal }: DiffEntry) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-2 py-2 px-2.5 rounded-md text-xs bg-amber-500/10 border border-amber-500/20">
      <div className="font-medium text-muted-foreground flex items-center gap-1.5">
        {label}
        <span className="text-[10px] font-semibold text-amber-600 dark:text-amber-400">(Modified)</span>
      </div>

      <div className="text-muted-foreground break-words line-through md:no-underline">
        <span className="md:hidden font-semibold text-[10px] mr-1">Current:</span>
        {displayValue(oldVal)}
      </div>

      <div className="break-words font-semibold text-amber-700 dark:text-amber-300">
        <span className="md:hidden font-semibold text-[10px] mr-1">Proposed:</span>
        {displayValue(newVal)}
      </div>
    </div>
  );
}

/** A titled group of rows; renders nothing when none of its fields were edited. */
function DiffGroup({
  icon,
  title,
  entries,
}: {
  icon: React.ReactNode;
  title: string;
  entries: DiffEntry[];
}) {
  const changed = entries.filter(isEntryChanged);
  if (changed.length === 0) return null;
  return (
    <div className="space-y-1">
      <h4 className="text-xs font-bold uppercase tracking-wider text-primary flex items-center gap-1.5">
        {icon} {title}
      </h4>
      <div className="space-y-0.5">
        {changed.map((e) => (
          <DiffRow key={e.label} {...e} />
        ))}
      </div>
    </div>
  );
}

function DiffHeader() {
  return (
    <div className="hidden md:grid grid-cols-3 gap-2 px-2.5 text-[11px] font-bold text-muted-foreground uppercase tracking-wider pb-1 border-b">
      <span>Field</span>
      <span>Current Live Data</span>
      <span>Proposed Change</span>
    </div>
  );
}

function NoDifferences() {
  return (
    <p className="text-xs text-muted-foreground py-6 text-center">
      No field-level differences were found between the live profile and this request.
    </p>
  );
}

// -------------------------------------------------------------
// HELPER COMPONENT: Doctor Diff Section
// -------------------------------------------------------------
function DoctorDiffSection({ item }: { item: DoctorChangeItem }) {
  const live = buildLiveDoctor(item);
  const prop = buildProposedDoctor(live, item.pendingPayload.pendingChanges || {});

  const groups: { icon: React.ReactNode; title: string; entries: DiffEntry[] }[] = [
    {
      icon: <User className="w-3.5 h-3.5" />,
      title: 'Basic Identification',
      entries: [
        { label: 'First Name', oldVal: live.firstName, newVal: prop.firstName },
        { label: 'Last Name', oldVal: live.lastName, newVal: prop.lastName },
        { label: 'Professional Title', oldVal: live.basicInfo.professionalTitle, newVal: prop.basicInfo.professionalTitle },
        { label: 'License / Registration No.', oldVal: live.basicInfo.registrationNumber, newVal: prop.basicInfo.registrationNumber },
        { label: 'Licensing Authority', oldVal: live.basicInfo.licensingAuthority, newVal: prop.basicInfo.licensingAuthority },
        { label: 'Year of Graduation', oldVal: live.basicInfo.yearOfGraduation, newVal: prop.basicInfo.yearOfGraduation },
        { label: 'Gender', oldVal: live.basicInfo.gender, newVal: prop.basicInfo.gender },
        { label: 'City / State', oldVal: live.basicInfo.city, newVal: prop.basicInfo.city },
        { label: 'Country', oldVal: live.basicInfo.country, newVal: prop.basicInfo.country },
        { label: 'Languages', oldVal: live.basicInfo.languages, newVal: prop.basicInfo.languages },
        { label: 'About / Bio', oldVal: live.basicInfo.about, newVal: prop.basicInfo.about },
        { label: 'Profile Photo', oldVal: live.basicInfo.profilePhoto, newVal: prop.basicInfo.profilePhoto },
      ],
    },
    {
      icon: <Stethoscope className="w-3.5 h-3.5" />,
      title: 'Professional Credentials',
      entries: [
        { label: 'Primary Specialty', oldVal: live.credentials.specialty, newVal: prop.credentials.specialty },
        { label: 'Sub-Specialty', oldVal: live.credentials.subSpecialty, newVal: prop.credentials.subSpecialty },
        { label: 'Primary Medical Degree', oldVal: live.credentials.primaryDegree, newVal: prop.credentials.primaryDegree },
        { label: 'Years of Experience', oldVal: live.credentials.yearsExperience, newVal: prop.credentials.yearsExperience },
        { label: 'Current Affiliations', oldVal: live.credentials.currentAffiliations, newVal: prop.credentials.currentAffiliations },
        { label: 'Past Institutions', oldVal: live.credentials.pastInstitutions, newVal: prop.credentials.pastInstitutions },
        { label: 'Postgrad Qualifications', oldVal: live.credentials.postgraduateQualifications, newVal: prop.credentials.postgraduateQualifications },
        { label: 'Certifications', oldVal: live.credentials.certifications, newVal: prop.credentials.certifications },
        { label: 'Fellowships', oldVal: live.credentials.fellowships, newVal: prop.credentials.fellowships },
      ],
    },
    {
      icon: <Stethoscope className="w-3.5 h-3.5" />,
      title: 'Areas of Expertise',
      entries: [
        { label: 'Conditions Treated', oldVal: live.expertise.conditionsTreated, newVal: prop.expertise.conditionsTreated },
        { label: 'Clinical Interests', oldVal: live.expertise.clinicalInterests, newVal: prop.expertise.clinicalInterests },
        { label: 'Target Age Groups', oldVal: live.expertise.ageGroups, newVal: prop.expertise.ageGroups },
        { label: 'Consultation Scopes', oldVal: live.expertise.consultationScopes, newVal: prop.expertise.consultationScopes },
      ],
    },
    {
      icon: <Calendar className="w-3.5 h-3.5" />,
      title: 'Consultation & Pricing',
      entries: [
        { label: 'Consultation Price (NGN)', oldVal: live.availability.consultPrice, newVal: prop.availability.consultPrice },
        { label: 'Consultation Modes', oldVal: live.availability.consultationModes, newVal: prop.availability.consultationModes },
        { label: 'Available Days', oldVal: live.availability.availableDays, newVal: prop.availability.availableDays },
        {
          label: 'Working Hours',
          oldVal: `${live.availability.workingHoursStart} - ${live.availability.workingHoursEnd}`,
          newVal: `${prop.availability.workingHoursStart} - ${prop.availability.workingHoursEnd}`,
        },
        { label: 'Timezone', oldVal: live.availability.timezone, newVal: prop.availability.timezone },
        { label: 'Avg Response Time', oldVal: live.availability.avgResponseTime, newVal: prop.availability.avgResponseTime },
        { label: 'Max Consults / Day', oldVal: live.availability.maxConsultationsPerDay, newVal: prop.availability.maxConsultationsPerDay },
        { label: 'Emergency Available', oldVal: yn(live.availability.emergencyAvailable), newVal: yn(prop.availability.emergencyAvailable) },
        { label: 'On-Call Status', oldVal: live.availability.onCallStatus ? 'Active' : 'Inactive', newVal: prop.availability.onCallStatus ? 'Active' : 'Inactive' },
      ],
    },
  ];

  const anyChanged = groups.some((g) => g.entries.some(isEntryChanged));

  return (
    <div className="space-y-6">
      <DiffHeader />
      {anyChanged ? groups.map((g) => <DiffGroup key={g.title} {...g} />) : <NoDifferences />}
    </div>
  );
}

// -------------------------------------------------------------
// HELPER COMPONENT: Pharmacy Diff Section
// -------------------------------------------------------------
const summariseHours = (h: PharmacyForm['opening_hours']) =>
  DAYS.map((d) => `${DAY_LABELS[d].slice(0, 3)} ${h[d].closed ? 'closed' : `${h[d].open}-${h[d].close}`}`).join(', ');

function PharmacyDiffSection({ item }: { item: PharmacyChangeItem }) {
  const p = item.proposedForm;
  const c = item.currentForm;

  const groups: { icon: React.ReactNode; title: string; entries: DiffEntry[] }[] = [
    {
      icon: <Building2 className="w-3.5 h-3.5" />,
      title: 'Business Information',
      entries: [
        { label: 'Registered Business Name', oldVal: c.business_name, newVal: p.business_name },
        { label: 'Trading / Store Name', oldVal: c.trading_name, newVal: p.trading_name },
        { label: 'Business Email', oldVal: c.email, newVal: p.email },
        { label: 'Business Phone', oldVal: c.phone, newVal: p.phone },
        { label: 'WhatsApp Number', oldVal: c.whatsapp_number, newVal: p.whatsapp_number },
        { label: 'Year Established', oldVal: c.year_established, newVal: p.year_established },
        { label: 'PCN Premises License Expiry', oldVal: c.pcn_premises_license_expiry, newVal: p.pcn_premises_license_expiry },
        { label: 'NAFDAC / NDLEA Number', oldVal: c.nafdac_ndlea_number, newVal: p.nafdac_ndlea_number },
      ],
    },
    {
      icon: <Phone className="w-3.5 h-3.5" />,
      title: 'Contacts & Superintendent Pharmacist',
      entries: [
        { label: 'Superintendent Pharmacist', oldVal: c.pharmacist_full_name, newVal: p.pharmacist_full_name },
        { label: 'Pharmacist Annual License Expiry', oldVal: c.pharmacist_license_expiry, newVal: p.pharmacist_license_expiry },
        { label: 'Pharmacist Phone', oldVal: c.pharmacist_phone, newVal: p.pharmacist_phone },
        { label: 'Pharmacist Email', oldVal: c.pharmacist_email, newVal: p.pharmacist_email },
        { label: 'Contact Person Name', oldVal: c.contact_person_name, newVal: p.contact_person_name },
        { label: 'Contact Person Phone', oldVal: c.contact_person_phone, newVal: p.contact_person_phone },
        { label: 'Contact Person Email', oldVal: c.contact_person_email, newVal: p.contact_person_email },
      ],
    },
    {
      icon: <MapPin className="w-3.5 h-3.5" />,
      title: 'Physical Location',
      entries: [
        { label: 'State', oldVal: c.state, newVal: p.state },
        { label: 'City', oldVal: c.city, newVal: p.city },
        { label: 'Street Address', oldVal: c.street, newVal: p.street },
        { label: 'Landmark', oldVal: c.landmark, newVal: p.landmark },
        { label: 'Latitude', oldVal: c.latitude, newVal: p.latitude },
        { label: 'Longitude', oldVal: c.longitude, newVal: p.longitude },
      ],
    },
    {
      icon: <Clock className="w-3.5 h-3.5" />,
      title: 'Operations & Services',
      entries: [
        { label: 'Opening Hours', oldVal: summariseHours(c.opening_hours), newVal: summariseHours(p.opening_hours) },
        { label: '24-Hour Operation', oldVal: yn(c.is_24_hours), newVal: yn(p.is_24_hours) },
        { label: 'Offers Delivery', oldVal: yn(c.offers_delivery), newVal: yn(p.offers_delivery) },
        { label: 'Delivery Radius (km)', oldVal: c.delivery_radius_km, newVal: p.delivery_radius_km },
        { label: 'Delivery Fee (NGN)', oldVal: c.delivery_fee, newVal: p.delivery_fee },
        { label: 'Offers Pickup', oldVal: yn(c.offers_pickup), newVal: yn(p.offers_pickup) },
        { label: 'Handles Cold-Chain', oldVal: yn(c.handles_cold_chain), newVal: yn(p.handles_cold_chain) },
        { label: 'Handles Controlled Drugs', oldVal: yn(c.handles_controlled_drugs), newVal: yn(p.handles_controlled_drugs) },
        { label: 'Accepts HMO', oldVal: yn(c.accepts_hmo), newVal: yn(p.accepts_hmo) },
        { label: 'HMO Partners', oldVal: c.hmo_partners, newVal: p.hmo_partners },
      ],
    },
    {
      icon: <Wallet className="w-3.5 h-3.5" />,
      title: 'Settlement & Payout Account',
      entries: [
        { label: 'Bank Name', oldVal: c.payout_bank_name, newVal: p.payout_bank_name },
        { label: 'Account Number', oldVal: c.payout_account_number, newVal: p.payout_account_number },
        { label: 'Account Name', oldVal: c.payout_account_name, newVal: p.payout_account_name },
      ],
    },
  ];

  const anyChanged = groups.some((g) => g.entries.some(isEntryChanged));

  return (
    <div className="space-y-6">
      <DiffHeader />
      {anyChanged ? groups.map((g) => <DiffGroup key={g.title} {...g} />) : <NoDifferences />}
    </div>
  );
}
