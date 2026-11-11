import { useCallback, useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import {
  ArrowLeft, CheckCircle, XCircle, ExternalLink, FileText, Loader2, RefreshCw, Search, ShieldOff, Info, Stethoscope,
} from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import {
  DoctorOnboardingService, DOCTOR_DOC_LABELS, doctorMissingLabel,
  type DoctorDocType, type DoctorRow, type DoctorVerificationRow, type DoctorDocumentRow, type DoctorEventRow,
} from '@/services/DoctorOnboardingService';
import { daysUntil } from '@/services/PharmacyOnboardingService';

// The generated Supabase types predate the doctor onboarding functions.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const rpc = (supabase as any).rpc.bind(supabase) as (fn: string, args?: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string } | null }>;

type ListRow = {
  user_id: string; doctor_id: string; full_name: string; email: string; state: string | null; city: string | null;
  license_number: string | null; verification_status: string; profile_status: string; is_suspended: boolean;
  submitted_at: string | null; docs_total: number; docs_approved: number; license_expiry: string | null; created_at: string;
};

const TABS = [
  { id: 'awaiting_review', label: 'Awaiting review' }, { id: 'needs_info', label: 'Needs info' },
  { id: 'incomplete', label: 'Incomplete' }, { id: 'verified', label: 'Approved' },
  { id: 'rejected', label: 'Rejected' }, { id: 'suspended', label: 'Suspended' }, { id: 'all', label: 'All' },
];
const PAGE = 25;

function ExpiryBadge({ date }: { date?: string | null }) {
  const d = daysUntil(date);
  if (d === null) return <span className="text-muted-foreground">-</span>;
  if (d <= 0) return <Badge variant="destructive" className="text-[10px]">Expired {date}</Badge>;
  if (d <= 30) return <Badge className="text-[10px] bg-amber-100 text-amber-800 border-amber-200" variant="outline">{d}d left · {date}</Badge>;
  return <span className="text-xs">{date}</span>;
}

function StatusChip({ row }: { row: Pick<ListRow, 'verification_status' | 'profile_status' | 'is_suspended'> }) {
  if (row.is_suspended) return <Badge variant="destructive">Suspended</Badge>;
  if (row.verification_status === 'verified') return <Badge className="bg-emerald-600">Approved</Badge>;
  if (row.verification_status === 'rejected') return <Badge variant="destructive">Rejected</Badge>;
  if (row.profile_status === 'submitted') return <Badge className="bg-amber-500">Awaiting review</Badge>;
  if (row.profile_status === 'needs_info') return <Badge variant="outline" className="border-amber-400 text-amber-700">Needs info</Badge>;
  return <Badge variant="secondary">Incomplete</Badge>;
}

export default function AdminDoctorsTab() {
  const [selected, setSelected] = useState<string | null>(null);
  return selected ? <DoctorApplicationDetail userId={selected} onBack={() => setSelected(null)} /> : <DoctorList onOpen={setSelected} />;
}

function DoctorList({ onOpen }: { onOpen: (userId: string) => void }) {
  const [tab, setTab] = useState('awaiting_review');
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(0);
  const [rows, setRows] = useState<ListRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await rpc('admin_list_doctor_applications', {
      p_status: tab === 'all' ? null : tab, p_search: query || null, p_limit: PAGE, p_offset: page * PAGE,
    });
    if (error) toast.error(error.message);
    setRows((data ?? []) as ListRow[]);
    setLoading(false);
  }, [tab, query, page]);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold tracking-tight">Doctors</h2>
          <p className="text-xs text-muted-foreground">Review applications, licenses and documents</p>
        </div>
        <Button variant="outline" size="sm" onClick={load} disabled={loading} className="gap-1.5 self-start">
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
        </Button>
      </div>

      <Tabs value={tab} onValueChange={(v) => { setTab(v); setPage(0); }}>
        <TabsList className="h-auto flex-wrap justify-start">
          {TABS.map((t) => <TabsTrigger key={t.id} value={t.id} className="text-xs">{t.label}</TabsTrigger>)}
        </TabsList>
      </Tabs>

      <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); setPage(0); setQuery(search.trim()); }}>
        <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name, email, license or folio number" className="max-w-sm" />
        <Button type="submit" variant="secondary" size="sm" className="gap-1.5"><Search className="w-3.5 h-3.5" /> Search</Button>
      </form>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-7 h-7 animate-spin text-primary" /></div>
      ) : rows.length === 0 ? (
        <Card className="border-dashed"><CardContent className="py-12 text-center text-sm text-muted-foreground">No doctors in this view.</CardContent></Card>
      ) : (
        <div className="grid gap-3">
          {rows.map((r) => (
            <Card key={r.user_id} className="hover:shadow-sm transition-shadow cursor-pointer" onClick={() => onOpen(r.user_id)}>
              <CardContent className="p-4 flex flex-col md:flex-row md:items-center gap-3 md:justify-between">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0"><Stethoscope className="w-5 h-5" /></div>
                  <div className="min-w-0">
                    <p className="font-semibold text-sm truncate">Dr. {r.full_name || 'Unnamed'}</p>
                    <p className="text-xs text-muted-foreground truncate">{r.email} · {[r.city, r.state].filter(Boolean).join(', ') || 'No location'}</p>
                    <p className="text-[11px] text-muted-foreground">License: <span className="font-mono">{r.license_number || 'n/a'}</span></p>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-3 text-xs">
                  <StatusChip row={r} />
                  <span className="text-muted-foreground">Docs {r.docs_approved}/{r.docs_total}</span>
                  <ExpiryBadge date={r.license_expiry} />
                  <span className="text-muted-foreground">{r.submitted_at ? `Submitted ${format(new Date(r.submitted_at), 'PP')}` : 'Not submitted'}</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <div className="flex justify-between">
        <Button variant="outline" size="sm" disabled={page === 0 || loading} onClick={() => setPage((p) => p - 1)}>Previous</Button>
        <Button variant="outline" size="sm" disabled={rows.length < PAGE || loading} onClick={() => setPage((p) => p + 1)}>Next</Button>
      </div>
    </div>
  );
}

type Detail = {
  user_id: string; email: string;
  account: {
    first_name: string | null; last_name: string | null; phone: string | null; verification_status: string;
    rejection_reason: string | null; verified_at: string | null; created_at: string;
  };
  doctor: DoctorRow & { suspended_reason: string | null };
  verification: Partial<DoctorVerificationRow> | null;
  documents: DoctorDocumentRow[];
  events: DoctorEventRow[];
  missing: string[];
};
type ActionType = 'approve' | 'request_info' | 'reject' | 'suspend' | 'unsuspend';

export function DoctorApplicationDetail({ userId, onBack, backLabel = 'All doctors' }: { userId: string; onBack: () => void; backLabel?: string }) {
  const [d, setD] = useState<Detail | null>(null);
  const [loading, setLoading] = useState(true);
  const [action, setAction] = useState<ActionType | null>(null);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [docDialog, setDocDialog] = useState<{ id: string; type: string } | null>(null);
  const [docNote, setDocNote] = useState('');

  const load = useCallback(async () => {
    const { data, error } = await rpc('admin_get_doctor_application', { p_user_id: userId });
    if (error) toast.error(error.message);
    setD((data ?? null) as Detail | null);
    setLoading(false);
  }, [userId]);
  useEffect(() => { load(); }, [load]);

  const runAction = async () => {
    if (!action) return;
    setBusy(true);
    const { error } = await rpc('admin_review_doctor', { p_user_id: userId, p_action: action, p_message: message.trim() || null });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success('Done');
    setAction(null); setMessage(''); load();
  };

  const reviewDoc = async (id: string, status: 'approved' | 'rejected' | 'pending', note?: string) => {
    const { error } = await rpc('admin_review_doctor_document', { p_document_id: id, p_status: status, p_note: note ?? null });
    if (error) return toast.error(error.message);
    setDocDialog(null); setDocNote(''); load();
  };

  const openDoc = async (path: string) => {
    const url = await DoctorOnboardingService.signedUrl(path, 300);
    if (url) window.open(url, '_blank', 'noopener,noreferrer'); else toast.error('Could not open the document.');
  };

  if (loading) return <div className="flex justify-center py-16"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
  if (!d) return <div className="space-y-3"><Button variant="ghost" onClick={onBack} className="gap-1"><ArrowLeft className="w-4 h-4" /> Back</Button><p className="text-sm">Doctor not found.</p></div>;

  const doc = d.doctor; const v = d.verification ?? {};
  const fullName = [d.account.first_name, d.account.last_name].filter(Boolean).join(' ');
  const status = { verification_status: d.account.verification_status, profile_status: doc.profile_status, is_suspended: doc.is_suspended };
  const hasRejectedDoc = d.documents.some((x) => x.status === 'rejected');
  const canApprove = doc.profile_status === 'submitted' && d.missing.length === 0 && !hasRejectedDoc;
  const isApproved = d.account.verification_status === 'verified';

  const Row = ({ k, children }: { k: string; children: React.ReactNode }) => (
    <div className="flex justify-between gap-3 py-1 text-xs"><span className="text-muted-foreground">{k}</span><span className="font-medium text-right break-words">{children || <span className="text-muted-foreground">-</span>}</span></div>
  );
  const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
    <Card><CardHeader className="pb-2"><CardTitle className="text-sm">{title}</CardTitle></CardHeader><CardContent className="divide-y">{children}</CardContent></Card>
  );

  const actionCopy: Record<ActionType, { title: string; desc: string; needsMsg: boolean; label: string }> = {
    approve: { title: 'Approve doctor', desc: 'This doctor will immediately be able to take consultations and be listed to patients.', needsMsg: false, label: 'Confirm approval' },
    request_info: { title: 'Request more information', desc: 'The doctor will see this message and can edit and resubmit.', needsMsg: true, label: 'Send request' },
    reject: { title: 'Reject application', desc: 'The doctor will see this reason and can fix and resubmit.', needsMsg: true, label: 'Confirm rejection' },
    suspend: { title: 'Suspend doctor', desc: 'The doctor loses access to consultations and patients immediately.', needsMsg: true, label: 'Suspend' },
    unsuspend: { title: 'Reactivate doctor', desc: 'Restore this doctor’s access.', needsMsg: false, label: 'Reactivate' },
  };

  return (
    <div className="space-y-4">
      <Button variant="ghost" onClick={onBack} className="gap-1 -ml-2"><ArrowLeft className="w-4 h-4" /> {backLabel}</Button>

      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-lg bg-primary/10 text-primary flex items-center justify-center"><Stethoscope className="w-6 h-6" /></div>
          <div>
            <h2 className="text-lg font-bold">Dr. {fullName || 'Unnamed'}</h2>
            <p className="text-xs text-muted-foreground">{d.email}</p>
          </div>
          <StatusChip row={status} />
        </div>
        <div className="flex flex-wrap gap-2">
          {!isApproved && <Button size="sm" disabled={!canApprove} onClick={() => setAction('approve')} className="gap-1 bg-emerald-600 hover:bg-emerald-700 text-white"><CheckCircle className="w-3.5 h-3.5" /> Approve</Button>}
          {!isApproved && doc.profile_status === 'submitted' && <Button size="sm" variant="outline" onClick={() => setAction('request_info')} className="gap-1"><Info className="w-3.5 h-3.5" /> Request info</Button>}
          {!isApproved && <Button size="sm" variant="destructive" onClick={() => setAction('reject')} className="gap-1"><XCircle className="w-3.5 h-3.5" /> Reject</Button>}
          {isApproved && !doc.is_suspended && <Button size="sm" variant="destructive" onClick={() => setAction('suspend')} className="gap-1"><ShieldOff className="w-3.5 h-3.5" /> Suspend</Button>}
          {isApproved && doc.is_suspended && <Button size="sm" onClick={() => setAction('unsuspend')} className="gap-1">Reactivate</Button>}
        </div>
      </div>

      {!isApproved && doc.profile_status === 'submitted' && !canApprove && (
        <Card className="border-amber-300 bg-amber-50/60"><CardContent className="p-3 text-xs space-y-1">
          <p className="font-semibold">Approval is blocked until this is resolved:</p>
          {hasRejectedDoc && <p>• A document is marked rejected.</p>}
          {d.missing.map((m) => <p key={m}>• {doctorMissingLabel(m)}</p>)}
        </CardContent></Card>
      )}
      {doc.is_suspended && doc.suspended_reason && <Card className="border-destructive/40"><CardContent className="p-3 text-xs text-destructive">Suspended: {doc.suspended_reason}</CardContent></Card>}
      {d.account.rejection_reason && !isApproved && <Card className="border-destructive/40"><CardContent className="p-3 text-xs text-destructive">Last rejection: {d.account.rejection_reason}</CardContent></Card>}

      <div className="grid gap-4 md:grid-cols-2">
        <Section title="Account">
          <Row k="Name">{fullName}</Row>
          <Row k="Phone">{d.account.phone}</Row>
          <Row k="Registered">{d.account.created_at && format(new Date(d.account.created_at), 'PP')}</Row>
          <Row k="Terms accepted">{v.terms_accepted_at ? `${format(new Date(v.terms_accepted_at), 'PP')} (${v.terms_version})` : 'No'}</Row>
        </Section>
        <Section title="Licensing">
          <Row k="License number"><span className="font-mono">{doc.license_number}</span></Row>
          <Row k="License expiry"><ExpiryBadge date={v.license_expiry} /></Row>
          <Row k="MDCN folio number"><span className="font-mono">{v.mdcn_folio_number}</span></Row>
        </Section>
        <Section title="Professional profile">
          <Row k="Specialties">{(doc.specialties ?? []).join(', ')}</Row>
          <Row k="Years of experience">{doc.years_of_experience}</Row>
          <Row k="Medical school">{v.alma_mater}</Row>
          <Row k="Graduation year">{v.graduation_year}</Row>
          <Row k="Consultation price">{doc.consult_price ? `₦${doc.consult_price}` : ''}</Row>
          <Row k="Bio">{doc.bio}</Row>
        </Section>
        <Section title="Practice & contact">
          <Row k="Hospital / clinic">{doc.hospital_or_clinic}</Row>
          <Row k="State">{doc.state}</Row>
          <Row k="City / LGA">{doc.city}</Row>
          <Row k="Contact phone">{v.contact_phone}</Row>
        </Section>
        <Section title="Payout details">
          <Row k="Bank">{v.payout_bank_name}</Row>
          <Row k="Account number">{v.payout_account_number}</Row>
          <Row k="Account name">{v.payout_account_name}</Row>
        </Section>
      </div>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Documents</CardTitle><CardDescription>Links expire after 5 minutes</CardDescription></CardHeader>
        <CardContent className="space-y-2">
          {d.documents.length === 0 && <p className="text-xs text-muted-foreground">No documents uploaded.</p>}
          {d.documents.map((x) => (
            <div key={x.id} className="rounded-lg border p-3 flex flex-col md:flex-row md:items-center gap-2 md:justify-between">
              <div className="min-w-0">
                <p className="text-sm font-medium flex items-center gap-2"><FileText className="w-4 h-4 shrink-0" />{DOCTOR_DOC_LABELS[x.doc_type as DoctorDocType] ?? x.doc_type}
                  <Badge variant="outline" className={`capitalize text-[10px] ${x.status === 'approved' ? 'text-emerald-700 border-emerald-300' : x.status === 'rejected' ? 'text-red-700 border-red-300' : 'text-amber-700 border-amber-300'}`}>{x.status}</Badge></p>
                <p className="text-[11px] text-muted-foreground truncate">{x.file_name}{x.review_note ? ` · ${x.review_note}` : ''}</p>
              </div>
              <div className="flex gap-2 shrink-0">
                <Button size="sm" variant="outline" onClick={() => openDoc(x.storage_path)} className="gap-1 text-xs"><ExternalLink className="w-3.5 h-3.5" /> View</Button>
                <Button size="sm" variant="outline" disabled={x.status === 'approved'} onClick={() => reviewDoc(x.id, 'approved')} className="gap-1 text-xs text-emerald-700"><CheckCircle className="w-3.5 h-3.5" /> Approve</Button>
                <Button size="sm" variant="outline" disabled={x.status === 'rejected'} onClick={() => { setDocDialog({ id: x.id, type: x.doc_type }); setDocNote(''); }} className="gap-1 text-xs text-destructive"><XCircle className="w-3.5 h-3.5" /> Reject</Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Review timeline</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {d.events.length === 0 && <p className="text-xs text-muted-foreground">No activity yet.</p>}
          {d.events.map((e) => (
            <div key={e.id} className="text-xs border-l-2 pl-3">
              <p className="font-semibold capitalize">{String(e.action).replace(/_/g, ' ')}</p>
              {e.message && <p className="text-muted-foreground">{e.message}</p>}
              <p className="text-[10px] text-muted-foreground">{format(new Date(e.created_at), 'PP p')}</p>
            </div>
          ))}
        </CardContent>
      </Card>

      <Dialog open={!!action} onOpenChange={(o) => !o && !busy && setAction(null)}>
        <DialogContent className="sm:max-w-[440px]">
          {action && (<>
            <DialogHeader><DialogTitle>{actionCopy[action].title}</DialogTitle><DialogDescription>{actionCopy[action].desc}</DialogDescription></DialogHeader>
            <div className="space-y-2 py-1">
              <Label htmlFor="doctor-msg">{actionCopy[action].needsMsg ? 'Message (required, visible to the doctor)' : 'Note to doctor (optional)'}</Label>
              <Textarea id="doctor-msg" rows={3} value={message} onChange={(e) => setMessage(e.target.value)} />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setAction(null)} disabled={busy}>Cancel</Button>
              <Button onClick={runAction} disabled={busy || (actionCopy[action].needsMsg && message.trim().length < 3)}
                variant={action === 'reject' || action === 'suspend' ? 'destructive' : 'default'}>
                {busy && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}{actionCopy[action].label}
              </Button>
            </DialogFooter>
          </>)}
        </DialogContent>
      </Dialog>

      <Dialog open={!!docDialog} onOpenChange={(o) => !o && setDocDialog(null)}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader><DialogTitle>Reject document</DialogTitle><DialogDescription>Explain what is wrong so the doctor can upload a better file.</DialogDescription></DialogHeader>
          <Textarea rows={3} value={docNote} onChange={(e) => setDocNote(e.target.value)} placeholder="e.g. Image is blurry, license has expired…" />
          <DialogFooter>
            <Button variant="outline" onClick={() => setDocDialog(null)}>Cancel</Button>
            <Button variant="destructive" disabled={docNote.trim().length < 3} onClick={() => docDialog && reviewDoc(docDialog.id, 'rejected', docNote.trim())}>Reject document</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
