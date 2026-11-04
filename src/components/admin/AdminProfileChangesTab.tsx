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
  formFromRows,
  pharmacyPatch,
  verificationPatch,
  type PharmacyForm,
  type Section,
} from '@/components/pharmacist/onboarding/pharmacyForm';
import type { PharmacyRow, PharmacyVerificationRow } from '@/services/PharmacyOnboardingService';
import { AdminRpcService } from '@/services/AdminRpcService';
import type {
  DoctorBasicInfoData,
  DoctorCredentialsData,
  DoctorExpertiseData,
  DoctorAvailabilityData,
  PendingDoctorChangesPayload,
} from '@/components/doctor/settings/DoctorProfileSettings';
import type { PendingPharmacyChangesPayload } from '@/components/pharmacist/onboarding/PharmacyProfileSettings';

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
}

export type ProfileChangeItem = DoctorChangeItem | PharmacyChangeItem;

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
          meta.doctorProfile?.basicInfo?.email ||
          pending.pendingChanges?.basicInfo?.email ||
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

        return {
          id: ph.id,
          userId: ph.user_id,
          role: 'pharmacy',
          displayName: pending.form?.business_name || ph.business_name || 'Unnamed Pharmacy',
          email: pending.form?.email || ph.email,
          submittedAt: pending.submitted_at || ph.updated_at,
          pendingPayload: pending,
          currentPharmacy: ph as PharmacyRow,
          currentVerification: vRec,
          currentForm,
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
      const pending = item.pendingPayload.pendingChanges;
      const curProfile = item.currentProfile;
      const curMetaDoc = curProfile.metadata.doctorProfile || {};
      const curDoc = item.currentDoctorRecord;

      if (pending.firstName !== curProfile.first_name || pending.lastName !== curProfile.last_name) {
        diffs.push('Name');
      }
      if (pending.credentials?.specialty && pending.credentials.specialty !== curDoc?.specialties?.[0]) {
        diffs.push('Specialty');
      }
      if (
        pending.availability?.consultPrice &&
        pending.availability.consultPrice !== curDoc?.consult_price?.toString()
      ) {
        diffs.push('Consult Price');
      }
      if (
        pending.basicInfo?.registrationNumber &&
        pending.basicInfo.registrationNumber !== curDoc?.license_number
      ) {
        diffs.push('License Number');
      }
      if (
        pending.basicInfo?.about &&
        pending.basicInfo.about !== (curDoc?.bio || curMetaDoc.basicInfo?.about)
      ) {
        diffs.push('Bio');
      }
      if (
        pending.availability?.workingHoursStart !== curMetaDoc.availability?.workingHoursStart ||
        pending.availability?.workingHoursEnd !== curMetaDoc.availability?.workingHoursEnd
      ) {
        diffs.push('Working Hours');
      }
      if (pending.expertise?.conditionsTreated?.length !== curMetaDoc.expertise?.conditionsTreated?.length) {
        diffs.push('Expertise');
      }
      if (diffs.length === 0) diffs.push('Profile details');
    } else {
      const pForm = item.pendingPayload.form;
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

  // APPROVAL HANDLER
  const handleApprove = async () => {
    if (!selectedItem) return;
    setActionBusy(true);

    try {
      const now = new Date().toISOString();

      if (selectedItem.role === 'doctor') {
        const changes = selectedItem.pendingPayload.pendingChanges;
        const curMeta = selectedItem.currentProfile.metadata || {};

        // 1. Update profiles table
        const { error: profErr } = await supabase
          .from('profiles')
          .update({
            first_name: changes.firstName,
            last_name: changes.lastName,
            updated_at: now,
            metadata: {
              ...curMeta,
              doctorProfile: {
                basicInfo: changes.basicInfo,
                credentials: changes.credentials,
                expertise: changes.expertise,
                availability: changes.availability,
              },
              pending_doctor_changes: {
                ...selectedItem.pendingPayload,
                pendingChangesStatus: 'approved',
                approvedAt: now,
              },
            },
          })
          .eq('user_id', selectedItem.userId);

        if (profErr) throw profErr;

        // 2. Update doctors table
        const basic = changes.basicInfo || ({} as DoctorBasicInfoData);
        const cred = changes.credentials || ({} as DoctorCredentialsData);
        const avail = changes.availability || ({} as DoctorAvailabilityData);

        const { data: existingDoctor } = await supabase
          .from('doctors')
          .select('id')
          .eq('user_id', selectedItem.userId)
          .maybeSingle();

        const doctorTableData = {
          user_id: selectedItem.userId,
          license_number: basic.registrationNumber || null,
          specialties: cred.specialty ? [cred.specialty] : [],
          consult_price: parseFloat(avail.consultPrice) || 0,
          bio:
            basic.about?.trim() ||
            `${basic.professionalTitle || 'Dr.'} ${changes.firstName} ${changes.lastName} - ${
              cred.specialty || 'Medical Professional'
            }`,
          updated_at: now,
        };

        if (existingDoctor) {
          const { error: docErr } = await supabase
            .from('doctors')
            .update(doctorTableData)
            .eq('id', existingDoctor.id);
          if (docErr) throw docErr;
        } else {
          const { error: docErr } = await supabase
            .from('doctors')
            .insert(doctorTableData);
          if (docErr) throw docErr;
        }

        toast.success(`Approved profile changes for Dr. ${changes.firstName} ${changes.lastName}`);
      } else {
        // PHARMACY APPROVAL
        const { form } = selectedItem.pendingPayload;
        const sections: Section[] = ['business', 'contacts', 'location', 'operations', 'payout'];

        for (const s of sections) {
          const pPatch = pharmacyPatch(form, s, { licenseLocked: true });
          const vPatch = verificationPatch(form, s, { regLocked: true });

          if (Object.keys(pPatch).length > 0) {
            const { error: pErr } = await supabase
              .from('pharmacies')
              .update({ ...pPatch, updated_at: now })
              .eq('id', selectedItem.id);
            if (pErr) throw pErr;
          }

          if (Object.keys(vPatch).length > 0) {
            const { error: vErr } = await supabase
              .from('pharmacy_verification')
              .update({ ...vPatch, updated_at: now })
              .eq('pharmacy_id', selectedItem.id);
            if (vErr) throw vErr;
          }
        }

        // Update metadata on pharmacies table
        const existingMeta = (selectedItem.currentPharmacy.metadata as Record<string, any>) || {};
        const updatedMeta = {
          ...existingMeta,
          pending_changes: {
            ...selectedItem.pendingPayload,
            status: 'approved',
            approved_at: now,
          },
        };

        const { error: mErr } = await supabase
          .from('pharmacies')
          .update({
            metadata: updatedMeta,
            updated_at: now,
          })
          .eq('id', selectedItem.id);

        if (mErr) throw mErr;

        toast.success(`Approved profile changes for ${form.business_name || 'pharmacy'}`);
      }

      setConfirmApproveOpen(false);
      setSelectedItem(null);
      await loadRequests();
    } catch (err: any) {
      console.error('Error approving profile changes:', err);
      toast.error('Failed to approve changes: ' + err.message);
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
        const { error } = await supabase
          .from('profiles')
          .update({
            metadata: {
              ...curMeta,
              pending_doctor_changes: {
                ...selectedItem.pendingPayload,
                pendingChangesStatus: 'rejected',
                pendingChangesRejectionReason: reasonText,
                rejectedAt: now,
              },
            },
            updated_at: now,
          })
          .eq('user_id', selectedItem.userId);

        if (error) throw error;
        toast.success('Doctor change request rejected with feedback.');
      } else {
        const existingMeta = (selectedItem.currentPharmacy.metadata as Record<string, any>) || {};
        const { error } = await supabase
          .from('pharmacies')
          .update({
            metadata: {
              ...existingMeta,
              pending_changes: {
                ...selectedItem.pendingPayload,
                status: 'rejected',
                rejection_reason: reasonText,
                rejected_at: now,
              },
            },
            updated_at: now,
          })
          .eq('id', selectedItem.id);

        if (error) throw error;
        toast.success('Pharmacy change request rejected with feedback.');
      }

      setRejectModalOpen(false);
      setRejectReason('');
      setSelectedItem(null);
      await loadRequests();
    } catch (err: any) {
      console.error('Error rejecting profile changes:', err);
      toast.error('Failed to reject changes: ' + err.message);
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
          if (!open && !actionBusy) setSelectedItem(null);
        }}
      >
        <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col p-0">
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
// HELPER COMPONENT: Field Diff Row
// -------------------------------------------------------------
function DiffRow({
  label,
  oldVal,
  newVal,
}: {
  label: string;
  oldVal: any;
  newVal: any;
}) {
  const oldStr =
    oldVal === null || oldVal === undefined || oldVal === ''
      ? '—'
      : Array.isArray(oldVal)
      ? oldVal.join(', ') || '—'
      : String(oldVal);

  const newStr =
    newVal === null || newVal === undefined || newVal === ''
      ? '—'
      : Array.isArray(newVal)
      ? newVal.join(', ') || '—'
      : String(newVal);

  const isChanged = oldStr !== newStr;

  return (
    <div
      className={`grid grid-cols-1 md:grid-cols-3 gap-2 py-2 px-2.5 rounded-md text-xs transition-colors ${
        isChanged
          ? 'bg-amber-500/10 border border-amber-500/20'
          : 'border-b border-border/40 hover:bg-muted/30'
      }`}
    >
      <div className="font-medium text-muted-foreground flex items-center gap-1.5">
        {label}
        {isChanged && (
          <span className="text-[10px] font-semibold text-amber-600 dark:text-amber-400">
            (Modified)
          </span>
        )}
      </div>

      <div className="text-muted-foreground break-words line-through md:no-underline">
        <span className="md:hidden font-semibold text-[10px] mr-1">Current:</span>
        {oldStr}
      </div>

      <div
        className={`break-words font-medium ${
          isChanged ? 'text-amber-700 dark:text-amber-300 font-semibold' : 'text-foreground'
        }`}
      >
        <span className="md:hidden font-semibold text-[10px] mr-1">Proposed:</span>
        {newStr}
      </div>
    </div>
  );
}

