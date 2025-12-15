import { useState } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Tabs, TabsContent } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Pill, Package, ShoppingCart, TrendingUp, AlertTriangle, Star, Plus } from 'lucide-react';
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

  return (
    <DashboardLayout title="Pharmacy Dashboard">
      <div className="space-y-6">
        {/* Quick Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="bg-gradient-to-br from-primary to-teal-700 text-primary-foreground border-none">
            <CardContent className="p-4 flex flex-col justify-between h-full">
              <p className="text-xs opacity-80 uppercase">Active Orders</p>
              <div className="text-2xl font-bold mt-1">5</div>
            </CardContent>
          </Card>
          <Card className="bg-white border-l-4 border-l-green-500 shadow-sm">
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground uppercase">Revenue</p>
              <div className="text-2xl font-bold mt-1 text-green-700">₦250k</div>
            </CardContent>
          </Card>
          <Card className="bg-white border-l-4 border-l-orange-500 shadow-sm">
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground uppercase">Low Stock</p>
              <div className="text-2xl font-bold mt-1 text-orange-600">2</div>
            </CardContent>
          </Card>
        </div>

        {/* Main Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsContent value="orders" className="space-y-4">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold text-foreground/80">Order Management</h2>
            </div>
            <OrderManagement />
          </TabsContent>

          <TabsContent value="inventory" className="space-y-4">
            <InventoryManagement />
          </TabsContent>

          <TabsContent value="alerts" className="space-y-4">
            <h2 className="text-xl font-bold text-foreground/80">Alerts</h2>
            <div className="grid gap-4 md:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-orange-700">
                    <AlertTriangle className="w-5 h-5" />
                    Low Stock Items
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">0</div>
                  <p className="text-sm text-muted-foreground">Products need restocking</p>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="analytics" className="space-y-4">
            <h2 className="text-xl font-bold text-foreground/80">Analytics</h2>
            <Card><CardContent className="p-6 text-center text-muted-foreground">No data available</CardContent></Card>
          </TabsContent>

          <TabsContent value="reviews" className="space-y-4">
            <h2 className="text-xl font-bold text-foreground/80">Reviews</h2>
            <Card><CardContent className="p-6 text-center text-muted-foreground">No reviews available</CardContent></Card>
          </TabsContent>
        </Tabs>
      </div>

      <BottomNav tabs={tabs} activeTab={activeTab} onTabChange={setActiveTab} />
    </DashboardLayout>
  );
}
