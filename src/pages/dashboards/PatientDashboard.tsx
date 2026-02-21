import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
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
import ConsultationsList from '@/components/patient/ConsultationsList';
import OrderList from '@/components/patient/OrderList';
import AiChatHistory from '@/components/patient/AiChatHistory';
import ConsultationRoom from '@/components/patient/ConsultationRoom';

export default function PatientDashboard() {
  const { profile, user } = useAuth();
  const firstName = profile?.first_name || 'Patient';
  const [activeTab, setActiveTab] = useState('ai-chat');
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [activeConsultation, setActiveConsultation] = useState<any | null>(null);
  const [preselectedSpecialty, setPreselectedSpecialty] = useState<string | undefined>(undefined);

  // Real stats from backend
  const [stats, setStats] = useState({ aiChats: 0, consultations: 0, orders: 0 });
  const [wallet, setWallet] = useState({ balance: 0, escrow: 0 });

  useEffect(() => {
    if (user) fetchStats();
  }, [user]);

  const fetchStats = async () => {
    if (!user) return;
    try {
      const [chatsRes, consultsRes, ordersRes, walletRes] = await Promise.all([
        supabase.from('ai_chats').select('id', { count: 'exact', head: true }).eq('user_id', user.id),
        supabase.from('consultations').select('id', { count: 'exact', head: true }).eq('patient_id', user.id),
        supabase.from('orders').select('id', { count: 'exact', head: true }).eq('user_id', user.id),
        supabase.from('wallets').select('balance, escrow_balance').eq('user_id', user.id).maybeSingle(),
      ]);

      setStats({
        aiChats: chatsRes.count || 0,
        consultations: consultsRes.count || 0,
        orders: ordersRes.count || 0,
      });

      if (walletRes.data) {
        setWallet({
          balance: walletRes.data.balance || 0,
          escrow: walletRes.data.escrow_balance || 0,
        });
      }
    } catch (error) {
      console.error('Error fetching patient stats:', error);
    }
  };

  const tabs = [
    { id: 'ai-chat', label: 'AI Chat', icon: Bot },
    { id: 'consultations', label: 'Doctors', icon: Video },
    { id: 'vitals', label: 'Vitals', icon: Activity },
    { id: 'pharmacy', label: 'Pharmacy', icon: Pill },
    { id: 'history', label: 'History', icon: FileText },
    { id: 'wallet', label: 'Wallet', icon: Wallet },
  ];

  const renderContent = () => {
    switch (activeTab) {
      case 'ai-chat':
        return (
          <AIChatInterface
            sessionId={selectedSessionId}
            onBack={() => {
              setSelectedSessionId(null);
              setActiveTab('ai-history');
            }}
            onBookConsult={(specialist) => {
              setPreselectedSpecialty(specialist);
              setActiveTab('consultations');
            }}
            onPharmacyRedirect={() => setActiveTab('pharmacy')}
          />
        );
      case 'ai-history':
        return (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold">AI Assistant History</h2>
            <AiChatHistory
              onSelectSession={(id) => {
                setSelectedSessionId(id);
                setActiveTab('ai-chat');
              }}
              onNewChat={() => {
                setSelectedSessionId(null);
                setActiveTab('ai-chat');
              }}
            />
          </div>
        );
      case 'consultations':
        return (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold">Find a Doctor</h2>
            <DoctorSearch initialSpecialty={preselectedSpecialty} />
          </div>
        );
      case 'consultations-list':
        return (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold">Your Consultations</h2>
            <ConsultationsList onJoinCall={(c) => {
              setActiveConsultation(c);
              setActiveTab('video-consultation');
            }} />
          </div>
        );
      case 'video-consultation':
        return activeConsultation ? (
          <ConsultationRoom
            consultation={activeConsultation}
            onEnd={() => {
              setActiveConsultation(null);
              setActiveTab('consultations-list');
            }}
            onPharmacyRedirect={() => setActiveTab('pharmacy')}
          />
        ) : null;
      case 'orders-list':
        return (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold">Order History</h2>
            <OrderList />
          </div>
        );
      case 'vitals':
        return <HealthTracker />;
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
                  <div className="text-2xl font-bold">₦{wallet.balance.toLocaleString('en-NG', { minimumFractionDigits: 2 })}</div>
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
                  <div className="text-2xl font-bold">₦{wallet.escrow.toLocaleString('en-NG', { minimumFractionDigits: 2 })}</div>
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
    <DashboardLayout
      title="Patient Dashboard"
      tabs={tabs}
      activeTab={activeTab}
      onTabChange={setActiveTab}
    >
      <div className="space-y-4">
        {/* Welcome Section */}
        <div className="bg-gradient-to-r from-primary to-secondary rounded-xl p-4 text-primary-foreground">
          <h1 className="text-lg font-bold">Hi, {firstName}!</h1>
          <p className="text-sm opacity-90">How can I help you today?</p>
        </div>

        {/* Quick Stats */}
        <div className="flex gap-3 overflow-x-auto pb-2 -mx-4 px-4 md:grid md:grid-cols-3 md:overflow-visible md:mx-0 md:px-0">
          <Card
            className="min-w-[140px] flex-shrink-0 md:min-w-0 cursor-pointer hover:border-primary/50 transition-colors"
            onClick={() => setActiveTab('ai-history')}
          >
            <CardHeader className="flex flex-row items-center justify-between space-y-0 p-3 pb-1">
              <CardTitle className="text-xs font-medium">AI Chats</CardTitle>
              <MessageSquare className="h-3.5 w-3.5 text-muted-foreground" />
            </CardHeader>
            <CardContent className="p-3 pt-0">
              <div className="text-xl font-bold text-primary">{stats.aiChats}</div>
              <p className="text-[10px] text-muted-foreground">See history</p>
            </CardContent>
          </Card>
          <Card
            className="min-w-[140px] flex-shrink-0 md:min-w-0 cursor-pointer hover:border-primary/50 transition-colors"
            onClick={() => setActiveTab('consultations-list')}
          >
            <CardHeader className="flex flex-row items-center justify-between space-y-0 p-3 pb-1">
              <CardTitle className="text-xs font-medium">Consults</CardTitle>
              <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
            </CardHeader>
            <CardContent className="p-3 pt-0">
              <div className="text-xl font-bold text-primary">{stats.consultations}</div>
              <p className="text-[10px] text-muted-foreground">Recent visits</p>
            </CardContent>
          </Card>
          <Card
            className="min-w-[140px] flex-shrink-0 md:min-w-0 cursor-pointer hover:border-primary/50 transition-colors"
            onClick={() => setActiveTab('orders-list')}
          >
            <CardHeader className="flex flex-row items-center justify-between space-y-0 p-3 pb-1">
              <CardTitle className="text-xs font-medium">Orders</CardTitle>
              <Pill className="h-3.5 w-3.5 text-muted-foreground" />
            </CardHeader>
            <CardContent className="p-3 pt-0">
              <div className="text-xl font-bold text-primary">{stats.orders}</div>
              <p className="text-[10px] text-muted-foreground">Track drugs</p>
            </CardContent>
          </Card>
        </div>

        {/* Health Tracker - Hidden on mobile home */}
        <div className="hidden md:block">
          <HealthTracker />
        </div>

        {/* Main Content Area */}
        <div className="min-h-[60vh]">
          {renderContent()}
        </div>
      </div>

      <BottomNav tabs={tabs} activeTab={activeTab} onTabChange={setActiveTab} />
    </DashboardLayout>
  );
}