// -------------------------------------------------------------
// HELPER COMPONENT: Doctor Diff Section
// -------------------------------------------------------------
function DoctorDiffSection({ item }: { item: DoctorChangeItem }) {
  const pending = item.pendingPayload.pendingChanges;
  const curProf = item.currentProfile;
  const curMetaDoc = curProf.metadata?.doctorProfile || {};
  const curDoc = item.currentDoctorRecord;

  const curBasic = curMetaDoc.basicInfo || {};
  const curCred = curMetaDoc.credentials || {};
  const curExp = curMetaDoc.expertise || {};
  const curAvail = curMetaDoc.availability || {};

  return (
    <div className="space-y-6">
      {/* Header column labels for desktop */}
      <div className="hidden md:grid grid-cols-3 gap-2 px-2.5 text-[11px] font-bold text-muted-foreground uppercase tracking-wider pb-1 border-b">
        <span>Field</span>
        <span>Current Live Data</span>
        <span>Proposed Change</span>
      </div>

      {/* Identity & Basic Info */}
      <div className="space-y-1">
        <h4 className="text-xs font-bold uppercase tracking-wider text-primary flex items-center gap-1.5">
          <User className="w-3.5 h-3.5" /> Basic Identification
        </h4>
        <div className="space-y-0.5">
          <DiffRow label="First Name" oldVal={curProf.first_name} newVal={pending.firstName} />
          <DiffRow label="Last Name" oldVal={curProf.last_name} newVal={pending.lastName} />
          <DiffRow
            label="Professional Title"
            oldVal={curBasic.professionalTitle}
            newVal={pending.basicInfo?.professionalTitle}
          />
          <DiffRow
            label="License / Registration No."
            oldVal={curDoc?.license_number || curBasic.registrationNumber}
            newVal={pending.basicInfo?.registrationNumber}
          />
          <DiffRow
            label="Licensing Authority"
            oldVal={curBasic.licensingAuthority}
            newVal={pending.basicInfo?.licensingAuthority}
          />
          <DiffRow
            label="Year of Graduation"
            oldVal={curBasic.yearOfGraduation}
            newVal={pending.basicInfo?.yearOfGraduation}
          />
          <DiffRow label="Gender" oldVal={curBasic.gender} newVal={pending.basicInfo?.gender} />
          <DiffRow label="City / State" oldVal={curBasic.city} newVal={pending.basicInfo?.city} />
          <DiffRow label="Country" oldVal={curBasic.country} newVal={pending.basicInfo?.country} />
          <DiffRow
            label="Languages"
            oldVal={curBasic.languages}
            newVal={pending.basicInfo?.languages}
          />
          <DiffRow
            label="About / Bio"
            oldVal={curDoc?.bio || curBasic.about}
            newVal={pending.basicInfo?.about}
          />
        </div>
      </div>

      {/* Credentials */}
      <div className="space-y-1">
        <h4 className="text-xs font-bold uppercase tracking-wider text-primary flex items-center gap-1.5">
          <Stethoscope className="w-3.5 h-3.5" /> Professional Credentials
        </h4>
        <div className="space-y-0.5">
          <DiffRow
            label="Primary Specialty"
            oldVal={curDoc?.specialties?.[0] || curCred.specialty}
            newVal={pending.credentials?.specialty}
          />
          <DiffRow
            label="Sub-Specialty"
            oldVal={curCred.subSpecialty}
            newVal={pending.credentials?.subSpecialty}
          />
          <DiffRow
            label="Primary Medical Degree"
            oldVal={curCred.primaryDegree}
            newVal={pending.credentials?.primaryDegree}
          />
          <DiffRow
            label="Years of Experience"
            oldVal={curCred.yearsExperience}
            newVal={pending.credentials?.yearsExperience}
          />
          <DiffRow
            label="Current Affiliations"
            oldVal={curCred.currentAffiliations}
            newVal={pending.credentials?.currentAffiliations}
          />
          <DiffRow
            label="Postgrad Qualifications"
            oldVal={curCred.postgraduateQualifications}
            newVal={pending.credentials?.postgraduateQualifications}
          />
          <DiffRow
            label="Certifications"
            oldVal={curCred.certifications}
            newVal={pending.credentials?.certifications}
          />
        </div>
      </div>

      {/* Areas of Expertise */}
      <div className="space-y-1">
        <h4 className="text-xs font-bold uppercase tracking-wider text-primary flex items-center gap-1.5">
          <Stethoscope className="w-3.5 h-3.5" /> Areas of Expertise
        </h4>
        <div className="space-y-0.5">
          <DiffRow
            label="Conditions Treated"
            oldVal={curExp.conditionsTreated}
            newVal={pending.expertise?.conditionsTreated}
          />
          <DiffRow
            label="Clinical Interests"
            oldVal={curExp.clinicalInterests}
            newVal={pending.expertise?.clinicalInterests}
          />
          <DiffRow
            label="Target Age Groups"
            oldVal={curExp.ageGroups}
            newVal={pending.expertise?.ageGroups}
          />
          <DiffRow
            label="Consultation Scopes"
            oldVal={curExp.consultationScopes}
            newVal={pending.expertise?.consultationScopes}
          />
        </div>
      </div>

      {/* Availability & Booking */}
      <div className="space-y-1">
        <h4 className="text-xs font-bold uppercase tracking-wider text-primary flex items-center gap-1.5">
          <Calendar className="w-3.5 h-3.5" /> Consultation & Pricing
        </h4>
        <div className="space-y-0.5">
          <DiffRow
            label="Consultation Price (NGN)"
            oldVal={curDoc?.consult_price?.toString() || curAvail.consultPrice}
            newVal={pending.availability?.consultPrice}
          />
          <DiffRow
            label="Consultation Modes"
            oldVal={curAvail.consultationModes}
            newVal={pending.availability?.consultationModes}
          />
          <DiffRow
            label="Available Days"
            oldVal={curAvail.availableDays}
            newVal={pending.availability?.availableDays}
          />
          <DiffRow
            label="Working Hours"
            oldVal={`${curAvail.workingHoursStart || '09:00'} - ${curAvail.workingHoursEnd || '17:00'}`}
            newVal={`${pending.availability?.workingHoursStart} - ${pending.availability?.workingHoursEnd}`}
          />
          <DiffRow
            label="Max Consults / Day"
            oldVal={curAvail.maxConsultationsPerDay}
            newVal={pending.availability?.maxConsultationsPerDay}
          />
          <DiffRow
            label="Emergency Available"
            oldVal={curAvail.emergencyAvailable ? 'Yes' : 'No'}
            newVal={pending.availability?.emergencyAvailable ? 'Yes' : 'No'}
          />
          <DiffRow
            label="On-Call Status"
            oldVal={curAvail.onCallStatus ? 'Active' : 'Inactive'}
            newVal={pending.availability?.onCallStatus ? 'Active' : 'Inactive'}
          />
        </div>
      </div>
    </div>
  );
}

