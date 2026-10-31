import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Clock, ShieldOff, Mail, CheckCircle2, XCircle, Send, Info, AlertTriangle, RefreshCw } from 'lucide-react';
import { format } from 'date-fns';
import { PharmacyOnboardingService, type ApplicationStatus, type PharmacyEventRow } from '@/services/PharmacyOnboardingService';

const EVENT_META: Record<string, { label: string; icon: typeof Clock; tone: string }> = {
  submitted: { label: 'Application submitted', icon: Send, tone: 'text-blue-600' },
  info_requested: { label: 'More information requested', icon: Info, tone: 'text-amber-600' },
  rejected: { label: 'Application rejected', icon: XCircle, tone: 'text-red-600' },
  approved: { label: 'Application approved', icon: CheckCircle2, tone: 'text-emerald-600' },
  suspended: { label: 'Account suspended', icon: ShieldOff, tone: 'text-red-600' },
  unsuspended: { label: 'Suspension lifted', icon: CheckCircle2, tone: 'text-emerald-600' },
  document_rejected: { label: 'Document rejected', icon: AlertTriangle, tone: 'text-red-600' },
};

export function ReviewTimeline({ pharmacyId }: { pharmacyId: string }) {
  const [events, setEvents] = useState<PharmacyEventRow[] | null>(null);
  useEffect(() => {
    PharmacyOnboardingService.listEvents(pharmacyId).then(setEvents).catch(() => setEvents([]));
  }, [pharmacyId]);

  if (!events) return null;
  if (events.length === 0) return <p className="text-xs text-muted-foreground">No activity yet.</p>;
  return (
    <ol className="space-y-3">
      {events.map((e) => {
        const meta = EVENT_META[e.action] ?? { label: e.action, icon: Clock, tone: 'text-muted-foreground' };
        const Icon = meta.icon;
        return (
          <li key={e.id} className="flex gap-3">
            <Icon className={`w-4 h-4 mt-0.5 shrink-0 ${meta.tone}`} />
            <div className="text-xs">
              <p className="font-semibold">{meta.label}</p>
              {e.message && <p className="text-muted-foreground">{e.message}</p>}
              <p className="text-[10px] text-muted-foreground">{format(new Date(e.created_at), 'PP p')}</p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

export function UnderReviewScreen({ status, onRefresh }: { status: ApplicationStatus; onRefresh: () => void }) {
  return (
    <div className="max-w-xl mx-auto space-y-4">
      <Card>
        <CardHeader className="items-center text-center">
          <div className="w-14 h-14 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center mb-2">
            <Clock className="w-7 h-7" />
          </div>
          <CardTitle>Your application is under review</CardTitle>
          <CardDescription>
            Our team is verifying your documents and license details. You'll get access to orders and inventory as soon as you're approved.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex justify-center">
            <Badge variant="outline" className="bg-amber-50 text-amber-800 border-amber-200">Awaiting review</Badge>
          </div>
          <Button variant="outline" size="sm" onClick={onRefresh} className="w-full gap-1.5">
            <RefreshCw className="w-3.5 h-3.5" /> Check status
          </Button>
        </CardContent>
      </Card>
      {status.pharmacy_id && (
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Activity</CardTitle></CardHeader>
          <CardContent><ReviewTimeline pharmacyId={status.pharmacy_id} /></CardContent>
        </Card>
      )}
    </div>
  );
}

export function SuspendedScreen({ status }: { status: ApplicationStatus }) {
  return (
    <div className="max-w-xl mx-auto space-y-4">
      <Card className="border-destructive/30">
        <CardHeader className="items-center text-center">
          <div className="w-14 h-14 rounded-full bg-destructive/10 text-destructive flex items-center justify-center mb-2">
            <ShieldOff className="w-7 h-7" />
          </div>
          <CardTitle>Account suspended</CardTitle>
          <CardDescription>Your pharmacy cannot receive orders or manage inventory while suspended.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {status.suspended_reason && (
            <div className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">{status.suspended_reason}</div>
          )}
          <Button asChild className="w-full gap-1.5">
            <a href="mailto:support@aidx.africa?subject=Pharmacy%20account%20suspension"><Mail className="w-4 h-4" /> Contact support</a>
          </Button>
        </CardContent>
      </Card>
      {status.pharmacy_id && (
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Activity</CardTitle></CardHeader>
          <CardContent><ReviewTimeline pharmacyId={status.pharmacy_id} /></CardContent>
        </Card>
      )}
    </div>
  );
}
