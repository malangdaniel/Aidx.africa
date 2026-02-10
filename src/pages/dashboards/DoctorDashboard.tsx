import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import DashboardLayout from '@/components/layout/DashboardLayout';
import BottomNav from '@/components/layout/BottomNav';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Stethoscope, DollarSign, Calendar, Star, Users, TrendingUp, Loader2, UserCog } from 'lucide-react';
import ConsultationView from '@/components/doctor/ConsultationView';
import PatientList from '@/components/doctor/PatientList';
import PatientDetail from '@/components/doctor/PatientDetail';
import { DoctorProfileSettings } from '@/components/doctor/settings/DoctorProfileSettings';

interface UpcomingConsultation {
  id: string;
  patientName: string;
  patientInitials: string;
  reason: string;
  time: string;
  status: string;
}

interface DoctorStats {
  scheduled: number;
  ongoing: number;
  completed: number;
  cancelled: number;
  totalEarnings: number;
  pendingPayouts: number;
  rating: number;
  totalConsults: number;
}

export default function DoctorDashboard() {
  const { profile, user } = useAuth();
  const doctorName = profile ? `Dr. ${profile.first_name || ''} ${profile.last_name || ''}` : 'Doctor';

  const [activeTab, setActiveTab] = useState('consultations');
  const [activeConsultation, setActiveConsultation] = useState<{ id: string, name: string } | null>(null);
  const [activePatient, setActivePatient] = useState<{ id: string } | null>(null);

  const [upcoming, setUpcoming] = useState<UpcomingConsultation[]>([]);
  const [stats, setStats] = useState<DoctorStats>({
    scheduled: 0, ongoing: 0, completed: 0, cancelled: 0,
    totalEarnings: 0, pendingPayouts: 0, rating: 0, totalConsults: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) fetchDashboardData();
  }, [user]);

  const fetchDashboardData = async () => {
    if (!user) return;
    setLoading(true);
    try {
      // Fetch consultation counts
      const [scheduledRes, ongoingRes, completedRes, cancelledRes] = await Promise.all([
        supabase.from('consultations').select('id', { count: 'exact', head: true }).eq('doctor_id', user.id).eq('status', 'scheduled'),
        supabase.from('consultations').select('id', { count: 'exact', head: true }).eq('doctor_id', user.id).eq('status', 'ongoing'),
        supabase.from('consultations').select('id', { count: 'exact', head: true }).eq('doctor_id', user.id).eq('status', 'completed'),
        supabase.from('consultations').select('id', { count: 'exact', head: true }).eq('doctor_id', user.id).eq('status', 'cancelled'),
      ]);

      // Fetch earnings
      const { data: earningsData } = await supabase
        .from('consultations')
        .select('price')
        .eq('doctor_id', user.id)
        .eq('status', 'completed');

      const totalEarnings = (earningsData || []).reduce((sum, c) => sum + (c.price || 0), 0);

      // Fetch pending payouts
      const { data: payoutsData } = await supabase
        .from('payout_requests')
        .select('net_amount')
        .eq('recipient_id', user.id)
        .eq('status', 'pending');

      const pendingPayouts = (payoutsData || []).reduce((sum, p) => sum + (p.net_amount || 0), 0);

      // Fetch doctor rating
      const { data: doctorData } = await supabase
        .from('doctors')
        .select('rating, total_consultations')
        .eq('user_id', user.id)
        .maybeSingle();

      setStats({
        scheduled: scheduledRes.count || 0,
        ongoing: ongoingRes.count || 0,
        completed: completedRes.count || 0,
        cancelled: cancelledRes.count || 0,
        totalEarnings,
        pendingPayouts,
        rating: Number(doctorData?.rating) || 0,
        totalConsults: doctorData?.total_consultations || (completedRes.count || 0),
      });

      // Fetch upcoming consultations with patient names
      const { data: upcomingData } = await supabase
        .from('consultations')
        .select(`
          id, scheduled_at, status, notes,
          profiles:patient_id (first_name, last_name)
        `)
        .eq('doctor_id', user.id)
        .in('status', ['scheduled', 'ongoing'])
        .order('scheduled_at', { ascending: true })
        .limit(5);

      const mappedUpcoming: UpcomingConsultation[] = (upcomingData || []).map((c: any) => {
        const fName = c.profiles?.first_name || 'Unknown';
        const lName = c.profiles?.last_name || '';
        return {
          id: c.id,
          patientName: `${fName} ${lName}`.trim(),
          patientInitials: `${fName[0] || ''}${lName[0] || ''}`.toUpperCase(),
          reason: c.notes || 'Consultation',
          time: c.scheduled_at ? new Date(c.scheduled_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'TBD',
          status: c.status,
        };
      });

      setUpcoming(mappedUpcoming);
    } catch (error) {
      console.error('Error fetching doctor dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const tabs = [
    { id: 'consultations', label: 'Consults', icon: Calendar },
    { id: 'patients', label: 'Patients', icon: Users },
    { id: 'earnings', label: 'Earnings', icon: DollarSign },
    { id: 'reviews', label: 'Reviews', icon: Star },
    { id: 'profile', label: 'Profile', icon: UserCog },
  ];

  const renderContent = () => {
    if (activeConsultation) {
      return (
        <div className="space-y-4 animate-in slide-in-from-right duration-300">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => setActiveConsultation(null)} className="h-8 px-2">
              ← Back to Dashboard
            </Button>
          </div>
          <ConsultationView
            consultationId={activeConsultation.id}
            patientName={activeConsultation.name}
            onEndConsultation={() => {
              setActiveConsultation(null);
              fetchDashboardData();
            }}
          />
        </div>
      );
    }

    if (activePatient) {
      return (
        <div className="space-y-4 animate-in slide-in-from-right duration-300">
          <PatientDetail patientId={activePatient.id} onBack={() => setActivePatient(null)} />
        </div>
      );
    }

    switch (activeTab) {
      case 'consultations':
        return (
          <div className="space-y-4 animate-in fade-in duration-500">
            {/* Status Badges */}
            <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide -mx-4 px-4 md:mx-0 md:px-0">
              <Badge variant="secondary" className="whitespace-nowrap text-[10px] md:text-xs">Scheduled: {stats.scheduled}</Badge>
              <Badge variant="default" className="whitespace-nowrap text-[10px] md:text-xs">Ongoing: {stats.ongoing}</Badge>
              <Badge variant="outline" className="whitespace-nowrap text-[10px] md:text-xs">Completed: {stats.completed}</Badge>
            </div>

            {/* Upcoming Appointments */}
            <Card className="border-muted-foreground/10 shadow-sm">
              <CardHeader className="pb-2 p-4">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-primary" />
                  Upcoming Sessions
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 p-4 pt-0">
                {loading ? (
                  <div className="flex justify-center py-6">
                    <Loader2 className="w-6 h-6 animate-spin text-primary" />
                  </div>
                ) : upcoming.length > 0 ? (
                  upcoming.map((session, idx) => (
                    <div
                      key={session.id}
                      className={`flex items-center gap-3 p-3 border rounded-xl transition-all group ${idx === 0 ? 'bg-primary/5 border-primary/10 hover:bg-primary/10' : 'opacity-70 bg-muted/30'
                        }`}
                    >
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm shadow-sm ${idx === 0 ? 'bg-primary text-primary-foreground' : 'bg-muted-foreground/20 text-muted-foreground'
                        }`}>
                        {session.patientInitials}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="font-bold text-sm truncate">{session.patientName}</h4>
                        <p className="text-[11px] text-muted-foreground">{session.reason} • {session.time}</p>
                      </div>
                      <Button
                        size="sm"
                        variant={idx === 0 ? 'default' : 'outline'}
                        onClick={() => setActiveConsultation({ id: session.id, name: session.patientName })}
                        className="rounded-full h-8 px-4"
                        disabled={session.status !== 'scheduled' && session.status !== 'ongoing'}
                      >
                        {session.status === 'ongoing' ? 'Resume' : 'Start'}
                      </Button>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-6 text-muted-foreground">
                    <Calendar className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">No upcoming sessions</p>
                    <p className="text-xs">Scheduled consultations will appear here</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Status Cards Grid */}
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <Card className="border-primary/20 bg-primary/5 shadow-none pb-0">
                <CardContent className="p-4">
                  <p className="text-[10px] uppercase tracking-wider font-bold text-primary/70 mb-1">Scheduled</p>
                  <p className="text-2xl font-black text-primary">{stats.scheduled}</p>
                </CardContent>
              </Card>
              <Card className="border-secondary/20 bg-secondary/5 shadow-none pb-0">
                <CardContent className="p-4">
                  <p className="text-[10px] uppercase tracking-wider font-bold text-secondary/70 mb-1">Ongoing</p>
                  <p className="text-2xl font-black text-secondary">{stats.ongoing}</p>
                </CardContent>
              </Card>
              <Card className="border-green-500/20 bg-green-500/5 shadow-none pb-0">
                <CardContent className="p-4">
                  <p className="text-[10px] uppercase tracking-wider font-bold text-green-600/70 mb-1">Completed</p>
                  <p className="text-2xl font-black text-green-700">{stats.completed}</p>
                </CardContent>
              </Card>
              <Card className="border-destructive/20 bg-destructive/5 shadow-none pb-0">
                <CardContent className="p-4">
                  <p className="text-[10px] uppercase tracking-wider font-bold text-destructive/70 mb-1">Cancelled</p>
                  <p className="text-2xl font-black text-destructive">{stats.cancelled}</p>
                </CardContent>
              </Card>
            </div>
          </div>
        );

      case 'patients':
        return (
          <div className="space-y-4 animate-in fade-in duration-500">
            <h2 className="text-lg font-bold">My Patients</h2>
            <PatientList onSelectPatient={(id) => setActivePatient({ id })} />
          </div>
        );

      case 'earnings':
        return (
          <div className="space-y-4 animate-in fade-in duration-500">
            <h2 className="text-lg font-bold">Financials</h2>
            <div className="grid gap-4 md:grid-cols-2">
              <Card className="bg-primary/5 border-primary/20">
                <CardHeader className="pb-2">
                  <CardTitle className="text-xs font-bold uppercase tracking-widest text-primary flex items-center gap-2">
                    <DollarSign className="w-4 h-4" />
                    Total Earnings
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-black tracking-tighter">₦{stats.totalEarnings.toLocaleString('en-NG', { minimumFractionDigits: 2 })}</div>
                  <p className="text-[10px] text-muted-foreground mt-1">From {stats.completed} completed consultations</p>
                </CardContent>
              </Card>
              <Card className="bg-secondary/5 border-secondary/20">
                <CardHeader className="pb-2">
                  <CardTitle className="text-xs font-bold uppercase tracking-widest text-secondary flex items-center gap-2">
                    <TrendingUp className="w-4 h-4" />
                    Pending Payouts
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-black tracking-tighter text-secondary">₦{stats.pendingPayouts.toLocaleString('en-NG', { minimumFractionDigits: 2 })}</div>
                  <p className="text-[10px] text-muted-foreground mt-1">Processing for next cycle</p>
                </CardContent>
              </Card>
            </div>
          </div>
        );

      case 'reviews':
        return (
          <div className="space-y-4 animate-in fade-in duration-500">
            <h2 className="text-lg font-bold">Ratings & Feedback</h2>
            <Card className="border-dashed border-2">
              <CardContent className="p-8 text-center">
                <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
                  <Star className="w-8 h-8 text-muted-foreground" />
                </div>
                <h3 className="font-bold text-base mb-1">
                  {stats.rating > 0 ? `Your Rating: ${stats.rating.toFixed(1)} ⭐` : 'Building Your Credibility'}
                </h3>
                <p className="text-sm text-muted-foreground max-w-[240px] mx-auto leading-relaxed">
                  {stats.rating > 0
                    ? `Based on ${stats.totalConsults} consultations. Keep providing excellent care!`
                    : 'Complete high-quality consultations to start receiving reviews from your patients.'
                  }
                </p>
              </CardContent>
            </Card>
          </div>
        );

      case 'profile':
        return (
          <div className="space-y-4 animate-in fade-in duration-500 h-[calc(100vh-200px)] flex flex-col">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold">Profile Settings</h2>
            </div>
            <div className="flex-1 overflow-hidden border rounded-xl bg-card">
              <div className="h-full p-4 overflow-hidden">
                <DoctorProfileSettings onSaved={fetchDashboardData} />
              </div>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  const formatEarnings = (amount: number) => {
    if (amount >= 1000000) return `${(amount / 1000000).toFixed(1)}M`;
    if (amount >= 1000) return `${(amount / 1000).toFixed(0)}k`;
    return amount.toString();
  };

  return (
    <DashboardLayout
      title="Doctor Dashboard"
      tabs={tabs}
      activeTab={activeTab}
      onTabChange={setActiveTab}
    >
      <div className="space-y-6 pb-4">
        {/* Welcome Section */}
        {!activeConsultation && !activePatient && (
          <>
            <div className="bg-gradient-to-br from-primary via-primary/90 to-secondary rounded-2xl p-6 text-white shadow-xl relative overflow-hidden">
              <div className="relative z-10">
                <h1 className="text-xl font-black tracking-tight mb-1">Welcome back, {doctorName}!</h1>
                <p className="text-[13px] text-white/80 font-medium">
                  You have <span className="text-white font-bold">{stats.scheduled} session{stats.scheduled !== 1 ? 's' : ''}</span> scheduled.
                </p>
              </div>
              <Stethoscope className="absolute right-[-20px] bottom-[-20px] w-48 h-48 text-white/10 -rotate-12" />
            </div>

            {/* Quick Stats Grid */}
            <div className="flex gap-4 overflow-x-auto pb-4 -mx-4 px-4 scrollbar-hide snap-x snap-mandatory md:grid md:grid-cols-4 md:mx-0 md:px-0 md:overflow-visible">
              <Card className="min-w-[140px] flex-shrink-0 snap-center border-muted-foreground/10 shadow-sm">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 p-3 pb-1">
                  <CardTitle className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Total</CardTitle>
                  <Users className="h-3.5 w-3.5 text-primary" />
                </CardHeader>
                <CardContent className="p-3 pt-0">
                  <div className="text-2xl font-black">{stats.totalConsults}</div>
                  <p className="text-[9px] text-muted-foreground font-medium">Global Consults</p>
                </CardContent>
              </Card>
              <Card className="min-w-[140px] flex-shrink-0 snap-center border-muted-foreground/10 shadow-sm">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 p-3 pb-1">
                  <CardTitle className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Active</CardTitle>
                  <Calendar className="h-3.5 w-3.5 text-secondary" />
                </CardHeader>
                <CardContent className="p-3 pt-0">
                  <div className="text-2xl font-black">{stats.scheduled + stats.ongoing}</div>
                  <p className="text-[9px] text-muted-foreground font-medium">Upcoming</p>
                </CardContent>
              </Card>
              <Card className="min-w-[140px] flex-shrink-0 snap-center border-muted-foreground/10 shadow-sm">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 p-3 pb-1">
                  <CardTitle className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Settled</CardTitle>
                  <DollarSign className="h-3.5 w-3.5 text-green-600" />
                </CardHeader>
                <CardContent className="p-3 pt-0">
                  <div className="text-2xl font-black">{formatEarnings(stats.totalEarnings)}</div>
                  <p className="text-[9px] text-muted-foreground font-medium">Paid Earnings</p>
                </CardContent>
              </Card>
              <Card className="min-w-[140px] flex-shrink-0 snap-center border-muted-foreground/10 shadow-sm">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 p-3 pb-1">
                  <CardTitle className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Rep</CardTitle>
                  <Star className="h-3.5 w-3.5 text-orange-500 fill-orange-500" />
                </CardHeader>
                <CardContent className="p-3 pt-0">
                  <div className="text-2xl font-black">{stats.rating > 0 ? stats.rating.toFixed(1) : '—'}</div>
                  <p className="text-[9px] text-muted-foreground font-medium">Excellence Score</p>
                </CardContent>
              </Card>
            </div>
          </>
        )}

        <div className="min-h-[50vh]">
          {renderContent()}
        </div>
      </div>

      <BottomNav tabs={tabs} activeTab={activeTab} onTabChange={setActiveTab} />
    </DashboardLayout>
  );
}
