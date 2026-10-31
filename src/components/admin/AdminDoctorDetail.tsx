import { useCallback, useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { ArrowLeft, CheckCircle, XCircle, ExternalLink, FileText, Loader2, Stethoscope, AlertTriangle } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { AdminRpcService, type AdminUserRow } from '@/services/AdminRpcService';
import { errMsg } from '@/services/PharmacyOnboardingService';

interface DoctorInfo {
  profile: {
    first_name: string | null; last_name: string | null; phone: string | null; date_of_birth: string | null;
    gender: string | null; created_at: string; verification_status: string; rejection_reason: string | null;
  } | null;
  doctor: {
    license_number: string | null; specialties: string[] | null; bio: string | null; consult_price: number | null;
    total_consultations: number | null; rating: number | null;
  } | null;
  files: Array<{ name: string; path: string }>;
}

interface Props {
  user: AdminUserRow;
  onBack: () => void;
}

export default function AdminDoctorDetail({ user, onBack }: Props) {
  const [info, setInfo] = useState<DoctorInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [action, setAction] = useState<'verify' | 'reject' | null>(null);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState(user.verification_status);

  const load = useCallback(async () => {
    const [profileRes, doctorRes, filesRes] = await Promise.all([
      supabase.from('profiles')
        .select('first_name,last_name,phone,date_of_birth,gender,created_at,verification_status,rejection_reason')
        .eq('user_id', user.user_id).maybeSingle(),
      supabase.from('doctors')
        .select('license_number,specialties,bio,consult_price,total_consultations,rating')
        .eq('user_id', user.user_id).maybeSingle(),
      supabase.storage.from('ids').list(user.user_id, { limit: 50 }),
    ]);
    if (profileRes.error) toast.error(errMsg(profileRes.error, 'Could not load profile'));
    setInfo({
      profile: profileRes.data ?? null,
      doctor: doctorRes.data ?? null,
      files: (filesRes.data ?? []).filter((f) => f.name && !f.name.startsWith('.')).map((f) => ({ name: f.name, path: `${user.user_id}/${f.name}` })),
    });
    if (profileRes.data) setStatus(profileRes.data.verification_status);
    setLoading(false);
  }, [user.user_id]);

  useEffect(() => { load(); }, [load]);

  const openFile = async (path: string) => {
    const url = await AdminRpcService.getPrivateIdSignedUrl(path);
    if (url) window.open(url, '_blank', 'noopener,noreferrer'); else toast.error('Could not open this document.');
  };

  const confirm = async () => {
    if (!action) return;
    if (action === 'reject' && reason.trim().length < 3) return toast.error('Please give a reason for rejection.');
    setBusy(true);
    try {
      await AdminRpcService.setVerification(user.user_id, action === 'verify' ? 'verified' : 'rejected', action === 'reject' ? reason.trim() : null);
      toast.success(`Doctor ${action === 'verify' ? 'approved' : 'rejected'}.`);
      setAction(null); setReason('');
      await load();
    } catch (e) {
      toast.error(errMsg(e, 'Could not update verification status.'));
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <div className="flex justify-center py-16"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;

  const p = info?.profile; const d = info?.doctor;
  const name = [p?.first_name, p?.last_name].filter(Boolean).join(' ') || user.full_name || 'Unnamed applicant';
  const noLicense = !d?.license_number?.trim();
  const noDocs = (info?.files.length ?? 0) === 0;

  const Row = ({ k, children }: { k: string; children: React.ReactNode }) => (
    <div className="flex justify-between gap-3 py-1.5 text-xs">
      <span className="text-muted-foreground">{k}</span>
      <span className="font-medium text-right break-words">{children || <span className="text-muted-foreground">Not provided</span>}</span>
    </div>
  );

  return (
    <div className="space-y-4">
      <Button variant="ghost" onClick={onBack} className="gap-1 -ml-2"><ArrowLeft className="w-4 h-4" /> Back to queue</Button>

      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-full bg-primary/10 text-primary flex items-center justify-center"><Stethoscope className="w-6 h-6" /></div>
          <div>
            <h2 className="text-lg font-bold">{name}</h2>
            <p className="text-xs text-muted-foreground">{user.email}</p>
          </div>
          {status === 'verified' ? <Badge className="bg-emerald-600">Approved</Badge>
            : status === 'rejected' ? <Badge variant="destructive">Rejected</Badge>
            : <Badge className="bg-amber-500">Pending</Badge>}
        </div>
        <div className="flex gap-2">
          {status !== 'verified' && (
            <Button size="sm" onClick={() => setAction('verify')} className="gap-1 bg-emerald-600 hover:bg-emerald-700 text-white"><CheckCircle className="w-3.5 h-3.5" /> Approve</Button>
          )}
          {status !== 'rejected' && (
            <Button size="sm" variant="destructive" onClick={() => { setAction('reject'); setReason(''); }} className="gap-1"><XCircle className="w-3.5 h-3.5" /> Reject</Button>
          )}
        </div>
      </div>

      {status !== 'verified' && (noLicense || noDocs) && (
        <Card className="border-amber-300 bg-amber-50/60">
          <CardContent className="p-3 text-xs flex gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">Missing verification details</p>
              {noLicense && <p>• No medical license number on the profile.</p>}
              {noDocs && <p>• No identity or license document was uploaded.</p>}
            </div>
          </CardContent>
        </Card>
      )}
      {p?.rejection_reason && status === 'rejected' && (
        <Card className="border-destructive/40"><CardContent className="p-3 text-xs text-destructive">Rejection reason: {p.rejection_reason}</CardContent></Card>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Registration details</CardTitle></CardHeader>
          <CardContent className="divide-y">
            <Row k="Full name">{name}</Row>
            <Row k="Email">{user.email}</Row>
            <Row k="Phone">{p?.phone}</Row>
            <Row k="Date of birth">{p?.date_of_birth}</Row>
            <Row k="Gender">{p?.gender}</Row>
            <Row k="Registered">{p?.created_at && format(new Date(p.created_at), 'PP')}</Row>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Professional details</CardTitle></CardHeader>
          <CardContent className="divide-y">
            <Row k="Medical license no."><span className="font-mono">{d?.license_number}</span></Row>
            <Row k="Specialties">{d?.specialties?.join(', ')}</Row>
            <Row k="Consultation fee">{d?.consult_price != null ? `₦${Number(d.consult_price).toLocaleString()}` : null}</Row>
            <Row k="Consultations done">{d?.total_consultations}</Row>
            <Row k="Rating">{d?.rating != null && Number(d.rating) > 0 ? Number(d.rating).toFixed(1) : null}</Row>
          </CardContent>
        </Card>
      </div>

      {d?.bio && (
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Bio</CardTitle></CardHeader><CardContent className="text-xs whitespace-pre-wrap">{d.bio}</CardContent></Card>
      )}

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Uploaded documents</CardTitle><CardDescription>Links expire after 1 hour</CardDescription></CardHeader>
        <CardContent className="space-y-2">
          {noDocs && <p className="text-xs text-muted-foreground">No documents uploaded.</p>}
          {info?.files.map((f) => (
            <div key={f.path} className="flex items-center justify-between gap-2 rounded-lg border p-2.5">
              <span className="flex items-center gap-2 text-xs min-w-0"><FileText className="w-4 h-4 shrink-0" /><span className="truncate">{f.name}</span></span>
              <Button size="sm" variant="outline" onClick={() => openFile(f.path)} className="gap-1 text-xs shrink-0"><ExternalLink className="w-3.5 h-3.5" /> View</Button>
            </div>
          ))}
        </CardContent>
      </Card>

      <Dialog open={!!action} onOpenChange={(o) => !o && !busy && setAction(null)}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>{action === 'verify' ? 'Approve doctor' : 'Reject doctor'}</DialogTitle>
            <DialogDescription>
              {action === 'verify' ? `Approve ${name}? They will be able to receive consultation bookings.` : `Reject ${name}. They will see your reason.`}
            </DialogDescription>
          </DialogHeader>
          {action === 'reject' && (
            <div className="space-y-2">
              <Label htmlFor="doc-reject-reason">Reason (required)</Label>
              <Textarea id="doc-reject-reason" rows={3} value={reason} onChange={(e) => setReason(e.target.value)} />
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setAction(null)} disabled={busy}>Cancel</Button>
            <Button onClick={confirm} disabled={busy || (action === 'reject' && reason.trim().length < 3)}
              variant={action === 'verify' ? 'default' : 'destructive'}
              className={action === 'verify' ? 'bg-emerald-600 hover:bg-emerald-700 text-white' : ''}>
              {busy && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {action === 'verify' ? 'Confirm approval' : 'Confirm rejection'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
