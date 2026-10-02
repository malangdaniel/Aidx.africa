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

interface Review {
  id: string;
  rating: number;
  comment: string | null;
  created_at: string;
  reviewerName: string;
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
  const [reviews, setReviews] = useState<Review[]>([]);
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
      const { data: upcomingData, error: upcomingError } = await supabase
        .from('consultations')
        .select(`
          id, scheduled_at, status, notes, patient_id,
          profiles:patient_id (first_name, last_name)
        `)
        .eq('doctor_id', user.id)
        .in('status', ['scheduled', 'ongoing'])
        .order('scheduled_at', { ascending: true })
        .limit(10);

      if (upcomingError) throw upcomingError;

      // Handle missing profiles (fallback)
      const patientIds = (upcomingData || [])
        .filter((c: any) => !c.profiles)
        .map((c: any) => c.patient_id)
        .filter(Boolean); // Remove null/undefined

      let profilesMap: Record<string, any> = {};
      if (patientIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('user_id, first_name, last_name')
          .in('user_id', patientIds);

        (profiles || []).forEach((p: any) => {
          profilesMap[p.user_id] = p;
        });
      }

      const mappedUpcoming: UpcomingConsultation[] = (upcomingData || []).map((c: any) => {
        // Try joined profile first, then fallback to manual map
        const profile = c.profiles || profilesMap[c.patient_id] || {};
        const fName = profile.first_name || 'Unknown';
        const lName = profile.last_name || 'User';

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

      // Fetch reviews
      const { data: reviewsData } = await supabase
        .from('reviews')
        .select(`
          id, rating, comment, created_at, reviewer_id,
          profiles:reviewer_id (first_name, last_name)
        `)
        .eq('reviewee_id', user.id)
        .order('created_at', { ascending: false });

      const mappedReviews: Review[] = (reviewsData || []).map((r: any) => {
        // Handle potential array or object for joined table
        const profile = Array.isArray(r.profiles) ? r.profiles[0] : r.profiles || {};
        const fName = profile.first_name || 'Anonymous';
        const lName = profile.last_name || 'Patient';
        return {
          id: r.id,
          rating: r.rating,
          comment: r.comment,
          created_at: r.created_at,
          reviewerName: `${fName} ${lName}`.trim(),
        };
      });
      setReviews(mappedReviews);
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

            {reviews.length > 0 && (
              <div className="space-y-4 mt-6">
                <h3 className="font-bold text-md">Recent Reviews</h3>
                {reviews.map((review) => (
                  <Card key={review.id} className="bg-card">
                    <CardContent className="p-4">
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <p className="font-semibold text-sm">{review.reviewerName}</p>
                          <p className="text-xs text-muted-foreground">{new Date(review.created_at).toLocaleDateString()}</p>
                        </div>
                        <div className="flex items-center">
                          <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                          <span className="ml-1 text-sm font-bold">{review.rating.toFixed(1)}</span>
                        </div>
                      </div>
                      {review.comment && (
                        <p className="text-sm text-muted-foreground mt-2 italic">"{review.comment}"</p>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
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
            <div className="relative overflow-hidden rounded-2xl bg-hero-gradient p-6 md:p-8 text-primary-foreground shadow-luxury border border-white/10">
              <div className="absolute -top-12 -right-12 w-48 h-48 rounded-full bg-accent/20 blur-3xl pointer-events-none" />
              <div className="absolute -bottom-12 -left-12 w-48 h-48 rounded-full bg-secondary/20 blur-3xl pointer-events-none" />

              <div className="relative z-10 space-y-2">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 backdrop-blur-md text-[11px] font-medium border border-white/15">
                  <Stethoscope className="w-3.5 h-3.5 text-accent" />
                  <span>Clinical Workstation</span>
                </div>
                <h1 className="text-xl md:text-2xl font-bold tracking-tight">Welcome back, {doctorName}!</h1>
                <p className="text-sm text-primary-foreground/80 font-medium max-w-xl">
                  You have <span className="text-white font-bold">{stats.scheduled} session{stats.scheduled !== 1 ? 's' : ''}</span> scheduled.
                </p>
              </div>
              <Stethoscope className="absolute right-[-20px] bottom-[-20px] w-48 h-48 text-white/5 -rotate-12 pointer-events-none" />
            </div>

            {/* Quick Stats Grid */}
            <div className="grid grid-cols-2 gap-3.5 md:grid-cols-4">
              <Card className="group hover:border-primary/40 hover:shadow-md transition-all duration-300 hover:-translate-y-0.5 bg-card/80 backdrop-blur-sm">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 p-4 pb-2">
                  <CardTitle className="text-xs font-semibold text-muted-foreground group-hover:text-foreground transition-colors">Total Consults</CardTitle>
                  <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center group-hover:bg-primary group-hover:text-primary-foreground transition-all duration-200">
                    <Users className="h-4 w-4 text-primary group-hover:text-primary-foreground" />
                  </div>
                </CardHeader>
                <CardContent className="p-4 pt-0">
                  <div className="text-2xl font-bold text-foreground">{stats.totalConsults}</div>
                  <p className="text-[11px] text-muted-foreground mt-0.5">Global consultations</p>
                </CardContent>
              </Card>

              <Card className="group hover:border-primary/40 hover:shadow-md transition-all duration-300 hover:-translate-y-0.5 bg-card/80 backdrop-blur-sm">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 p-4 pb-2">
                  <CardTitle className="text-xs font-semibold text-muted-foreground group-hover:text-foreground transition-colors">Active Sessions</CardTitle>
                  <div className="w-8 h-8 rounded-xl bg-emerald-500/10 flex items-center justify-center group-hover:bg-emerald-500 group-hover:text-white transition-all duration-200">
                    <Calendar className="h-4 w-4 text-emerald-600 dark:text-emerald-400 group-hover:text-white" />
                  </div>
                </CardHeader>
                <CardContent className="p-4 pt-0">
                  <div className="text-2xl font-bold text-foreground">{stats.scheduled + stats.ongoing}</div>
                  <p className="text-[11px] text-muted-foreground mt-0.5">Upcoming visits</p>
                </CardContent>
              </Card>

              <Card className="group hover:border-primary/40 hover:shadow-md transition-all duration-300 hover:-translate-y-0.5 bg-card/80 backdrop-blur-sm">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 p-4 pb-2">
                  <CardTitle className="text-xs font-semibold text-muted-foreground group-hover:text-foreground transition-colors">Settled Earnings</CardTitle>
                  <div className="w-8 h-8 rounded-xl bg-emerald-500/10 flex items-center justify-center group-hover:bg-emerald-500 group-hover:text-white transition-all duration-200">
                    <DollarSign className="h-4 w-4 text-emerald-600 dark:text-emerald-400 group-hover:text-white" />
                  </div>
                </CardHeader>
                <CardContent className="p-4 pt-0">
                  <div className="text-2xl font-bold text-foreground">₦{formatEarnings(stats.totalEarnings)}</div>
                  <p className="text-[11px] text-muted-foreground mt-0.5">Paid earnings</p>
                </CardContent>
              </Card>

              <Card className="group hover:border-primary/40 hover:shadow-md transition-all duration-300 hover:-translate-y-0.5 bg-card/80 backdrop-blur-sm">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 p-4 pb-2">
                  <CardTitle className="text-xs font-semibold text-muted-foreground group-hover:text-foreground transition-colors">Reputation Score</CardTitle>
                  <div className="w-8 h-8 rounded-xl bg-amber-500/10 flex items-center justify-center group-hover:bg-amber-500 group-hover:text-white transition-all duration-200">
                    <Star className="h-4 w-4 text-amber-500 fill-amber-500 group-hover:text-white group-hover:fill-white" />
                  </div>
                </CardHeader>
                <CardContent className="p-4 pt-0">
                  <div className="text-2xl font-bold text-foreground">{stats.rating > 0 ? stats.rating.toFixed(1) : '—'}</div>
                  <p className="text-[11px] text-muted-foreground mt-0.5">Excellence rating</p>
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
