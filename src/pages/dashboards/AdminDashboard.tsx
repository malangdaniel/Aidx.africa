import { useState } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { BarChart3, Users, DollarSign, Shield, MessageSquare, Settings, CheckCircle, XCircle } from 'lucide-react';

export default function AdminDashboard() {
  const [activeTab, setActiveTab] = useState('analytics');

  const tabs = [
    { id: 'analytics', label: 'Analytics', icon: BarChart3 },
    { id: 'verification', label: 'Verification', icon: Shield },
    { id: 'payouts', label: 'Payouts', icon: DollarSign },
    { id: 'disputes', label: 'Disputes', icon: MessageSquare },
    { id: 'users', label: 'Users', icon: Users },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  return (
    <DashboardLayout title="Admin Dashboard">
      <div className="space-y-6">
        {/* Welcome Section */}
        <div className="bg-gradient-to-r from-primary to-secondary rounded-lg p-6 text-primary-foreground">
          <h1 className="text-2xl font-bold mb-2">Admin Dashboard</h1>
          <p className="opacity-90">Monitor and manage the AiDx platform</p>
        </div>

        {/* Quick Stats */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Users</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">0</div>
              <p className="text-xs text-muted-foreground">All roles</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">₦0.00</div>
              <p className="text-xs text-muted-foreground">Platform commission</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Pending Verifications</CardTitle>
              <Shield className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">0</div>
              <p className="text-xs text-muted-foreground">Awaiting review</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Pending Payouts</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">0</div>
              <p className="text-xs text-muted-foreground">Awaiting approval</p>
            </CardContent>
          </Card>
        </div>

        {/* Main Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-6">
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

          <TabsContent value="analytics" className="space-y-4">
            <h2 className="text-2xl font-bold">Platform Analytics</h2>
            <div className="grid gap-4 md:grid-cols-3">
              <Card>
                <CardHeader>
                  <CardTitle>User Distribution</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="flex justify-between">
                    <span>Patients</span>
                    <Badge variant="secondary">0</Badge>
                  </div>
                  <div className="flex justify-between">
                    <span>Doctors</span>
                    <Badge variant="secondary">0</Badge>
                  </div>
                  <div className="flex justify-between">
                    <span>Pharmacists</span>
                    <Badge variant="secondary">0</Badge>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle>AI Usage Stats</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">0</div>
                  <p className="text-sm text-muted-foreground">Total AI consultations</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle>Transaction Volume</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">₦0.00</div>
                  <p className="text-sm text-muted-foreground">Total platform volume</p>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="verification" className="space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="text-2xl font-bold">Professional Verification</h2>
              <div className="flex gap-2">
                <Badge variant="secondary">Pending: 0</Badge>
                <Badge variant="default">Verified: 0</Badge>
                <Badge variant="destructive">Rejected: 0</Badge>
              </div>
            </div>
            <Card>
              <CardContent className="p-6">
                <div className="text-center text-muted-foreground">
                  <Shield className="w-12 h-12 mx-auto mb-4" />
                  <h3 className="text-lg font-medium mb-2">No Pending Verifications</h3>
                  <p>All professionals are currently verified or no applications are pending</p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="payouts" className="space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="text-2xl font-bold">Payout Management</h2>
              <div className="flex gap-2">
                <Badge variant="secondary">Pending: 0</Badge>
                <Badge variant="default">Approved: 0</Badge>
                <Badge variant="outline">Paid: 0</Badge>
              </div>
            </div>
            <Card>
              <CardContent className="p-6">
                <div className="text-center text-muted-foreground">
                  <DollarSign className="w-12 h-12 mx-auto mb-4" />
                  <h3 className="text-lg font-medium mb-2">No Pending Payouts</h3>
                  <p>All payout requests have been processed</p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="disputes" className="space-y-4">
            <h2 className="text-2xl font-bold">Dispute Resolution</h2>
            <Card>
              <CardContent className="p-6">
                <div className="text-center text-muted-foreground">
                  <MessageSquare className="w-12 h-12 mx-auto mb-4" />
                  <h3 className="text-lg font-medium mb-2">No Active Disputes</h3>
                  <p>All customer issues have been resolved</p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="users" className="space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="text-2xl font-bold">User Management</h2>
              <Button variant="outline">Export Users</Button>
            </div>
            <Card>
              <CardContent className="p-6">
                <div className="text-center text-muted-foreground">
                  <Users className="w-12 h-12 mx-auto mb-4" />
                  <h3 className="text-lg font-medium mb-2">No Users Registered</h3>
                  <p>User accounts will appear here as they register on the platform</p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="settings" className="space-y-4">
            <h2 className="text-2xl font-bold">Platform Settings</h2>
            <div className="grid gap-4 md:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>Commission Settings</CardTitle>
                  <CardDescription>Platform commission rates</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span>Default Commission</span>
                      <Badge>5%</Badge>
                    </div>
                    <Button variant="outline" size="sm">Update Rates</Button>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle>System Status</CardTitle>
                  <CardDescription>Platform health monitoring</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <span>Database</span>
                      <Badge variant="outline" className="text-green-600">
                        <CheckCircle className="w-3 h-3 mr-1" />
                        Healthy
                      </Badge>
                    </div>
                    <div className="flex justify-between items-center">
                      <span>API Services</span>
                      <Badge variant="outline" className="text-green-600">
                        <CheckCircle className="w-3 h-3 mr-1" />
                        Online
                      </Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}