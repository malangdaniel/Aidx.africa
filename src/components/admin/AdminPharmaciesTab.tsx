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
  ArrowLeft, Building2, CheckCircle, XCircle, ExternalLink, FileText, Loader2, RefreshCw, Search, ShieldOff, Info, AlertTriangle,
} from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import {
  PharmacyOnboardingService, DOC_LABELS, missingLabel, daysUntil, errMsg,
  type DocType, type PharmacyRow, type PharmacyVerificationRow, type PharmacyDocumentRow, type PharmacyEventRow,
} from '@/services/PharmacyOnboardingService';

type ListRow = {
  user_id: string; pharmacy_id: string; pharmacy_name: string; email: string; state: string | null; city: string | null;
  pcn_license_number: string | null; verification_status: string; profile_status: string; is_suspended: boolean;
  submitted_at: string | null; docs_total: number; docs_approved: number; nearest_expiry: string | null; created_at: string;
};
type ExpiryRow = { user_id: string; pharmacy_name: string; email: string; license_type: string; expiry_date: string; days_left: number; verification_status: string };

const TABS = [
  { id: 'awaiting_review', label: 'Awaiting review' }, { id: 'needs_info', label: 'Needs info' },
  { id: 'incomplete', label: 'Incomplete' }, { id: 'verified', label: 'Approved' },
  { id: 'rejected', label: 'Rejected' }, { id: 'suspended', label: 'Suspended' }, { id: 'all', label: 'All' },
];
const PAGE = 25;

