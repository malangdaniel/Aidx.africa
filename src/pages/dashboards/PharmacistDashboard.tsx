import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ShoppingCart, Package, AlertTriangle, TrendingUp, Star, Wallet, Building2, Loader2 } from 'lucide-react';
import OrderManagement from '@/components/pharmacist/OrderManagement';
import InventoryManagement from '@/components/pharmacist/InventoryManagement';
import BottomNav from '@/components/layout/BottomNav';
import WithdrawalScreen from '@/components/shared/WithdrawalScreen';
import { PharmacyOnboardingService, type ApplicationStatus } from '@/services/PharmacyOnboardingService';
import PharmacyOnboardingWizard from '@/components/pharmacist/onboarding/PharmacyOnboardingWizard';
import PharmacyProfileSettings from '@/components/pharmacist/onboarding/PharmacyProfileSettings';
import { UnderReviewScreen, SuspendedScreen } from '@/components/pharmacist/onboarding/PharmacyStatusScreens';

export default function PharmacistDashboard() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('orders');
  const [stats, setStats] = useState({ activeOrders: 0, revenue: 0, lowStock: 0 });
  const [appStatus, setAppStatus] = useState<ApplicationStatus | null>(null);

  const loadStatus = async () => {
    try {
      setAppStatus(await PharmacyOnboardingService.getStatus());
    } catch (error) {
      console.error('Error loading pharmacy application status:', error);
      // Fail closed: treat as not approved so the gate screens (not the dashboard) are shown.
      setAppStatus({ has_pharmacy: true, verification_status: 'pending', profile_status: 'draft' });
    }
  };

  useEffect(() => {
    if (user) loadStatus();
  }, [user]);

  const approved = appStatus?.verification_status === 'verified' && !appStatus.is_suspended;

  useEffect(() => {
    if (user && approved) fetchStats();
  }, [user, approved]);

  const fetchStats = async () => {
    if (!user) return;
    try {
      const { data: pharmacy } = await supabase
        .from('pharmacies')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle();

      if (!pharmacy) return;

      const [activeRes, revenueRes, lowStockRes] = await Promise.all([
        supabase.from('child_orders')
          .select('id', { count: 'exact', head: true })
          .eq('pharmacy_id', pharmacy.id)
          .in('status', ['pending', 'paid', 'processing', 'out_for_delivery']),
        supabase.from('child_orders')
          .select('total_amount')
          .eq('pharmacy_id', pharmacy.id)
          .eq('status', 'delivered'),
        supabase.from('drugs')
          .select('id', { count: 'exact', head: true })
          .eq('pharmacy_id', pharmacy.id)
          .lt('stock_quantity', 10),
      ]);

      setStats({
        activeOrders: activeRes.count || 0,
        revenue: (revenueRes.data || []).reduce((sum, o) => sum + (o.total_amount || 0), 0),
        lowStock: lowStockRes.count || 0,
      });
    } catch (error) {
      console.error('Error fetching pharmacy stats:', error);
    }
  };

  const tabs = [
    { id: 'orders', label: 'Orders', icon: ShoppingCart },
    { id: 'inventory', label: 'Stocks', icon: Package },
    { id: 'alerts', label: 'Alerts', icon: AlertTriangle },
    { id: 'analytics', label: 'Stats', icon: TrendingUp },
    { id: 'reviews', label: 'Reviews', icon: Star },
    { id: 'withdrawal', label: 'Withdraw', icon: Wallet },
    { id: 'profile', label: 'Profile', icon: Building2 },
  ];

  const formatRevenue = (amount: number) => {
    if (amount >= 1000000) return `₦${(amount / 1000000).toFixed(1)}M`;
    if (amount >= 1000) return `₦${(amount / 1000).toFixed(0)}k`;
    return `₦${amount}`;
  };

  const renderContent = () => {
    switch (activeTab) {
      case 'orders':
        return (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold">Order Management</h2>
            <OrderManagement />
          </div>
        );
      case 'inventory':
        return <InventoryManagement />;
      case 'alerts':
        return (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold">Alerts</h2>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2 text-destructive">
                  <AlertTriangle className="w-4 h-4" />
                  Low Stock Items
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.lowStock}</div>
                <p className="text-xs text-muted-foreground">Products need restocking</p>
              </CardContent>
            </Card>
          </div>
        );
      case 'analytics':
        return (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold">Analytics</h2>
            <div className="grid gap-3 md:grid-cols-2">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Total Revenue</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">₦{stats.revenue.toLocaleString()}</div>
                  <p className="text-xs text-muted-foreground">From delivered orders</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Active Orders</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stats.activeOrders}</div>
                  <p className="text-xs text-muted-foreground">In progress</p>
                </CardContent>
              </Card>
            </div>
          </div>
        );
      case 'reviews':
        return (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold">Reviews</h2>
            <Card>
              <CardContent className="p-6 text-center text-muted-foreground">
                <Star className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p>No reviews yet. Complete orders to receive reviews.</p>
              </CardContent>
            </Card>
          </div>
        );
      case 'withdrawal':
        return (
          <div className="animate-in fade-in duration-500">
            <WithdrawalScreen />
          </div>
        );
      case 'profile':
        return <PharmacyProfileSettings />;
      default:
        return null;
    }
  };

  // ---- Approval gate (UI-level): only approved, non-suspended pharmacies see inventory/orders ----
  if (!appStatus) {
    return (
      <DashboardLayout title="Pharmacy Dashboard">
        <div className="flex justify-center py-24"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
      </DashboardLayout>
    );
  }

  if (appStatus.has_pharmacy && !approved) {
    let gate: JSX.Element;
    if (appStatus.verification_status === 'verified' && appStatus.is_suspended) {
      gate = <SuspendedScreen status={appStatus} />;
    } else if (appStatus.profile_status === 'submitted' && appStatus.verification_status === 'pending') {
      gate = <UnderReviewScreen status={appStatus} onRefresh={loadStatus} />;
    } else {
      gate = <PharmacyOnboardingWizard status={appStatus} onSubmitted={loadStatus} />;
    }
    return (
      <DashboardLayout title="Pharmacy Dashboard">
        <div className="pb-8">{gate}</div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout
      title="Pharmacy Dashboard"
      tabs={tabs}
      activeTab={activeTab}
      onTabChange={setActiveTab}
    >
      <div className="space-y-4">
        {/* Welcome Banner */}
        <div className="bg-gradient-to-r from-primary to-secondary rounded-xl p-4 text-primary-foreground">
          <h1 className="text-lg font-bold">Pharmacy Dashboard</h1>
          <p className="text-sm opacity-90">Manage orders and inventory</p>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
          <Card className="min-w-[130px] flex-shrink-0 md:min-w-0 bg-gradient-to-br from-primary to-secondary text-primary-foreground border-none">
            <CardContent className="p-3">
              <p className="text-[10px] opacity-80 uppercase">Active Orders</p>
              <div className="text-xl font-bold mt-1">{stats.activeOrders}</div>
            </CardContent>
          </Card>
          <Card className="min-w-[130px] flex-shrink-0 md:min-w-0">
            <CardContent className="p-3">
              <p className="text-[10px] text-muted-foreground uppercase">Revenue</p>
              <div className="text-xl font-bold mt-1 text-secondary">{formatRevenue(stats.revenue)}</div>
            </CardContent>
          </Card>
          <Card className="min-w-[130px] flex-shrink-0 md:min-w-0">
            <CardContent className="p-3">
              <p className="text-[10px] text-muted-foreground uppercase">Low Stock</p>
              <div className="text-xl font-bold mt-1 text-destructive">{stats.lowStock}</div>
            </CardContent>
          </Card>
        </div>

        {/* Main Content */}
        <div className="min-h-[50vh]">
          {renderContent()}
        </div>
      </div>

      <BottomNav tabs={tabs} activeTab={activeTab} onTabChange={setActiveTab} />
    </DashboardLayout>
  );
}