// -------------------------------------------------------------
// HELPER COMPONENT: Pharmacy Diff Section
// -------------------------------------------------------------
function PharmacyDiffSection({ item }: { item: PharmacyChangeItem }) {
  const pendingForm = item.pendingPayload.form;
  const currentForm = item.currentForm;

  return (
    <div className="space-y-6">
      {/* Header column labels for desktop */}
      <div className="hidden md:grid grid-cols-3 gap-2 px-2.5 text-[11px] font-bold text-muted-foreground uppercase tracking-wider pb-1 border-b">
        <span>Field</span>
        <span>Current Live Data</span>
        <span>Proposed Change</span>
      </div>

      {/* Business Information */}
      <div className="space-y-1">
        <h4 className="text-xs font-bold uppercase tracking-wider text-primary flex items-center gap-1.5">
          <Building2 className="w-3.5 h-3.5" /> Business Information
        </h4>
        <div className="space-y-0.5">
          <DiffRow
            label="Registered Business Name"
            oldVal={currentForm.business_name}
            newVal={pendingForm.business_name}
          />
          <DiffRow
            label="Trading / Store Name"
            oldVal={currentForm.trading_name}
            newVal={pendingForm.trading_name}
          />
          <DiffRow
            label="Business Email"
            oldVal={currentForm.email}
            newVal={pendingForm.email}
          />
          <DiffRow
            label="Business Phone"
            oldVal={currentForm.phone}
            newVal={pendingForm.phone}
          />
          <DiffRow
            label="WhatsApp Number"
            oldVal={currentForm.whatsapp_number}
            newVal={pendingForm.whatsapp_number}
          />
          <DiffRow
            label="Year Established"
            oldVal={currentForm.year_established}
            newVal={pendingForm.year_established}
          />
          <DiffRow
            label="PCN Premises License Expiry"
            oldVal={currentForm.pcn_premises_license_expiry}
            newVal={pendingForm.pcn_premises_license_expiry}
          />
          <DiffRow
            label="NAFDAC / NDLEA Number"
            oldVal={currentForm.nafdac_ndlea_number}
            newVal={pendingForm.nafdac_ndlea_number}
          />
        </div>
      </div>

      {/* Contacts & Personnel */}
      <div className="space-y-1">
        <h4 className="text-xs font-bold uppercase tracking-wider text-primary flex items-center gap-1.5">
          <Phone className="w-3.5 h-3.5" /> Contacts & Superintendent Pharmacist
        </h4>
        <div className="space-y-0.5">
          <DiffRow
            label="Superintendent Pharmacist"
            oldVal={currentForm.pharmacist_full_name}
            newVal={pendingForm.pharmacist_full_name}
          />
          <DiffRow
            label="Pharmacist Annual License Expiry"
            oldVal={currentForm.pharmacist_license_expiry}
            newVal={pendingForm.pharmacist_license_expiry}
          />
          <DiffRow
            label="Pharmacist Phone"
            oldVal={currentForm.pharmacist_phone}
            newVal={pendingForm.pharmacist_phone}
          />
          <DiffRow
            label="Pharmacist Email"
            oldVal={currentForm.pharmacist_email}
            newVal={pendingForm.pharmacist_email}
          />
          <DiffRow
            label="Contact Person Name"
            oldVal={currentForm.contact_person_name}
            newVal={pendingForm.contact_person_name}
          />
          <DiffRow
            label="Contact Person Phone"
            oldVal={currentForm.contact_person_phone}
            newVal={pendingForm.contact_person_phone}
          />
          <DiffRow
            label="Contact Person Email"
            oldVal={currentForm.contact_person_email}
            newVal={pendingForm.contact_person_email}
          />
        </div>
      </div>

      {/* Location */}
      <div className="space-y-1">
        <h4 className="text-xs font-bold uppercase tracking-wider text-primary flex items-center gap-1.5">
          <MapPin className="w-3.5 h-3.5" /> Physical Location
        </h4>
        <div className="space-y-0.5">
          <DiffRow label="State" oldVal={currentForm.state} newVal={pendingForm.state} />
          <DiffRow label="City" oldVal={currentForm.city} newVal={pendingForm.city} />
          <DiffRow label="Street Address" oldVal={currentForm.street} newVal={pendingForm.street} />
          <DiffRow label="Landmark" oldVal={currentForm.landmark} newVal={pendingForm.landmark} />
          <DiffRow label="Latitude" oldVal={currentForm.latitude} newVal={pendingForm.latitude} />
          <DiffRow label="Longitude" oldVal={currentForm.longitude} newVal={pendingForm.longitude} />
        </div>
      </div>

      {/* Operations & Schedule */}
      <div className="space-y-1">
        <h4 className="text-xs font-bold uppercase tracking-wider text-primary flex items-center gap-1.5">
          <Clock className="w-3.5 h-3.5" /> Operations & Services
        </h4>
        <div className="space-y-0.5">
          <DiffRow
            label="24-Hour Operation"
            oldVal={currentForm.is_24_hours ? 'Yes' : 'No'}
            newVal={pendingForm.is_24_hours ? 'Yes' : 'No'}
          />
          <DiffRow
            label="Offers Delivery"
            oldVal={currentForm.offers_delivery ? 'Yes' : 'No'}
            newVal={pendingForm.offers_delivery ? 'Yes' : 'No'}
          />
          <DiffRow
            label="Delivery Radius (km)"
            oldVal={currentForm.delivery_radius_km}
            newVal={pendingForm.delivery_radius_km}
          />
          <DiffRow
            label="Delivery Fee (NGN)"
            oldVal={currentForm.delivery_fee}
            newVal={pendingForm.delivery_fee}
          />
          <DiffRow
            label="Offers Pickup"
            oldVal={currentForm.offers_pickup ? 'Yes' : 'No'}
            newVal={pendingForm.offers_pickup ? 'Yes' : 'No'}
          />
          <DiffRow
            label="Handles Cold-Chain"
            oldVal={currentForm.handles_cold_chain ? 'Yes' : 'No'}
            newVal={pendingForm.handles_cold_chain ? 'Yes' : 'No'}
          />
          <DiffRow
            label="Handles Controlled Drugs"
            oldVal={currentForm.handles_controlled_drugs ? 'Yes' : 'No'}
            newVal={pendingForm.handles_controlled_drugs ? 'Yes' : 'No'}
          />
          <DiffRow
            label="Accepts HMO"
            oldVal={currentForm.accepts_hmo ? 'Yes' : 'No'}
            newVal={pendingForm.accepts_hmo ? 'Yes' : 'No'}
          />
          <DiffRow
            label="HMO Partners"
            oldVal={currentForm.hmo_partners}
            newVal={pendingForm.hmo_partners}
          />
        </div>
      </div>

      {/* Payout Details */}
      <div className="space-y-1">
        <h4 className="text-xs font-bold uppercase tracking-wider text-primary flex items-center gap-1.5">
          <Wallet className="w-3.5 h-3.5" /> Settlement & Payout Account
        </h4>
        <div className="space-y-0.5">
          <DiffRow
            label="Bank Name"
            oldVal={currentForm.payout_bank_name}
            newVal={pendingForm.payout_bank_name}
          />
          <DiffRow
            label="Account Number"
            oldVal={currentForm.payout_account_number}
            newVal={pendingForm.payout_account_number}
          />
          <DiffRow
            label="Account Name"
            oldVal={currentForm.payout_account_name}
            newVal={pendingForm.payout_account_name}
          />
        </div>
      </div>
    </div>
  );
}

