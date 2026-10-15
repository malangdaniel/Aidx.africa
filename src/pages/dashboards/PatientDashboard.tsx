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
  const [pharmacySearchTerm, setPharmacySearchTerm] = useState('');

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

  const handleFindMedication = (medicationName: string) => {
    setPharmacySearchTerm(medicationName);
    setActiveTab('pharmacy');
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
            onPharmacyRedirect={handleFindMedication}
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
              onFindMedication={handleFindMedication}
              onFindDoctor={handleBookConsultWithSpecialty}
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
            <MedicationMarketplace initialSearchTerm={pharmacySearchTerm} />
          </div>
        );

      case 'profile':
        return <PatientProfile />;

      case 'wallet':
        return <WalletView balance={wallet.balance} escrow={wallet.escrow} onRefresh={fetchStats} />;

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
      <div className="space-y-6">
        {/* Welcome Banner */}
        <div className="relative overflow-hidden rounded-2xl bg-hero-gradient p-6 md:p-8 text-primary-foreground shadow-luxury border border-white/10">
          {/* Subtle ambient lighting circles */}
          <div className="absolute -top-12 -right-12 w-48 h-48 rounded-full bg-accent/20 blur-3xl pointer-events-none" />
          <div className="absolute -bottom-12 -left-12 w-48 h-48 rounded-full bg-secondary/20 blur-3xl pointer-events-none" />
          
          <div className="relative z-10 space-y-3">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 backdrop-blur-md text-[11px] font-medium border border-white/15">
              <Sparkles className="w-3 h-3 text-accent animate-pulse" />
              <span>Sanari AI Triage • Always Online</span>
            </div>
            
            <div className="space-y-1">
              <h1 className="text-xl md:text-2xl font-bold tracking-tight">Welcome back, {firstName}!</h1>
              <p className="text-sm text-primary-foreground/80 max-w-xl">
                Describe your symptoms to our AI diagnostic engine or connect with top healthcare specialists.
              </p>
            </div>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-2 gap-3.5 md:grid-cols-4">
          <Card
            className="group cursor-pointer hover:border-primary/40 hover:shadow-md transition-all duration-300 hover:-translate-y-0.5 bg-card/80 backdrop-blur-sm"
            onClick={() => setActiveTab('ai-history')}
          >
            <CardHeader className="flex flex-row items-center justify-between space-y-0 p-4 pb-2">
              <CardTitle className="text-xs font-semibold text-muted-foreground group-hover:text-foreground transition-colors">AI Consultations</CardTitle>
              <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center group-hover:bg-primary group-hover:text-primary-foreground transition-all duration-200">
                <MessageSquare className="h-4 w-4 text-primary group-hover:text-primary-foreground" />
              </div>
            </CardHeader>
            <CardContent className="p-4 pt-0">
              <div className="text-2xl font-bold text-foreground">{stats.aiChats}</div>
              <p className="text-[11px] text-muted-foreground mt-0.5">View chat history →</p>
            </CardContent>
          </Card>

          <Card
            className="group cursor-pointer hover:border-primary/40 hover:shadow-md transition-all duration-300 hover:-translate-y-0.5 bg-card/80 backdrop-blur-sm"
            onClick={() => setActiveTab('consultations-list')}
          >
            <CardHeader className="flex flex-row items-center justify-between space-y-0 p-4 pb-2">
              <CardTitle className="text-xs font-semibold text-muted-foreground group-hover:text-foreground transition-colors">Doctor Appointments</CardTitle>
              <div className="w-8 h-8 rounded-xl bg-emerald-500/10 flex items-center justify-center group-hover:bg-emerald-500 group-hover:text-white transition-all duration-200">
                <Calendar className="h-4 w-4 text-emerald-600 dark:text-emerald-400 group-hover:text-white" />
              </div>
            </CardHeader>
            <CardContent className="p-4 pt-0">
              <div className="text-2xl font-bold text-foreground">{stats.consultations}</div>
              <p className="text-[11px] text-muted-foreground mt-0.5">Manage visits →</p>
            </CardContent>
          </Card>

          <Card
            className="group cursor-pointer hover:border-primary/40 hover:shadow-md transition-all duration-300 hover:-translate-y-0.5 bg-card/80 backdrop-blur-sm"
            onClick={() => setActiveTab('orders-list')}
          >
            <CardHeader className="flex flex-row items-center justify-between space-y-0 p-4 pb-2">
              <CardTitle className="text-xs font-semibold text-muted-foreground group-hover:text-foreground transition-colors">Pharmacy Orders</CardTitle>
              <div className="w-8 h-8 rounded-xl bg-accent/10 flex items-center justify-center group-hover:bg-accent group-hover:text-white transition-all duration-200">
                <Pill className="h-4 w-4 text-accent group-hover:text-white" />
              </div>
            </CardHeader>
            <CardContent className="p-4 pt-0">
              <div className="text-2xl font-bold text-foreground">{stats.orders}</div>
              <p className="text-[11px] text-muted-foreground mt-0.5">Track prescriptions →</p>
            </CardContent>
          </Card>

          <Card
            className="group cursor-pointer hover:border-primary/40 hover:shadow-md transition-all duration-300 hover:-translate-y-0.5 bg-card/80 backdrop-blur-sm"
            onClick={() => setActiveTab('vitals')}
          >
            <CardHeader className="flex flex-row items-center justify-between space-y-0 p-4 pb-2">
              <CardTitle className="text-xs font-semibold text-muted-foreground group-hover:text-foreground transition-colors">Health Vitals</CardTitle>
              <div className="w-8 h-8 rounded-xl bg-rose-500/10 flex items-center justify-center group-hover:bg-rose-500 group-hover:text-white transition-all duration-200">
                <Activity className="h-4 w-4 text-rose-500 group-hover:text-white" />
              </div>
            </CardHeader>
            <CardContent className="p-4 pt-0">
              <div className="text-2xl font-bold text-foreground">Track</div>
              <p className="text-[11px] text-muted-foreground mt-0.5">Monitor blood pressure & stats →</p>
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
