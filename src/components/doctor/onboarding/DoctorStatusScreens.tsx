import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Clock,
  ShieldOff,
  Mail,
  CheckCircle2,
  RefreshCw,
  Stethoscope,
  Building2,
  FileCheck2,
  AlertCircle,
  HelpCircle,
  UserCheck
} from 'lucide-react';
import { format } from 'date-fns';
import type { DoctorApplicationStatus } from '@/services/DoctorOnboardingService';
import { useAuth } from '@/contexts/AuthContext';

interface UnderReviewProps {
  status: DoctorApplicationStatus;
  onRefresh: () => void | Promise<void>;
  onEditApplication?: () => void;
}

export function DoctorUnderReviewScreen({ status, onRefresh, onEditApplication }: UnderReviewProps) {
  const { profile } = useAuth();
  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await onRefresh();
    } finally {
      setTimeout(() => setRefreshing(false), 600);
    }
  };

  const meta = (profile?.metadata as Record<string, any>) || {};
  const docProfile = meta.doctorProfile || {};
  const basic = docProfile.basicInfo || {};
  const creds = docProfile.credentials || {};

  const doctorFullName = [profile?.first_name, profile?.last_name].filter(Boolean).join(' ') || 'Doctor';
  const submissionDate = status.submitted_at ? format(new Date(status.submitted_at), 'PPP p') : 'Recently';

  return (
    <div className="max-w-2xl mx-auto space-y-6 py-6 px-4">
      {/* Main Review Card */}
      <Card className="border-amber-200/60 shadow-lg shadow-amber-500/5 bg-gradient-to-b from-card to-amber-50/20">
        <CardHeader className="items-center text-center pb-4">
          <div className="w-16 h-16 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center mb-3 shadow-inner ring-8 ring-amber-50">
            <Clock className="w-8 h-8 animate-pulse text-amber-600" />
          </div>
          <Badge variant="outline" className="bg-amber-100/70 text-amber-900 border-amber-300 font-semibold mb-2 px-3 py-0.5 text-xs">
            Awaiting Medical Board Verification
          </Badge>
          <CardTitle className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
            Your Medical Credentials Are Under Review
          </CardTitle>
          <CardDescription className="text-sm text-muted-foreground max-w-lg mt-2 leading-relaxed">
            Thank you for registering, <span className="font-semibold text-foreground">{basic.professionalTitle || 'Dr.'} {doctorFullName}</span>. Our clinical governance and credentialing team is actively validating your license with the Medical and Dental Council of Nigeria (MDCN) or your designated statutory board.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-5">
          {/* Timeline / Process Steps */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3.5 rounded-xl bg-card border border-border/60 text-xs">
            <div className="flex items-center gap-2.5">
              <div className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold text-[11px] shrink-0">
                ✓
              </div>
              <div>
                <p className="font-semibold text-foreground">Application</p>
                <p className="text-[10px] text-muted-foreground">Submitted</p>
              </div>
            </div>

            <div className="flex items-center gap-2.5">
              <div className="w-6 h-6 rounded-full bg-amber-200 text-amber-800 flex items-center justify-center font-bold text-[11px] shrink-0 animate-pulse">
                2
              </div>
              <div>
                <p className="font-semibold text-foreground">License Verification</p>
                <p className="text-[10px] text-amber-700 font-medium">In Progress</p>
              </div>
            </div>

            <div className="flex items-center gap-2.5 opacity-60">
              <div className="w-6 h-6 rounded-full bg-muted text-muted-foreground flex items-center justify-center font-bold text-[11px] shrink-0">
                3
              </div>
              <div>
                <p className="font-semibold text-foreground">Telemedicine Portal</p>
                <p className="text-[10px] text-muted-foreground">Consultations Live</p>
              </div>
            </div>
          </div>

          {/* Quick Summary of Submitted Credentials */}
          <div className="rounded-xl border bg-muted/20 p-4 space-y-2.5 text-xs">
            <h4 className="font-semibold text-foreground flex items-center gap-1.5">
              <FileCheck2 className="w-4 h-4 text-primary" />
              Submitted Application Summary
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-muted-foreground pt-1">
              <div className="flex justify-between sm:justify-start gap-2">
                <span className="font-medium text-foreground">License Reg No:</span>
                <span className="font-mono">{basic.registrationNumber || 'Under Review'}</span>
              </div>
              <div className="flex justify-between sm:justify-start gap-2">
                <span className="font-medium text-foreground">Specialty:</span>
                <span>{creds.specialty || 'General Practice'}</span>
              </div>
              <div className="flex justify-between sm:justify-start gap-2">
                <span className="font-medium text-foreground">Licensing Body:</span>
                <span className="truncate">{basic.licensingAuthority || 'MDCN'}</span>
              </div>
              <div className="flex justify-between sm:justify-start gap-2">
                <span className="font-medium text-foreground">Submitted At:</span>
                <span>{submissionDate}</span>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="space-y-2.5 pt-2">
            <Button
              onClick={handleRefresh}
              disabled={refreshing}
              className="w-full gap-2 shadow-sm font-medium"
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
              {refreshing ? 'Checking Verification Status...' : 'Check Verification Status'}
            </Button>

            {onEditApplication && (
              <Button
                variant="outline"
                onClick={onEditApplication}
                className="w-full text-xs"
              >
                Update / Correct Submitted Information
              </Button>
            )}

            <div className="text-center pt-2">
              <a
                href="mailto:support@aidx.africa?subject=Doctor%20Credential%20Verification%20Inquiry"
                className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors underline"
              >
                <Mail className="w-3.5 h-3.5" />
                Have questions? Contact our Clinical Support Desk
              </a>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export function DoctorSuspendedScreen({ status }: { status: DoctorApplicationStatus }) {
  return (
    <div className="max-w-xl mx-auto space-y-4 py-8 px-4">
      <Card className="border-destructive/30 shadow-lg shadow-destructive/5">
        <CardHeader className="items-center text-center">
          <div className="w-16 h-16 rounded-2xl bg-destructive/10 text-destructive flex items-center justify-center mb-3">
            <ShieldOff className="w-8 h-8" />
          </div>
          <CardTitle className="text-xl font-bold">Doctor Account Suspended</CardTitle>
          <CardDescription className="text-sm">
            Your clinical consultations, prescription rights, and profile are temporarily inactive.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {status.suspended_reason && (
            <div className="rounded-lg bg-destructive/10 p-3.5 text-xs text-destructive font-medium border border-destructive/20 leading-relaxed">
              <span className="font-bold">Reason:</span> {status.suspended_reason}
            </div>
          )}
          <Button asChild className="w-full gap-2 font-medium">
            <a href="mailto:support@aidx.africa?subject=Doctor%20Account%20Suspension%20Appeal">
              <Mail className="w-4 h-4" /> Contact Medical Governance Board
            </a>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

