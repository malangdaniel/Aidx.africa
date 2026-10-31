import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import DashboardLayout from '@/components/layout/DashboardLayout';
import BottomNav from '@/components/layout/BottomNav';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
    BarChart3,
    Users,
    ShieldCheck,
    Calendar,
    ShoppingCart,
    DollarSign,
    Brain,
    Headphones,
    ClipboardList,
    Sliders,
    ShieldAlert,
    Home,
    Wallet,
    Building2
} from 'lucide-react';
import { Link } from 'react-router-dom';

// Admin Tab Components
import AdminOverviewTab from '@/components/admin/AdminOverviewTab';
import AdminVerificationTab from '@/components/admin/AdminVerificationTab';
import AdminPharmaciesTab from '@/components/admin/AdminPharmaciesTab';
import { supabase } from '@/integrations/supabase/client';
import AdminUsersTab from '@/components/admin/AdminUsersTab';
import AdminConsultationsTab from '@/components/admin/AdminConsultationsTab';
import AdminOrdersTab from '@/components/admin/AdminOrdersTab';
import AdminWithdrawalsTab from '@/components/admin/AdminWithdrawalsTab';
import AdminAiSafetyTab from '@/components/admin/AdminAiSafetyTab';
import AdminSupportTab from '@/components/admin/AdminSupportTab';
import AdminAuditLogTab from '@/components/admin/AdminAuditLogTab';
import AdminSettingsTab from '@/components/admin/AdminSettingsTab';
import AdminWalletTab from '@/components/admin/AdminWalletTab';

export default function AdminDashboard() {
    const { user, profile, loading: authLoading } = useAuth();
    const [activeTab, setActiveTab] = useState<string>('overview');
    const [pharmacyQueue, setPharmacyQueue] = useState(0);

    useEffect(() => {
        if (profile?.role !== 'admin') return;
        supabase
            .rpc('admin_list_pharmacy_applications', { p_status: 'awaiting_review', p_limit: 200, p_offset: 0 })
            .then(({ data }) => setPharmacyQueue(Array.isArray(data) ? data.length : 0));
    }, [profile?.role, activeTab]);

    // 1. Role / Access Guard
    if (authLoading) {
        return (
            <div className="flex h-screen items-center justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
            </div>
        );
    }

    if (!profile || profile.role !== 'admin') {
        return (
            <div className="min-h-screen flex items-center justify-center p-4 bg-background">
                <Card className="max-w-md w-full border-destructive/20 shadow-lg">
                    <CardContent className="flex flex-col items-center justify-center p-8 text-center space-y-4">
                        <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center text-destructive">
                            <ShieldAlert className="w-8 h-8" />
                        </div>
                        <h2 className="text-xl font-bold text-foreground">Access Denied</h2>
                        <p className="text-xs text-muted-foreground leading-relaxed">
                            You do not possess the required administrator privileges to view or manage the central AiDx command center.
                        </p>
                        <Link to="/">
                            <Button variant="default" className="gap-2">
                                <Home className="w-4 h-4" />
                                Return Home
                            </Button>
                        </Link>
                    </CardContent>
                </Card>
            </div>
        );
    }

    const tabs = [
        { id: 'overview', label: 'Overview', icon: BarChart3 },
        { id: 'pharmacies', label: 'Pharmacies', icon: Building2 },
        { id: 'verification', label: 'Verification', icon: ShieldCheck },
        { id: 'users', label: 'Users', icon: Users },
        { id: 'consultations', label: 'Consults', icon: Calendar },
        { id: 'orders', label: 'Orders', icon: ShoppingCart },
        { id: 'withdrawals', label: 'Withdrawals', icon: DollarSign },
        { id: 'ai_safety', label: 'AI Safety', icon: Brain },
        { id: 'support', label: 'Support', icon: Headphones },
        { id: 'audit_log', label: 'Audit Log', icon: ClipboardList },
        { id: 'wallet', label: 'Wallet', icon: Wallet },
        { id: 'settings', label: 'Settings', icon: Sliders },
    ];

    const renderTabContent = () => {
        switch (activeTab) {
            case 'overview':
                return <AdminOverviewTab />;
            case 'pharmacies':
                return <AdminPharmaciesTab />;
            case 'verification':
                return <AdminVerificationTab />;
            case 'users':
                return <AdminUsersTab />;
            case 'consultations':
                return <AdminConsultationsTab />;
            case 'orders':
                return <AdminOrdersTab />;
            case 'withdrawals':
                return <AdminWithdrawalsTab />;
            case 'ai_safety':
                return <AdminAiSafetyTab />;
            case 'support':
                return <AdminSupportTab />;
            case 'audit_log':
                return <AdminAuditLogTab />;
            case 'wallet':
                return <AdminWalletTab />;
            case 'settings':
                return <AdminSettingsTab />;
            default:
                return <AdminOverviewTab />;
        }
    };

    return (
        <DashboardLayout
            title="Administrator Portal"
        >
            <div className="space-y-6 pb-20 md:pb-8">
                {/* Desktop & Tablet Navigation Bar */}
                <div className="flex items-center gap-1.5 overflow-x-auto pb-2 border-b scrollbar-hide">
                    {tabs.map((tab) => {
                        const Icon = tab.icon;
                        const isActive = activeTab === tab.id;
                        return (
                            <Button
                                key={tab.id}
                                variant={isActive ? 'default' : 'ghost'}
                                size="sm"
                                onClick={() => setActiveTab(tab.id)}
                                className={`text-xs gap-1.5 shrink-0 h-8 rounded-lg ${isActive ? '' : 'text-muted-foreground hover:text-foreground'
                                    }`}
                            >
                                <Icon className="w-3.5 h-3.5" />
                                {tab.label}
                                {tab.id === 'pharmacies' && pharmacyQueue > 0 && (
                                    <span className="ml-1 rounded-full bg-destructive px-1.5 text-[10px] font-bold text-destructive-foreground">
                                        {pharmacyQueue}
                                    </span>
                                )}
                            </Button>
                        );
                    })}
                </div>

                {/* Main View Area */}
                <div className="min-h-[60vh] animate-in fade-in duration-300">
                    {renderTabContent()}
                </div>
            </div>

            {/* Mobile Bottom Navigation */}
            <BottomNav
                tabs={tabs.slice(0, 5)}
                activeTab={activeTab}
                onTabChange={setActiveTab}
            />
        </DashboardLayout>
    );
}