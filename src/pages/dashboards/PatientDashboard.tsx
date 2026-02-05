import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import DashboardLayout from '@/components/layout/DashboardLayout';
import BottomNav from '@/components/layout/BottomNav';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { MessageSquare, Calendar, Pill, Wallet, Bot, Video, Plus, FileText, Activity } from 'lucide-react';
import AIChatInterface from '@/components/patient/AIChatInterface';
import DoctorSearch from '@/components/patient/DoctorSearch';
import MedicationMarketplace from '@/components/patient/MedicationMarketplace';
import HealthTracker from '@/components/patient/HealthTracker';
import MedicalHistoryView from '@/components/patient/medical-history/MedicalHistoryView';

export default function PatientDashboard() {
  const { profile } = useAuth();
  const firstName = profile?.first_name || 'Patient';
  const [activeTab, setActiveTab] = useState('ai-chat');
  const [preselectedSpecialty, setPreselectedSpecialty] = useState<string | undefined>(undefined);

  const tabs = [
    { id: 'ai-chat', label: 'AI Chat', icon: Bot },
    { id: 'consultations', label: 'Doctors', icon: Video },
    { id: 'pharmacy', label: 'Pharmacy', icon: Pill },
    { id: 'history', label: 'History', icon: FileText },
    { id: 'wallet', label: 'Wallet', icon: Wallet },
  ];

  const renderContent = () => {
    switch (activeTab) {
      case 'ai-chat':
        return (
          <AIChatInterface
            onBookConsult={(specialist) => {
              setPreselectedSpecialty(specialist);
              setActiveTab('consultations');
            }}
            onPharmacyRedirect={() => setActiveTab('pharmacy')}
          />
        );
      case 'consultations':
        return (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold">Find a Doctor</h2>
            <DoctorSearch initialSpecialty={preselectedSpecialty} />
          </div>
        );
      case 'pharmacy':
        return (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold">Pharmacy</h2>
            <MedicationMarketplace />
          </div>
        );
      case 'history':
        return (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold">Medical History</h2>
            <MedicalHistoryView />
          </div>
        );
      case 'wallet':
        return (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold">Wallet</h2>
            <div className="grid gap-3">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Available Balance</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">₦0.00</div>
                  <Button className="mt-3 w-full" size="sm">
                    <Plus className="w-4 h-4 mr-2" />
                    Add Funds
                  </Button>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Escrow Balance</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">₦0.00</div>
                  <p className="text-xs text-muted-foreground mt-1">Funds held for pending orders</p>
                </CardContent>
              </Card>
            </div>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <DashboardLayout title="Patient Dashboard">
      <div className="space-y-4">
        {/* Welcome Section - Compact for mobile */}
        <div className="bg-gradient-to-r from-primary to-secondary rounded-xl p-4 text-primary-foreground">
          <h1 className="text-lg font-bold">Hi, {firstName}!</h1>
          <p className="text-sm opacity-90">How can I help you today?</p>
        </div>

        {/* Quick Stats - Horizontal scroll on mobile */}
        <div className="flex gap-3 overflow-x-auto pb-2 -mx-4 px-4 md:grid md:grid-cols-3 md:overflow-visible md:mx-0 md:px-0">
          <Card className="min-w-[140px] flex-shrink-0 md:min-w-0">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 p-3 pb-1">
              <CardTitle className="text-xs font-medium">AI Chats</CardTitle>
              <MessageSquare className="h-3.5 w-3.5 text-muted-foreground" />
            </CardHeader>
            <CardContent className="p-3 pt-0">
              <div className="text-xl font-bold">12</div>
              <p className="text-[10px] text-muted-foreground">This month</p>
            </CardContent>
          </Card>
          <Card className="min-w-[140px] flex-shrink-0 md:min-w-0">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 p-3 pb-1">
              <CardTitle className="text-xs font-medium">Doctor Visits</CardTitle>
              <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
            </CardHeader>
            <CardContent className="p-3 pt-0">
              <div className="text-xl font-bold">3</div>
              <p className="text-[10px] text-muted-foreground">Completed</p>
            </CardContent>
          </Card>
          <Card className="min-w-[140px] flex-shrink-0 md:min-w-0">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 p-3 pb-1">
              <CardTitle className="text-xs font-medium">Orders</CardTitle>
              <Pill className="h-3.5 w-3.5 text-muted-foreground" />
            </CardHeader>
            <CardContent className="p-3 pt-0">
              <div className="text-xl font-bold">8</div>
              <p className="text-[10px] text-muted-foreground">Total orders</p>
            </CardContent>
          </Card>
        </div>

        {/* Health Tracker - Hidden on mobile home, visible on desktop */}
        <div className="hidden md:block">
          <HealthTracker />
        </div>

        {/* Main Content Area */}
        <div className="min-h-[60vh]">
          {renderContent()}
        </div>
      </div>

      {/* Mobile Bottom Navigation */}
      <BottomNav tabs={tabs} activeTab={activeTab} onTabChange={setActiveTab} />
    </DashboardLayout>
  );
}