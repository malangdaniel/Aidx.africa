import { useState } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ShoppingCart, Package, AlertTriangle, TrendingUp, Star } from 'lucide-react';
import OrderManagement from '@/components/pharmacist/OrderManagement';
import InventoryManagement from '@/components/pharmacist/InventoryManagement';
import BottomNav from '@/components/layout/BottomNav';

export default function PharmacistDashboard() {
  const [activeTab, setActiveTab] = useState('orders');

  const tabs = [
    { id: 'orders', label: 'Orders', icon: ShoppingCart },
    { id: 'inventory', label: 'Stocks', icon: Package },
    { id: 'alerts', label: 'Alerts', icon: AlertTriangle },
    { id: 'analytics', label: 'Stats', icon: TrendingUp },
    { id: 'reviews', label: 'Reviews', icon: Star },
  ];

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
                <div className="text-2xl font-bold">0</div>
                <p className="text-xs text-muted-foreground">Products need restocking</p>
              </CardContent>
            </Card>
          </div>
        );
      case 'analytics':
        return (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold">Analytics</h2>
            <Card>
              <CardContent className="p-6 text-center text-muted-foreground">
                No data available
              </CardContent>
            </Card>
          </div>
        );
      case 'reviews':
        return (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold">Reviews</h2>
            <Card>
              <CardContent className="p-6 text-center text-muted-foreground">
                No reviews available
              </CardContent>
            </Card>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <DashboardLayout title="Pharmacy Dashboard">
      <div className="space-y-4">
        {/* Welcome Banner */}
        <div className="bg-gradient-to-r from-primary to-secondary rounded-xl p-4 text-primary-foreground">
          <h1 className="text-lg font-bold">Pharmacy Dashboard</h1>
          <p className="text-sm opacity-90">Manage orders and inventory</p>
        </div>

        {/* Quick Stats - Horizontal scroll on mobile */}
        <div className="flex gap-3 overflow-x-auto pb-2 -mx-4 px-4 md:grid md:grid-cols-3 md:overflow-visible md:mx-0 md:px-0">
          <Card className="min-w-[130px] flex-shrink-0 md:min-w-0 bg-gradient-to-br from-primary to-secondary text-primary-foreground border-none">
            <CardContent className="p-3">
              <p className="text-[10px] opacity-80 uppercase">Active Orders</p>
              <div className="text-xl font-bold mt-1">5</div>
            </CardContent>
          </Card>
          <Card className="min-w-[130px] flex-shrink-0 md:min-w-0">
            <CardContent className="p-3">
              <p className="text-[10px] text-muted-foreground uppercase">Revenue</p>
              <div className="text-xl font-bold mt-1 text-secondary">₦250k</div>
            </CardContent>
          </Card>
          <Card className="min-w-[130px] flex-shrink-0 md:min-w-0">
            <CardContent className="p-3">
              <p className="text-[10px] text-muted-foreground uppercase">Low Stock</p>
              <div className="text-xl font-bold mt-1 text-destructive">2</div>
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
