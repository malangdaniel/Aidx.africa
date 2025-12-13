import { useState } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { MessageSquare, Calendar, Pill, Clock, Wallet, Bot, Video, Plus } from 'lucide-react';
import AIChatInterface from '@/components/patient/AIChatInterface';

import DoctorSearch from '@/components/patient/DoctorSearch';
import MedicationMarketplace from '@/components/patient/MedicationMarketplace';

export default function PatientDashboard() {
  const [activeTab, setActiveTab] = useState('ai-chat');
  const [preselectedSpecialty, setPreselectedSpecialty] = useState<string | undefined>(undefined);

  const tabs = [
    { id: 'ai-chat', label: 'AI Assistant', icon: Bot },
    { id: 'consultations', label: 'Consultations', icon: Video },
    { id: 'pharmacy', label: 'Pharmacy', icon: Pill },
    { id: 'timeline', label: 'Timeline', icon: Clock },
    { id: 'wallet', label: 'Wallet', icon: Wallet },
  ];

  return (
    <DashboardLayout title="Patient Dashboard">
      <div className="space-y-6">
        {/* Welcome Section */}
        <div className="bg-gradient-to-r from-primary to-secondary rounded-lg p-6 text-primary-foreground">
          <h1 className="text-2xl font-bold mb-2">Welcome back!</h1>
          <p className="opacity-90">How can I help you with your health today?</p>
        </div>

        {/* Quick Stats */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">AI Consultations</CardTitle>
              <MessageSquare className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">12</div>
              <p className="text-xs text-muted-foreground">This month</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Doctor Visits</CardTitle>
              <Calendar className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">3</div>
              <p className="text-xs text-muted-foreground">Completed</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Orders</CardTitle>
              <Pill className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">8</div>
              <p className="text-xs text-muted-foreground">Total orders</p>
            </CardContent>
          </Card>
        </div>

        {/* Main Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-5">
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

          <TabsContent value="ai-chat" className="space-y-4">
            <div className="max-w-4xl mx-auto">
              <AIChatInterface
                onBookConsult={(specialist) => {
                  setPreselectedSpecialty(specialist);
                  setActiveTab('consultations');
                }}
                onPharmacyRedirect={() => setActiveTab('pharmacy')}
              />
            </div>
          </TabsContent>

          <TabsContent value="consultations" className="space-y-4">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-2xl font-bold">Find a Doctor</h2>
            </div>
            <DoctorSearch initialSpecialty={preselectedSpecialty} />
          </TabsContent>

          import MedicationMarketplace from '@/components/patient/MedicationMarketplace';

          // ... (in the render function)

          <TabsContent value="pharmacy" className="space-y-4">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-2xl font-bold">Pharmacy</h2>
            </div>
            <MedicationMarketplace />
          </TabsContent>

          <TabsContent value="timeline" className="space-y-4">
            <h2 className="text-2xl font-bold">Health Timeline</h2>
            <Card>
              <CardContent className="p-6">
                <div className="text-center text-muted-foreground">
                  <Clock className="w-12 h-12 mx-auto mb-4" />
                  <h3 className="text-lg font-medium mb-2">Your Health Journey</h3>
                  <p>Track your AI consultations, doctor visits, and medication orders</p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="wallet" className="space-y-4">
            <h2 className="text-2xl font-bold">Wallet</h2>
            <div className="grid gap-4 md:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>Available Balance</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">₦0.00</div>
                  <Button className="mt-4" variant="outline">
                    <Plus className="w-4 h-4 mr-2" />
                    Add Funds
                  </Button>
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle>Escrow Balance</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">₦0.00</div>
                  <p className="text-sm text-muted-foreground">Funds held for pending orders</p>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}