import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import DashboardLayout from '@/components/layout/DashboardLayout';
import BottomNav from '@/components/layout/BottomNav';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { MessageSquare, Calendar, Pill, Wallet, Bot, Video, Activity, Sparkles } from 'lucide-react';
import AIChatInterface from '@/components/patient/AIChatInterface';
import ClinicalAssessmentDashboard from '@/components/patient/ClinicalAssessmentDashboard';
import DoctorSearch from '@/components/patient/DoctorSearch';
import MedicationMarketplace from '@/components/patient/MedicationMarketplace';
import PatientProfile from '@/components/patient/PatientProfile';
import WalletView from '@/components/patient/WalletView';
import ConsultationsList from '@/components/patient/ConsultationsList';
import OrderList from '@/components/patient/OrderList';
import AiChatHistory from '@/components/patient/AiChatHistory';
import ConsultationRoom from '@/components/patient/ConsultationRoom';
import HealthTracker from '@/components/patient/HealthTracker';
import { ClinicalAssessmentData } from '@/types/clinicalAssessment';

export default function PatientDashboard() {
  const { profile, user } = useAuth();
  const firstName = profile?.first_name || 'Patient';
  const [activeTab, setActiveTab] = useState('ai-chat');
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [currentAssessment, setCurrentAssessment] = useState<ClinicalAssessmentData | null>(null);
  const [activeConsultation, setActiveConsultation] = useState<any | null>(null);
  const [preselectedSpecialty, setPreselectedSpecialty] = useState<string | undefined>(undefined);

  const [stats, setStats] = useState({ aiChats: 0, consultations: 0, orders: 0 });
  const [wallet, setWallet] = useState({ balance: 0, escrow: 0 });

  useEffect(() => {
    if (user) fetchStats();
  }, [user]);

  const fetchStats = async () => {
    if (!user) return;
    try {
      const [chatsRes, consultsRes, ordersRes, walletRes] = await Promise.all([
        supabase.from('ai_chats').select('session_id').eq('user_id', user.id),
        supabase.from('consultations').select('id').eq('patient_id', user.id),
        supabase.from('orders').select('id').eq('user_id', user.id),
        supabase.from('wallets').select('balance, escrow_balance').eq('user_id', user.id).maybeSingle(),
      ]);

      const uniqueSessions = new Set((chatsRes.data || []).map(chat => chat.session_id)).size;

      setStats({
        aiChats: uniqueSessions,
        consultations: consultsRes.data?.length || 0,
        orders: ordersRes.data?.length || 0,
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
    { id: 'ai-chat', label: 'AI Triage', icon: Bot },
    { id: 'consultations', label: 'Doctors', icon: Video },
    { id: 'vitals', label: 'Vitals', icon: Activity },
    { id: 'pharmacy', label: 'Pharmacy', icon: Pill },
  ];

  const handleBookConsultWithSpecialty = (specialty: string) => {
    setPreselectedSpecialty(specialty);
    setActiveTab('consultations');
  };

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
            onViewAssessment={(assessmentData) => {
              setCurrentAssessment(assessmentData);
              setActiveTab('assessment-dashboard');
            }}
            onBookConsult={handleBookConsultWithSpecialty}
            onPharmacyRedirect={() => setActiveTab('pharmacy')}
          />
        );

      case 'assessment-dashboard':
        return currentAssessment ? (
          <ClinicalAssessmentDashboard
            assessment={currentAssessment}
            onBookConsult={handleBookConsultWithSpecialty}
            onPharmacyRedirect={() => setActiveTab('pharmacy')}
            onReopenChat={() => setActiveTab('ai-chat')}
          />
        ) : (
          <div className="text-center py-12 space-y-3">
            <Sparkles className="w-10 h-10 text-primary mx-auto opacity-50" />
            <p className="text-sm text-muted-foreground">No active assessment available. Please complete an AI consultation first.</p>
            <Button onClick={() => setActiveTab('ai-chat')}>Start AI Consultation</Button>
          </div>
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
                setCurrentAssessment(null);
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

      case 'profile':
        return <PatientProfile />;

      case 'wallet':
        return <WalletView balance={wallet.balance} escrow={wallet.escrow} />;

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
      headerActions={
        <div className="flex items-center gap-2">
          {currentAssessment && activeTab !== 'assessment-dashboard' && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setActiveTab('assessment-dashboard')}
              className="h-9 gap-1.5 text-xs border-primary/40 text-primary hover:bg-primary/5"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>View Assessment</span>
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setActiveTab('wallet')}
            className={cn(
              "h-9 px-2 gap-2 text-muted-foreground hover:text-primary transition-colors",
              activeTab === 'wallet' && "text-primary bg-primary/5"
            )}
          >
            <Wallet className="w-5 h-5" />
            <span className="hidden sm:inline font-bold text-xs">
              ₦{wallet.balance.toLocaleString('en-NG', { maximumFractionDigits: 0 })}
            </span>
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        {/* Welcome Section */}
        <div className="bg-gradient-to-r from-primary to-secondary rounded-xl p-4 text-primary-foreground">
          <h1 className="text-lg font-bold">Hi, {firstName}!</h1>
          <p className="text-sm opacity-90">How can I help you today?</p>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Card
            className="cursor-pointer hover:border-primary/50 transition-colors"
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
            className="cursor-pointer hover:border-primary/50 transition-colors"
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
            className="cursor-pointer hover:border-primary/50 transition-colors"
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

          <Card
            className="cursor-pointer hover:border-primary/50 transition-colors"
            onClick={() => setActiveTab('vitals')}
          >
            <CardHeader className="flex flex-row items-center justify-between space-y-0 p-3 pb-1">
              <CardTitle className="text-xs font-medium">Vitals</CardTitle>
              <Activity className="h-3.5 w-3.5 text-rose-500" />
            </CardHeader>
            <CardContent className="p-3 pt-0">
              <div className="text-xl font-bold text-primary">Track</div>
              <p className="text-[10px] text-muted-foreground">Health stats</p>
            </CardContent>
          </Card>
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
