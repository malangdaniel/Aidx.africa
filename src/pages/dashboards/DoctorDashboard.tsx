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

  if (activeConsultation) {
    return (
      <div className="min-h-screen bg-background p-4">
        <div className="mb-4">
          <Button variant="ghost" size="sm" onClick={() => setActiveConsultation(null)}>← Back</Button>
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

  if (activePatient) {
    return (
      <div className="min-h-screen bg-background p-4">
        <PatientDetail patientId={activePatient.id} onBack={() => setActivePatient(null)} />
      </div>
    );
  }

  const renderContent = () => {
    switch (activeTab) {
      case 'consultations':
        return (
          <div className="space-y-4">
            {/* Status Badges */}
            <div className="flex gap-2 overflow-x-auto pb-1">
              <Badge variant="secondary" className="whitespace-nowrap text-xs">Scheduled: 1</Badge>
              <Badge variant="default" className="whitespace-nowrap text-xs">Ongoing: 0</Badge>
              <Badge variant="outline" className="whitespace-nowrap text-xs">Completed: 12</Badge>
            </div>

            {/* Upcoming Appointments */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Upcoming</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center gap-3 p-3 border rounded-lg bg-card hover:bg-muted/50 transition-colors">
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold text-sm">
                    JD
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="font-medium text-sm truncate">John Doe</h4>
                    <p className="text-xs text-muted-foreground">General Checkup • 2:00 PM</p>
                  </div>
                  <Button size="sm" onClick={() => setActiveConsultation({ id: '1', name: 'John Doe' })}>
                    Start
                  </Button>
                </div>

                <div className="flex items-center gap-3 p-3 border rounded-lg opacity-60">
                  <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center font-semibold text-sm">
                    AS
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="font-medium text-sm truncate">Amara Smith</h4>
                    <p className="text-xs text-muted-foreground">Follow-up • 4:00 PM</p>
                  </div>
                  <Button variant="outline" size="sm" disabled>Later</Button>
                </div>
              </CardContent>
            </Card>

            {/* Status Cards Grid */}
            <div className="grid grid-cols-2 gap-2">
              <Card className="border-primary/20 bg-primary/5">
                <CardContent className="p-3">
                  <p className="text-xs text-muted-foreground">Scheduled</p>
                  <p className="text-xl font-bold">0</p>
                </CardContent>
              </Card>
              <Card className="border-secondary/20 bg-secondary/5">
                <CardContent className="p-3">
                  <p className="text-xs text-muted-foreground">Ongoing</p>
                  <p className="text-xl font-bold">0</p>
                </CardContent>
              </Card>
              <Card className="border-green-500/20 bg-green-500/5">
                <CardContent className="p-3">
                  <p className="text-xs text-muted-foreground">Completed</p>
                  <p className="text-xl font-bold text-green-700">0</p>
                </CardContent>
              </Card>
              <Card className="border-destructive/20 bg-destructive/5">
                <CardContent className="p-3">
                  <p className="text-xs text-muted-foreground">Cancelled</p>
                  <p className="text-xl font-bold text-destructive">0</p>
                </CardContent>
              </Card>
            </div>
          </div>
        );

      case 'patients':
        return (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold">My Patients</h2>
            <PatientList onSelectPatient={(id) => setActivePatient({ id })} />
          </div>
        );

      case 'earnings':
        return (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold">Earnings</h2>
            <div className="grid gap-3">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <DollarSign className="w-4 h-4" />
                    Total Earnings
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">₦0.00</div>
                  <p className="text-xs text-muted-foreground">All time</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <TrendingUp className="w-4 h-4" />
                    Pending Payouts
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">₦0.00</div>
                  <p className="text-xs text-muted-foreground">Awaiting approval</p>
                </CardContent>
              </Card>
            </div>
          </div>
        );

      case 'reviews':
        return (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold">Patient Reviews</h2>
            <Card>
              <CardContent className="p-6 text-center">
                <Star className="w-10 h-10 mx-auto mb-3 text-muted-foreground" />
                <h3 className="font-medium mb-1">No Reviews Yet</h3>
                <p className="text-sm text-muted-foreground">Complete consultations to receive reviews</p>
              </CardContent>
            </Card>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <DashboardLayout title="Doctor Dashboard">
      <div className="space-y-4">
        {/* Welcome Section */}
        <div className="bg-gradient-to-br from-primary via-primary/90 to-secondary rounded-xl p-4 text-white shadow-lg">
          <h1 className="text-lg font-bold">Welcome, {doctorName}!</h1>
          <p className="text-sm text-white/85">Ready to help patients today?</p>
        </div>

        {/* Quick Stats - Horizontal scroll on mobile */}
        <div className="flex gap-3 overflow-x-auto pb-2 -mx-4 px-4 md:grid md:grid-cols-4 md:overflow-visible md:mx-0 md:px-0">
          <Card className="min-w-[120px] flex-shrink-0 md:min-w-0">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 p-3 pb-1">
              <CardTitle className="text-xs font-medium">Total</CardTitle>
              <Users className="h-3.5 w-3.5 text-muted-foreground" />
            </CardHeader>
            <CardContent className="p-3 pt-0">
              <div className="text-xl font-bold">12</div>
              <p className="text-[10px] text-muted-foreground">Consults</p>
            </CardContent>
          </Card>
          <Card className="min-w-[120px] flex-shrink-0 md:min-w-0">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 p-3 pb-1">
              <CardTitle className="text-xs font-medium">Month</CardTitle>
              <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
            </CardHeader>
            <CardContent className="p-3 pt-0">
              <div className="text-xl font-bold">3</div>
              <p className="text-[10px] text-muted-foreground">This month</p>
            </CardContent>
          </Card>
          <Card className="min-w-[120px] flex-shrink-0 md:min-w-0">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 p-3 pb-1">
              <CardTitle className="text-xs font-medium">Earnings</CardTitle>
              <DollarSign className="h-3.5 w-3.5 text-muted-foreground" />
            </CardHeader>
            <CardContent className="p-3 pt-0">
              <div className="text-xl font-bold">₦0</div>
              <p className="text-[10px] text-muted-foreground">This month</p>
            </CardContent>
          </Card>
          <Card className="min-w-[120px] flex-shrink-0 md:min-w-0">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 p-3 pb-1">
              <CardTitle className="text-xs font-medium">Rating</CardTitle>
              <Star className="h-3.5 w-3.5 text-muted-foreground" />
            </CardHeader>
            <CardContent className="p-3 pt-0">
              <div className="text-xl font-bold">5.0</div>
              <p className="text-[10px] text-muted-foreground">Average</p>
            </CardContent>
          </Card>
        </div>

        {/* Main Content */}
        <div className="min-h-[50vh]">
          {renderContent()}
        </div>
      </div>

      {/* Mobile Bottom Navigation */}
      <BottomNav tabs={tabs} activeTab={activeTab} onTabChange={setActiveTab} />
    </DashboardLayout>
  );
}