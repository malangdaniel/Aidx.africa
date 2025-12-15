import { useState } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Stethoscope, DollarSign, Calendar, Star, Users, TrendingUp } from 'lucide-react';
import ConsultationView from '@/components/doctor/ConsultationView';
import PatientList from '@/components/doctor/PatientList';
import PatientDetail from '@/components/doctor/PatientDetail';

export default function DoctorDashboard() {
  const [activeTab, setActiveTab] = useState('consultations');
  const [activeConsultation, setActiveConsultation] = useState<{ id: string, name: string } | null>(null);
  const [activePatient, setActivePatient] = useState<{ id: string } | null>(null);

  if (activeConsultation) {
    return (
      <div className="container mx-auto p-4 min-h-screen">
        <div className="mb-4">
          <Button variant="ghost" onClick={() => setActiveConsultation(null)}>← Back to Dashboard</Button>
        </div>
        <ConsultationView
          consultationId={activeConsultation.id}
          patientName={activeConsultation.name}
          onEndConsultation={() => setActiveConsultation(null)}
        />
      </div>
    );
  }

  if (activePatient) {
    return (
      <div className="container mx-auto p-4 min-h-screen">
        <PatientDetail
          patientId={activePatient.id}
          onBack={() => setActivePatient(null)}
        />
      </div>
    );
  }

  const tabs = [
    { id: 'consultations', label: 'Consultations', icon: Calendar },
    { id: 'patients', label: 'Patients', icon: Users },
    { id: 'earnings', label: 'Earnings', icon: DollarSign },
    { id: 'reviews', label: 'Reviews', icon: Star },
  ];

  return (
    <DashboardLayout title="Doctor Dashboard">
      <div className="space-y-6">
        {/* Welcome Section */}
        <div className="bg-gradient-to-r from-primary to-secondary rounded-lg p-6 text-primary-foreground">
          <h1 className="text-2xl font-bold mb-2">Welcome, Dr. User!</h1>
          <p className="opacity-90">Ready to help patients today?</p>
        </div>

        {/* Quick Stats */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Consultations</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">12</div>
              <p className="text-xs text-muted-foreground">All time</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">This Month</CardTitle>
              <Calendar className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">3</div>
              <p className="text-xs text-muted-foreground">Consultations</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Earnings</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">₦0.00</div>
              <p className="text-xs text-muted-foreground">This month</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Rating</CardTitle>
              <Star className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">5.0</div>
              <p className="text-xs text-muted-foreground">Average rating</p>
            </CardContent>
          </Card>
        </div>

        {/* Main Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <TabsTrigger key={tab.id} value={tab.id} className="flex items-center gap-2">
                  <Icon className="w-4 h-4" />
                  <span className="hidden sm:inline">{tab.label}</span>
                </TabsTrigger>
              );
            })}
          </TabsList>

          <TabsContent value="consultations" className="space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="text-2xl font-bold">Consultations</h2>
              <div className="flex gap-2">
                <Badge variant="secondary">Scheduled: 1</Badge>
                <Badge variant="default">Ongoing: 0</Badge>
                <Badge variant="outline">Completed: 12</Badge>
              </div>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Upcoming Appointments</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 border rounded-lg bg-card hover:bg-muted/50 transition-colors">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">
                        JD
                      </div>
                      <div>
                        <h4 className="font-semibold">John Doe</h4>
                        <p className="text-sm text-muted-foreground">General Checkup • 2:00 PM Today</p>
                      </div>
                    </div>
                    <Button onClick={() => setActiveConsultation({ id: '1', name: 'John Doe' })}>Start Data Review</Button>
                  </div>

                  <div className="flex items-center justify-between p-4 border rounded-lg opacity-60">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center font-bold">
                        AS
                      </div>
                      <div>
                        <h4 className="font-semibold">Amara Smith</h4>
                        <p className="text-sm text-muted-foreground">Follow-up • 4:00 PM Today</p>
                      </div>
                    </div>
                    <Button variant="outline" disabled>Upcoming</Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="grid gap-4 md:grid-cols-4">
              <Card className="border-blue-200 bg-blue-50">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm text-blue-800">Scheduled</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-blue-900">0</div>
                </CardContent>
              </Card>
              <Card className="border-yellow-200 bg-yellow-50">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm text-yellow-800">Ongoing</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-yellow-900">0</div>
                </CardContent>
              </Card>
              <Card className="border-green-200 bg-green-50">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm text-green-800">Completed</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-green-900">0</div>
                </CardContent>
              </Card>
              <Card className="border-red-200 bg-red-50">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm text-red-800">Cancelled</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-red-900">0</div>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardContent className="p-6">
                <div className="text-center text-muted-foreground">
                  <Stethoscope className="w-12 h-12 mx-auto mb-4" />
                  <h3 className="text-lg font-medium mb-2">No Consultations Yet</h3>
                  <p>Patients will be able to book consultations with you once you complete your profile</p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="patients" className="space-y-4">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-2xl font-bold">My Patients</h2>
            </div>
            <PatientList onSelectPatient={(id) => setActivePatient({ id })} />
          </TabsContent>

          <TabsContent value="earnings" className="space-y-4">
            <h2 className="text-2xl font-bold">Earnings Dashboard</h2>
            <div className="grid gap-4 md:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <DollarSign className="w-5 h-5" />
                    Total Earnings
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">₦0.00</div>
                  <p className="text-sm text-muted-foreground">All time earnings</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <TrendingUp className="w-5 h-5" />
                    Pending Payouts
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">₦0.00</div>
                  <p className="text-sm text-muted-foreground">Awaiting admin approval</p>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="reviews" className="space-y-4">
            <h2 className="text-2xl font-bold">Patient Reviews</h2>
            <Card>
              <CardContent className="p-6">
                <div className="text-center text-muted-foreground">
                  <Star className="w-12 h-12 mx-auto mb-4" />
                  <h3 className="text-lg font-medium mb-2">No Reviews Yet</h3>
                  <p>Complete your first consultations to start receiving patient reviews</p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}