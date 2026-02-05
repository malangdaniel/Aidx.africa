import { useState } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import BottomNav from '@/components/layout/BottomNav';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { BarChart3, Users, DollarSign, Shield, MessageSquare, Settings, CheckCircle } from 'lucide-react';

export default function AdminDashboard() {
  const [activeTab, setActiveTab] = useState('analytics');

  const tabs = [
    { id: 'analytics', label: 'Stats', icon: BarChart3 },
    { id: 'verification', label: 'Verify', icon: Shield },
    { id: 'payouts', label: 'Payouts', icon: DollarSign },
    { id: 'users', label: 'Users', icon: Users },
  ];

  const renderContent = () => {
    switch (activeTab) {
      case 'analytics':
        return (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold">Platform Analytics</h2>
            <div className="grid gap-3">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">User Distribution</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Patients</span>
                    <Badge variant="secondary">0</Badge>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>Doctors</span>
                    <Badge variant="secondary">0</Badge>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>Pharmacists</span>
                    <Badge variant="secondary">0</Badge>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">AI Usage</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">0</div>
                  <p className="text-xs text-muted-foreground">Total AI consultations</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Transaction Volume</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">₦0.00</div>
                  <p className="text-xs text-muted-foreground">Total platform volume</p>
                </CardContent>
              </Card>
            </div>
          </div>
        );

      case 'verification':
        return (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold">Verification</h2>
            <div className="flex gap-2 flex-wrap">
              <Badge variant="secondary">Pending: 0</Badge>
              <Badge variant="default">Verified: 0</Badge>
              <Badge variant="destructive">Rejected: 0</Badge>
            </div>
            <Card>
              <CardContent className="p-6 text-center">
                <Shield className="w-10 h-10 mx-auto mb-3 text-muted-foreground" />
                <h3 className="font-medium mb-1">No Pending</h3>
                <p className="text-sm text-muted-foreground">All professionals verified</p>
              </CardContent>
            </Card>
          </div>
        );

      case 'payouts':
        return (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold">Payouts</h2>
            <div className="flex gap-2 flex-wrap">
              <Badge variant="secondary">Pending: 0</Badge>
              <Badge variant="default">Approved: 0</Badge>
            </div>
            <Card>
              <CardContent className="p-6 text-center">
                <DollarSign className="w-10 h-10 mx-auto mb-3 text-muted-foreground" />
                <h3 className="font-medium mb-1">No Pending Payouts</h3>
                <p className="text-sm text-muted-foreground">All requests processed</p>
              </CardContent>
            </Card>
          </div>
        );

      case 'users':
        return (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="text-lg font-semibold">Users</h2>
              <Button variant="outline" size="sm">Export</Button>
            </div>
            <Card>
              <CardContent className="p-6 text-center">
                <Users className="w-10 h-10 mx-auto mb-3 text-muted-foreground" />
                <h3 className="font-medium mb-1">No Users Yet</h3>
                <p className="text-sm text-muted-foreground">Users will appear here</p>
              </CardContent>
            </Card>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <DashboardLayout title="Admin Dashboard">
      <div className="space-y-4">
        {/* Welcome Section */}
        <div className="bg-gradient-to-r from-primary to-secondary rounded-xl p-4 text-primary-foreground">
          <h1 className="text-lg font-bold">Admin Dashboard</h1>
          <p className="text-sm opacity-90">Monitor and manage AiDx</p>
        </div>

        {/* Quick Stats */}
        <div className="flex gap-3 overflow-x-auto pb-2 -mx-4 px-4 md:grid md:grid-cols-4 md:overflow-visible md:mx-0 md:px-0">
          <Card className="min-w-[120px] flex-shrink-0 md:min-w-0">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 p-3 pb-1">
              <CardTitle className="text-xs font-medium">Users</CardTitle>
              <Users className="h-3.5 w-3.5 text-muted-foreground" />
            </CardHeader>
            <CardContent className="p-3 pt-0">
              <div className="text-xl font-bold">0</div>
              <p className="text-[10px] text-muted-foreground">All roles</p>
            </CardContent>
          </Card>
          <Card className="min-w-[120px] flex-shrink-0 md:min-w-0">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 p-3 pb-1">
              <CardTitle className="text-xs font-medium">Revenue</CardTitle>
              <DollarSign className="h-3.5 w-3.5 text-muted-foreground" />
            </CardHeader>
            <CardContent className="p-3 pt-0">
              <div className="text-xl font-bold">₦0</div>
              <p className="text-[10px] text-muted-foreground">Commission</p>
            </CardContent>
          </Card>
          <Card className="min-w-[120px] flex-shrink-0 md:min-w-0">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 p-3 pb-1">
              <CardTitle className="text-xs font-medium">Pending</CardTitle>
              <Shield className="h-3.5 w-3.5 text-muted-foreground" />
            </CardHeader>
            <CardContent className="p-3 pt-0">
              <div className="text-xl font-bold">0</div>
              <p className="text-[10px] text-muted-foreground">Verifications</p>
            </CardContent>
          </Card>
          <Card className="min-w-[120px] flex-shrink-0 md:min-w-0">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 p-3 pb-1">
              <CardTitle className="text-xs font-medium">Payouts</CardTitle>
              <DollarSign className="h-3.5 w-3.5 text-muted-foreground" />
            </CardHeader>
            <CardContent className="p-3 pt-0">
              <div className="text-xl font-bold">0</div>
              <p className="text-[10px] text-muted-foreground">Pending</p>
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