export function ExpiryBadge({ date }: { date?: string | null }) {
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

export default function AdminPharmaciesTab() {
  const [selected, setSelected] = useState<string | null>(null);
  return selected ? <PharmacyDetail userId={selected} onBack={() => setSelected(null)} /> : <PharmacyList onOpen={setSelected} />;
}

function PharmacyList({ onOpen }: { onOpen: (userId: string) => void }) {
  const [tab, setTab] = useState('awaiting_review');
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(0);
  const [rows, setRows] = useState<ListRow[]>([]);
  const [expiring, setExpiring] = useState<ExpiryRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase.rpc('admin_list_pharmacy_applications', {
      p_status: tab === 'all' ? null : tab, p_search: query || null, p_limit: PAGE, p_offset: page * PAGE,
    });
    if (error) toast.error(error.message);
    setRows((data ?? []) as unknown as ListRow[]);
    setLoading(false);
  }, [tab, query, page]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    supabase.rpc('admin_pharmacy_expiry_alerts', { p_days: 30 }).then(({ data }) => setExpiring((data ?? []) as unknown as ExpiryRow[]));
  }, []);

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold tracking-tight">Pharmacies</h2>
          <p className="text-xs text-muted-foreground">Review applications, licenses and documents</p>
        </div>
        <Button variant="outline" size="sm" onClick={load} disabled={loading} className="gap-1.5 self-start">
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
        </Button>
      </div>

      {expiring.length > 0 && (
        <Card className="border-amber-300 bg-amber-50/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2"><AlertTriangle className="w-4 h-4 text-amber-600" /> Licenses expiring within 30 days ({expiring.length})</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1.5">
            {expiring.slice(0, 8).map((e, i) => (
              <button key={i} type="button" onClick={() => onOpen(e.user_id)} className="w-full flex justify-between gap-2 text-xs text-left hover:bg-amber-100/60 rounded px-2 py-1">
                <span className="font-medium truncate">{e.pharmacy_name} · {e.license_type.replace(/_/g, ' ')}</span>
                <span className={e.days_left <= 0 ? 'text-destructive font-semibold shrink-0' : 'shrink-0'}>
                  {e.days_left <= 0 ? `expired ${Math.abs(e.days_left)}d ago` : `${e.days_left}d left`}
                </span>
              </button>
            ))}
          </CardContent>
        </Card>
      )}

      <Tabs value={tab} onValueChange={(v) => { setTab(v); setPage(0); }}>
        <TabsList className="h-auto flex-wrap justify-start">
          {TABS.map((t) => <TabsTrigger key={t.id} value={t.id} className="text-xs">{t.label}</TabsTrigger>)}
        </TabsList>
      </Tabs>

      <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); setPage(0); setQuery(search.trim()); }}>
        <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name, email, PCN or RC number" className="max-w-sm" />
        <Button type="submit" variant="secondary" size="sm" className="gap-1.5"><Search className="w-3.5 h-3.5" /> Search</Button>
      </form>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-7 h-7 animate-spin text-primary" /></div>
      ) : rows.length === 0 ? (
        <Card className="border-dashed"><CardContent className="py-12 text-center text-sm text-muted-foreground">No pharmacies in this view.</CardContent></Card>
      ) : (
        <div className="grid gap-3">
          {rows.map((r) => (
            <Card key={r.user_id} className="hover:shadow-sm transition-shadow cursor-pointer" onClick={() => onOpen(r.user_id)}>
              <CardContent className="p-4 flex flex-col md:flex-row md:items-center gap-3 md:justify-between">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0"><Building2 className="w-5 h-5" /></div>
                  <div className="min-w-0">
                    <p className="font-semibold text-sm truncate">{r.pharmacy_name}</p>
                    <p className="text-xs text-muted-foreground truncate">{r.email} · {[r.city, r.state].filter(Boolean).join(', ') || 'No location'}</p>
                    <p className="text-[11px] text-muted-foreground">PCN: <span className="font-mono">{r.pcn_license_number || 'n/a'}</span></p>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-3 text-xs">
                  <StatusChip row={r} />
                  <span className="text-muted-foreground">Docs {r.docs_approved}/{r.docs_total}</span>
                  <ExpiryBadge date={r.nearest_expiry} />
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
  pharmacy: PharmacyRow;
  verification: Partial<PharmacyVerificationRow> | null;
  documents: PharmacyDocumentRow[];
  events: PharmacyEventRow[];
  missing: string[];
};
type ActionType = 'approve' | 'request_info' | 'reject' | 'suspend' | 'unsuspend';

function PharmacyDetail({ userId, onBack }: { userId: string; onBack: () => void }) {
  const [d, setD] = useState<Detail | null>(null);
  const [loading, setLoading] = useState(true);
  const [action, setAction] = useState<ActionType | null>(null);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [docDialog, setDocDialog] = useState<{ id: string; type: string } | null>(null);
  const [docNote, setDocNote] = useState('');

  const load = useCallback(async () => {
    const { data, error } = await supabase.rpc('admin_get_pharmacy_application', { p_user_id: userId });
    if (error) toast.error(error.message);
    setD((data ?? null) as unknown as Detail | null);
    setLoading(false);
  }, [userId]);
  useEffect(() => { load(); }, [load]);

  const runAction = async () => {
    if (!action) return;
    setBusy(true);
    const { error } = await supabase.rpc('admin_review_pharmacy', { p_user_id: userId, p_action: action, p_message: message.trim() || null });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success('Done');
    setAction(null); setMessage(''); load();
  };

  const reviewDoc = async (id: string, status: 'approved' | 'rejected' | 'pending', note?: string) => {
    const { error } = await supabase.rpc('admin_review_pharmacy_document', { p_document_id: id, p_status: status, p_note: note ?? null });
    if (error) return toast.error(error.message);
    setDocDialog(null); setDocNote(''); load();
  };

  const openDoc = async (path: string) => {
    const url = await PharmacyOnboardingService.signedUrl(path, 300);
    if (url) window.open(url, '_blank', 'noopener,noreferrer'); else toast.error('Could not open the document.');
  };

  if (loading) return <div className="flex justify-center py-16"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
  if (!d) return <div className="space-y-3"><Button variant="ghost" onClick={onBack} className="gap-1"><ArrowLeft className="w-4 h-4" /> Back</Button><p className="text-sm">Pharmacy not found.</p></div>;

  const ph = d.pharmacy; const v = d.verification ?? {};
  const status = { verification_status: d.account.verification_status, profile_status: ph.profile_status, is_suspended: ph.is_suspended };
  const hasRejectedDoc = d.documents.some((x) => x.status === 'rejected');
  const canApprove = ph.profile_status === 'submitted' && d.missing.length === 0 && !hasRejectedDoc;
  const isApproved = d.account.verification_status === 'verified';

  const Row = ({ k, children }: { k: string; children: React.ReactNode }) => (
    <div className="flex justify-between gap-3 py-1 text-xs"><span className="text-muted-foreground">{k}</span><span className="font-medium text-right break-words">{children || <span className="text-muted-foreground">-</span>}</span></div>
  );
  const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
    <Card><CardHeader className="pb-2"><CardTitle className="text-sm">{title}</CardTitle></CardHeader><CardContent className="divide-y">{children}</CardContent></Card>
  );

  const actionCopy: Record<ActionType, { title: string; desc: string; needsMsg: boolean; label: string }> = {
    approve: { title: 'Approve pharmacy', desc: 'This pharmacy will immediately be able to list drugs and receive orders.', needsMsg: false, label: 'Confirm approval' },
    request_info: { title: 'Request more information', desc: 'The pharmacy will see this message and can edit and resubmit.', needsMsg: true, label: 'Send request' },
    reject: { title: 'Reject application', desc: 'The pharmacy will see this reason and can fix and resubmit.', needsMsg: true, label: 'Confirm rejection' },
    suspend: { title: 'Suspend pharmacy', desc: 'The pharmacy loses access to orders and inventory immediately.', needsMsg: true, label: 'Suspend' },
    unsuspend: { title: 'Reactivate pharmacy', desc: 'Restore this pharmacy’s access.', needsMsg: false, label: 'Reactivate' },
  };

  return (
    <div className="space-y-4">
      <Button variant="ghost" onClick={onBack} className="gap-1 -ml-2"><ArrowLeft className="w-4 h-4" /> All pharmacies</Button>

      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div className="flex items-center gap-3">
          {ph.logo_url ? <img src={ph.logo_url} alt="" className="w-12 h-12 rounded-lg object-cover border" /> : <div className="w-12 h-12 rounded-lg bg-primary/10 text-primary flex items-center justify-center"><Building2 className="w-6 h-6" /></div>}
          <div>
            <h2 className="text-lg font-bold">{ph.business_name}</h2>
            <p className="text-xs text-muted-foreground">{d.email}</p>
          </div>
          <StatusChip row={status} />
        </div>
        <div className="flex flex-wrap gap-2">
          {!isApproved && <Button size="sm" disabled={!canApprove} onClick={() => setAction('approve')} className="gap-1 bg-emerald-600 hover:bg-emerald-700 text-white"><CheckCircle className="w-3.5 h-3.5" /> Approve</Button>}
          {!isApproved && ph.profile_status === 'submitted' && <Button size="sm" variant="outline" onClick={() => setAction('request_info')} className="gap-1"><Info className="w-3.5 h-3.5" /> Request info</Button>}
          {!isApproved && <Button size="sm" variant="destructive" onClick={() => setAction('reject')} className="gap-1"><XCircle className="w-3.5 h-3.5" /> Reject</Button>}
          {isApproved && !ph.is_suspended && <Button size="sm" variant="destructive" onClick={() => setAction('suspend')} className="gap-1"><ShieldOff className="w-3.5 h-3.5" /> Suspend</Button>}
          {isApproved && ph.is_suspended && <Button size="sm" onClick={() => setAction('unsuspend')} className="gap-1">Reactivate</Button>}
        </div>
      </div>

      {!isApproved && ph.profile_status === 'submitted' && !canApprove && (
        <Card className="border-amber-300 bg-amber-50/60"><CardContent className="p-3 text-xs space-y-1">
          <p className="font-semibold">Approval is blocked until this is resolved:</p>
          {hasRejectedDoc && <p>• A document is marked rejected.</p>}
          {d.missing.map((m) => <p key={m}>• {missingLabel(m)}</p>)}
        </CardContent></Card>
      )}
      {ph.is_suspended && ph.suspended_reason && <Card className="border-destructive/40"><CardContent className="p-3 text-xs text-destructive">Suspended: {ph.suspended_reason}</CardContent></Card>}
      {d.account.rejection_reason && !isApproved && <Card className="border-destructive/40"><CardContent className="p-3 text-xs text-destructive">Last rejection: {d.account.rejection_reason}</CardContent></Card>}

      <div className="grid gap-4 md:grid-cols-2">
        <Section title="Account">
          <Row k="Name">{[d.account.first_name, d.account.last_name].filter(Boolean).join(' ')}</Row>
          <Row k="Phone">{d.account.phone}</Row>
          <Row k="Registered">{d.account.created_at && format(new Date(d.account.created_at), 'PP')}</Row>
          <Row k="Marketing opt-in">{v.marketing_opt_in ? 'Yes' : 'No'}</Row>
          <Row k="Terms accepted">{v.terms_accepted_at ? `${format(new Date(v.terms_accepted_at), 'PP')} (${v.terms_version})` : 'No'}</Row>
        </Section>
        <Section title="Pharmacy details">
          <Row k="Trading name">{ph.trading_name}</Row>
          <Row k="Email">{ph.email}</Row><Row k="Phone">{ph.phone}</Row><Row k="WhatsApp">{ph.whatsapp_number}</Row>
          <Row k="Year established">{ph.year_established}</Row>
          <Row k="Hours">{ph.is_24_hours ? 'Open 24 hours' : 'Custom hours'}</Row>
          <Row k="Delivery">{ph.offers_delivery ? `Yes · ${ph.delivery_radius_km ?? '?'} km · ₦${ph.delivery_fee ?? 0}` : 'No'}</Row>
          <Row k="Pickup">{ph.offers_pickup ? 'Yes' : 'No'}</Row>
          <Row k="Controlled drugs">{ph.handles_controlled_drugs ? 'Yes' : 'No'}</Row>
          <Row k="Cold chain">{ph.handles_cold_chain ? 'Yes' : 'No'}</Row>
          <Row k="HMO">{ph.accepts_hmo ? (ph.hmo_partners ?? []).join(', ') || 'Yes' : 'No'}</Row>
        </Section>
        <Section title="Registration & licenses">
          <Row k="RC No. (CAC)">{v.cac_rc_number}</Row>
          <Row k="PCN premises license"><span className="font-mono">{ph.license_number}</span></Row>
          <Row k="Premises license expiry"><ExpiryBadge date={v.pcn_premises_license_expiry} /></Row>
          <Row k="NAFDAC / NDLEA">{v.nafdac_ndlea_number}</Row>
        </Section>
        <Section title="Superintendent pharmacist">
          <Row k="Name">{v.pharmacist_full_name}</Row>
          <Row k="PCN reg. no."><span className="font-mono">{v.pharmacist_pcn_number}</span></Row>
          <Row k="License expiry"><ExpiryBadge date={v.pharmacist_license_expiry} /></Row>
          <Row k="Phone">{v.pharmacist_phone}</Row><Row k="Email">{v.pharmacist_email}</Row>
          <Row k="Contact person">{v.contact_person_name}</Row>
          <Row k="Contact phone">{v.contact_person_phone}</Row>
        </Section>
        <Section title="Location">
          <Row k="State">{ph.state}</Row><Row k="City / LGA">{ph.city}</Row><Row k="Street">{ph.street}</Row><Row k="Landmark">{ph.landmark}</Row>
          <Row k="Coordinates">{ph.latitude != null && ph.longitude != null ? (
            <a className="underline inline-flex items-center gap-1" target="_blank" rel="noopener noreferrer" href={`https://www.google.com/maps?q=${ph.latitude},${ph.longitude}`}>{ph.latitude}, {ph.longitude} <ExternalLink className="w-3 h-3" /></a>
          ) : null}</Row>
        </Section>
        <Section title="Payout details">
          <Row k="Bank">{v.payout_bank_name}</Row><Row k="Account number">{v.payout_account_number}</Row><Row k="Account name">{v.payout_account_name}</Row>
        </Section>
      </div>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Documents</CardTitle><CardDescription>Links expire after 5 minutes</CardDescription></CardHeader>
        <CardContent className="space-y-2">
          {d.documents.length === 0 && <p className="text-xs text-muted-foreground">No documents uploaded.</p>}
          {d.documents.map((doc) => (
            <div key={doc.id} className="rounded-lg border p-3 flex flex-col md:flex-row md:items-center gap-2 md:justify-between">
              <div className="min-w-0">
                <p className="text-sm font-medium flex items-center gap-2"><FileText className="w-4 h-4 shrink-0" />{DOC_LABELS[doc.doc_type as DocType] ?? doc.doc_type}
                  <Badge variant="outline" className={`capitalize text-[10px] ${doc.status === 'approved' ? 'text-emerald-700 border-emerald-300' : doc.status === 'rejected' ? 'text-red-700 border-red-300' : 'text-amber-700 border-amber-300'}`}>{doc.status}</Badge></p>
                <p className="text-[11px] text-muted-foreground truncate">{doc.file_name}{doc.review_note ? ` · ${doc.review_note}` : ''}</p>
              </div>
              <div className="flex gap-2 shrink-0">
                <Button size="sm" variant="outline" onClick={() => openDoc(doc.storage_path)} className="gap-1 text-xs"><ExternalLink className="w-3.5 h-3.5" /> View</Button>
                <Button size="sm" variant="outline" disabled={doc.status === 'approved'} onClick={() => reviewDoc(doc.id, 'approved')} className="gap-1 text-xs text-emerald-700"><CheckCircle className="w-3.5 h-3.5" /> Approve</Button>
                <Button size="sm" variant="outline" disabled={doc.status === 'rejected'} onClick={() => { setDocDialog({ id: doc.id, type: doc.doc_type }); setDocNote(''); }} className="gap-1 text-xs text-destructive"><XCircle className="w-3.5 h-3.5" /> Reject</Button>
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
              <Label htmlFor="pharm-msg">{actionCopy[action].needsMsg ? 'Message (required, visible to the pharmacy)' : 'Note to pharmacy (optional)'}</Label>
              <Textarea id="pharm-msg" rows={3} value={message} onChange={(e) => setMessage(e.target.value)} />
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
          <DialogHeader><DialogTitle>Reject document</DialogTitle><DialogDescription>Explain what is wrong so the pharmacy can upload a better file.</DialogDescription></DialogHeader>
          <Textarea rows={3} value={docNote} onChange={(e) => setDocNote(e.target.value)} placeholder="e.g. Image is blurry, certificate has expired…" />
          <DialogFooter>
            <Button variant="outline" onClick={() => setDocDialog(null)}>Cancel</Button>
            <Button variant="destructive" disabled={docNote.trim().length < 3} onClick={() => docDialog && reviewDoc(docDialog.id, 'rejected', docNote.trim())}>Reject document</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
