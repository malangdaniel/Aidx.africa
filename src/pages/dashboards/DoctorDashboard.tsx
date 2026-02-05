import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import DashboardLayout from '@/components/layout/DashboardLayout';
import BottomNav from '@/components/layout/BottomNav';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Stethoscope, DollarSign, Calendar, Star, Users, TrendingUp } from 'lucide-react';
import ConsultationView from '@/components/doctor/ConsultationView';
import PatientList from '@/components/doctor/PatientList';
import PatientDetail from '@/components/doctor/PatientDetail';

export default function DoctorDashboard() {
  const { profile } = useAuth();
  const doctorName = profile ? `Dr. ${profile.first_name || ''} ${profile.last_name || ''}` : 'Doctor';

  const [activeTab, setActiveTab] = useState('consultations');
  const [activeConsultation, setActiveConsultation] = useState<{ id: string, name: string } | null>(null);
  const [activePatient, setActivePatient] = useState<{ id: string } | null>(null);

  const tabs = [
    { id: 'consultations', label: 'Consults', icon: Calendar },
    { id: 'patients', label: 'Patients', icon: Users },
    { id: 'earnings', label: 'Earnings', icon: DollarSign },
    { id: 'reviews', label: 'Reviews', icon: Star },
  ];

  const renderContent = () => {
    // Sub-view: Consultation
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
            clinicalSummary={`PATIENT CLINICAL SUMMARY
Patient Name: ${activeConsultation.name}
Hospital Number: GSH/001234
Age: 32 years | Sex: Male

Presenting Complaints:
- Severe chest pain radiating to left arm (7/10)

History of Present Illness:
Patient reports sudden onset of sharp, crushing chest pain starting 1 hour ago while at rest. Associated with nausea.

Past Medical History:
- Hypertension (diag. 2020)
- Allergies: Penicillin, Peanuts

Social History:
- Smoker: 1 pack/day for 10 years

Family History:
- Father: MI at age 55`}
            onEndConsultation={() => setActiveConsultation(null)}
          />
        </div>
      );
    }

    // Sub-view: Patient Detail
    if (activePatient) {
      return (
        <div className="space-y-4 animate-in slide-in-from-right duration-300">
          <PatientDetail patientId={activePatient.id} onBack={() => setActivePatient(null)} />
        </div>
      );
    }

    // Main Dashboard Tabs
    switch (activeTab) {
      case 'consultations':
        return (
          <div className="space-y-4 animate-in fade-in duration-500">
            {/* Status Badges */}
            <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide -mx-4 px-4 md:mx-0 md:px-0">
              <Badge variant="secondary" className="whitespace-nowrap text-[10px] md:text-xs">Scheduled: 1</Badge>
              <Badge variant="default" className="whitespace-nowrap text-[10px] md:text-xs">Ongoing: 0</Badge>
              <Badge variant="outline" className="whitespace-nowrap text-[10px] md:text-xs">Completed: 12</Badge>
            </div>

            {/* Upcoming Appointments */}
            <Card className="border-muted-foreground/10 shadow-sm">
              <CardHeader className="pb-2 p-4">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-primary" />
                  Upcoming Session
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 p-4 pt-0">
                <div className="flex items-center gap-3 p-3 border rounded-xl bg-primary/5 border-primary/10 hover:bg-primary/10 transition-all group">
                  <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center text-primary-foreground font-bold text-sm shadow-sm">
                    JD
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="font-bold text-sm truncate">John Doe</h4>
                    <p className="text-[11px] text-muted-foreground">General Checkup • 2:00 PM</p>
                  </div>
                  <Button size="sm" onClick={() => setActiveConsultation({ id: '1', name: 'John Doe' })} className="rounded-full h-8 px-4">
                    Start
                  </Button>
                </div>

                <div className="flex items-center gap-3 p-3 border rounded-xl opacity-60 bg-muted/30">
                  <div className="w-10 h-10 rounded-full bg-muted-foreground/20 flex items-center justify-center font-bold text-sm text-muted-foreground">
                    AS
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="font-medium text-sm truncate">Amara Smith</h4>
                    <p className="text-[11px] text-muted-foreground">Follow-up • 4:00 PM</p>
                  </div>
                  <Button variant="outline" size="sm" disabled className="rounded-full h-8">Later</Button>
                </div>
              </CardContent>
            </Card>

            {/* Status Cards Grid */}
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <Card className="border-primary/20 bg-primary/5 shadow-none pb-0">
                <CardContent className="p-4">
                  <p className="text-[10px] uppercase tracking-wider font-bold text-primary/70 mb-1">Scheduled</p>
                  <p className="text-2xl font-black text-primary">0</p>
                </CardContent>
              </Card>
              <Card className="border-secondary/20 bg-secondary/5 shadow-none pb-0">
                <CardContent className="p-4">
                  <p className="text-[10px] uppercase tracking-wider font-bold text-secondary/70 mb-1">Ongoing</p>
                  <p className="text-2xl font-black text-secondary">0</p>
                </CardContent>
              </Card>
              <Card className="border-green-500/20 bg-green-500/5 shadow-none pb-0">
                <CardContent className="p-4">
                  <p className="text-[10px] uppercase tracking-wider font-bold text-green-600/70 mb-1">Completed</p>
                  <p className="text-2xl font-black text-green-700">12</p>
                </CardContent>
              </Card>
              <Card className="border-destructive/20 bg-destructive/5 shadow-none pb-0">
                <CardContent className="p-4">
                  <p className="text-[10px] uppercase tracking-wider font-bold text-destructive/70 mb-1">Cancelled</p>
                  <p className="text-2xl font-black text-destructive">0</p>
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
                  <div className="text-3xl font-black tracking-tighter">₦142,500.00</div>
                  <p className="text-[10px] text-muted-foreground mt-1">Settled & paid to account</p>
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
                  <div className="text-3xl font-black tracking-tighter text-secondary">₦12,000.00</div>
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
                <h3 className="font-bold text-base mb-1">Building Your Credibility</h3>
                <p className="text-sm text-muted-foreground max-w-[240px] mx-auto leading-relaxed">
                  Complete high-quality consultations to start receiving reviews from your patients.
                </p>
              </CardContent>
            </Card>
          </div>
        );

      default:
        return null;
    }
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
                <p className="text-[13px] text-white/80 font-medium">You have <span className="text-white font-bold">1 session</span> scheduled for this afternoon.</p>
              </div>
              <Stethoscope className="absolute right-[-20px] bottom-[-20px] w-48 h-48 text-white/10 -rotate-12" />
            </div>

            {/* Quick Stats Grid for Mobile-First */}
            <div className="flex gap-4 overflow-x-auto pb-4 -mx-4 px-4 scrollbar-hide snap-x snap-mandatory md:grid md:grid-cols-4 md:mx-0 md:px-0 md:overflow-visible">
              <Card className="min-w-[140px] flex-shrink-0 snap-center border-muted-foreground/10 shadow-sm">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 p-3 pb-1">
                  <CardTitle className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Total</CardTitle>
                  <Users className="h-3.5 w-3.5 text-primary" />
                </CardHeader>
                <CardContent className="p-3 pt-0">
                  <div className="text-2xl font-black">12</div>
                  <p className="text-[9px] text-muted-foreground font-medium">Global Consults</p>
                </CardContent>
              </Card>
              <Card className="min-w-[140px] flex-shrink-0 snap-center border-muted-foreground/10 shadow-sm">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 p-3 pb-1">
                  <CardTitle className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Active</CardTitle>
                  <Calendar className="h-3.5 w-3.5 text-secondary" />
                </CardHeader>
                <CardContent className="p-3 pt-0">
                  <div className="text-2xl font-black">3</div>
                  <p className="text-[9px] text-muted-foreground font-medium">This Week</p>
                </CardContent>
              </Card>
              <Card className="min-w-[140px] flex-shrink-0 snap-center border-muted-foreground/10 shadow-sm">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 p-3 pb-1">
                  <CardTitle className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Settled</CardTitle>
                  <DollarSign className="h-3.5 w-3.5 text-green-600" />
                </CardHeader>
                <CardContent className="p-3 pt-0">
                  <div className="text-2xl font-black">142k</div>
                  <p className="text-[9px] text-muted-foreground font-medium">Paid Earnings</p>
                </CardContent>
              </Card>
              <Card className="min-w-[140px] flex-shrink-0 snap-center border-muted-foreground/10 shadow-sm">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 p-3 pb-1">
                  <CardTitle className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Rep</CardTitle>
                  <Star className="h-3.5 w-3.5 text-orange-500 fill-orange-500" />
                </CardHeader>
                <CardContent className="p-3 pt-0">
                  <div className="text-2xl font-black">5.0</div>
                  <p className="text-[9px] text-muted-foreground font-medium">Excellence Score</p>
                </CardContent>
              </Card>
            </div>
          </>
        )}

        {/* Main Content Area */}
        <div className="min-h-[50vh]">
          {renderContent()}
        </div>
      </div>

      {/* Mobile Bottom Navigation */}
      <BottomNav tabs={tabs} activeTab={activeTab} onTabChange={setActiveTab} />
    </DashboardLayout>
  );
}