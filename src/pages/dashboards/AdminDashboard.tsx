import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import DashboardLayout from '@/components/layout/DashboardLayout';
import BottomNav from '@/components/layout/BottomNav';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { BarChart3, Users, DollarSign, Shield, CheckCircle, XCircle, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface AdminStats {
  totalUsers: number;
  patients: number;
  doctors: number;
  pharmacists: number;
  totalRevenue: number;
  transactionVolume: number;
  aiUsage: number;
  pendingVerifications: number;
  verifiedCount: number;
  rejectedCount: number;
  pendingPayouts: number;
  approvedPayouts: number;
}

interface PendingProfile {
  user_id: string;
  first_name: string | null;
  last_name: string | null;
  role: string;
}

interface PayoutRequest {
  id: string;
  amount: number;
  net_amount: number;
  status: string;
  created_at: string;
  recipient_name: string;
}

export default function AdminDashboard() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('analytics');
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<AdminStats>({
    totalUsers: 0, patients: 0, doctors: 0, pharmacists: 0,
    totalRevenue: 0, transactionVolume: 0, aiUsage: 0,
    pendingVerifications: 0, verifiedCount: 0, rejectedCount: 0,
    pendingPayouts: 0, approvedPayouts: 0,
  });
  const [pendingProfiles, setPendingProfiles] = useState<PendingProfile[]>([]);
  const [payoutRequests, setPayoutRequests] = useState<PayoutRequest[]>([]);

  useEffect(() => {
    if (user) fetchAdminData();
  }, [user]);

  const fetchAdminData = async () => {
    setLoading(true);
    try {
      // Fetch role counts
      const { data: roleCounts } = await supabase.from('user_roles').select('role');
      const patients = (roleCounts || []).filter(r => r.role === 'patient').length;
      const doctors = (roleCounts || []).filter(r => r.role === 'doctor').length;
      const pharmacists = (roleCounts || []).filter(r => r.role === 'pharmacist').length;

      // Fetch revenue & transaction volume
      const { data: ordersData } = await supabase.from('orders').select('total_amount, commission_amount');
      const totalRevenue = (ordersData || []).reduce((sum, o) => sum + (o.commission_amount || 0), 0);
      const transactionVolume = (ordersData || []).reduce((sum, o) => sum + (o.total_amount || 0), 0);

      // Fetch AI usage
      const { count: aiUsage } = await supabase.from('ai_chats').select('id', { count: 'exact', head: true });

      // Fetch verification counts
      const [pendingV, verifiedV, rejectedV] = await Promise.all([
        supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('verification_status', 'pending'),
        supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('verification_status', 'verified'),
        supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('verification_status', 'rejected'),
      ]);

      // Fetch pending payout counts
      const [pendingP, approvedP] = await Promise.all([
        supabase.from('payout_requests').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
        supabase.from('payout_requests').select('id', { count: 'exact', head: true }).eq('status', 'approved'),
      ]);

      setStats({
        totalUsers: patients + doctors + pharmacists,
        patients, doctors, pharmacists,
        totalRevenue, transactionVolume,
        aiUsage: aiUsage || 0,
        pendingVerifications: pendingV.count || 0,
        verifiedCount: verifiedV.count || 0,
        rejectedCount: rejectedV.count || 0,
        pendingPayouts: pendingP.count || 0,
        approvedPayouts: approvedP.count || 0,
      });

      // Fetch pending verification profiles
      const { data: pendingData } = await supabase
        .from('profiles')
        .select(`user_id, first_name, last_name, user_roles:user_id (role)`)
        .eq('verification_status', 'pending')
        .limit(20);

      setPendingProfiles((pendingData || []).map((p: any) => ({
        user_id: p.user_id,
        first_name: p.first_name,
        last_name: p.last_name,
        role: p.user_roles?.[0]?.role || p.user_roles?.role || 'unknown',
      })));

      // Fetch payout requests
      const { data: payoutsData } = await supabase
        .from('payout_requests')
        .select(`id, amount, net_amount, status, created_at, recipient_id`)
        .order('created_at', { ascending: false })
        .limit(20);

      setPayoutRequests((payoutsData || []).map((p: any) => ({
        id: p.id,
        amount: p.amount,
        net_amount: p.net_amount,
        status: p.status,
        created_at: p.created_at,
        recipient_name: p.recipient_id?.slice(0, 8) || 'Unknown',
      })));

    } catch (error) {
      console.error('Error fetching admin data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleVerification = async (userId: string, status: 'verified' | 'rejected') => {
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ verification_status: status })
        .eq('user_id', userId);

      if (error) throw error;
      toast.success(`User ${status === 'verified' ? 'verified' : 'rejected'} successfully`);
      fetchAdminData();
    } catch (error) {
      console.error('Error updating verification:', error);
      toast.error('Failed to update verification status');
    }
  };

  const handlePayout = async (payoutId: string, status: 'approved' | 'rejected') => {
    try {
      const { error } = await supabase
        .from('payout_requests')
        .update({
          status,
          processed_at: new Date().toISOString(),
          processed_by: user?.id || null,
        })
        .eq('id', payoutId);

      if (error) throw error;
      toast.success(`Payout ${status === 'approved' ? 'approved' : 'rejected'}`);
      fetchAdminData();
    } catch (error) {
      console.error('Error processing payout:', error);
      toast.error('Failed to process payout');
    }
  };

  const tabs = [
    { id: 'analytics', label: 'Stats', icon: BarChart3 },
    { id: 'verification', label: 'Verify', icon: Shield },
    { id: 'payouts', label: 'Payouts', icon: DollarSign },
    { id: 'users', label: 'Users', icon: Users },
  ];

  const renderContent = () => {
    if (loading) {
      return (
        <div className="flex justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      );
    }

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
                    <Badge variant="secondary">{stats.patients}</Badge>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>Doctors</span>
                    <Badge variant="secondary">{stats.doctors}</Badge>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>Pharmacists</span>
                    <Badge variant="secondary">{stats.pharmacists}</Badge>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">AI Usage</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stats.aiUsage}</div>
                  <p className="text-xs text-muted-foreground">Total AI consultations</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Transaction Volume</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">₦{stats.transactionVolume.toLocaleString('en-NG', { minimumFractionDigits: 2 })}</div>
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
              <Badge variant="secondary">Pending: {stats.pendingVerifications}</Badge>
              <Badge variant="default">Verified: {stats.verifiedCount}</Badge>
              <Badge variant="destructive">Rejected: {stats.rejectedCount}</Badge>
            </div>
            {pendingProfiles.length > 0 ? (
              <div className="space-y-3">
                {pendingProfiles.map((profile) => (
                  <Card key={profile.user_id}>
                    <CardContent className="p-4 flex items-center justify-between">
                      <div>
                        <p className="font-medium">{profile.first_name || 'Unknown'} {profile.last_name || ''}</p>
                        <p className="text-xs text-muted-foreground capitalize">{profile.role}</p>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-green-600 border-green-200 hover:bg-green-50"
                          onClick={() => handleVerification(profile.user_id, 'verified')}
                        >
                          <CheckCircle className="w-4 h-4 mr-1" />
                          Verify
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-destructive border-destructive/20 hover:bg-destructive/5"
                          onClick={() => handleVerification(profile.user_id, 'rejected')}
                        >
                          <XCircle className="w-4 h-4 mr-1" />
                          Reject
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <Card>
                <CardContent className="p-6 text-center">
                  <Shield className="w-10 h-10 mx-auto mb-3 text-muted-foreground" />
                  <h3 className="font-medium mb-1">No Pending</h3>
                  <p className="text-sm text-muted-foreground">All professionals verified</p>
                </CardContent>
              </Card>
            )}
          </div>
        );

      case 'payouts':
        return (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold">Payouts</h2>
            <div className="flex gap-2 flex-wrap">
              <Badge variant="secondary">Pending: {stats.pendingPayouts}</Badge>
              <Badge variant="default">Approved: {stats.approvedPayouts}</Badge>
            </div>
            {payoutRequests.length > 0 ? (
              <div className="space-y-3">
                {payoutRequests.map((payout) => (
                  <Card key={payout.id}>
                    <CardContent className="p-4 flex items-center justify-between">
                      <div>
                        <p className="font-medium">₦{payout.net_amount.toLocaleString()}</p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(payout.created_at).toLocaleDateString()} • {payout.status}
                        </p>
                      </div>
                      {payout.status === 'pending' && (
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-green-600 border-green-200 hover:bg-green-50"
                            onClick={() => handlePayout(payout.id, 'approved')}
                          >
                            Approve
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-destructive border-destructive/20 hover:bg-destructive/5"
                            onClick={() => handlePayout(payout.id, 'rejected')}
                          >
                            Reject
                          </Button>
                        </div>
                      )}
                      {payout.status !== 'pending' && (
                        <Badge variant={payout.status === 'approved' ? 'default' : 'destructive'}>
                          {payout.status}
                        </Badge>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <Card>
                <CardContent className="p-6 text-center">
                  <DollarSign className="w-10 h-10 mx-auto mb-3 text-muted-foreground" />
                  <h3 className="font-medium mb-1">No Payout Requests</h3>
                  <p className="text-sm text-muted-foreground">All requests processed</p>
                </CardContent>
              </Card>
            )}
          </div>
        );

      case 'users':
        return (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="text-lg font-semibold">Users ({stats.totalUsers})</h2>
            </div>
            <div className="grid gap-3">
              <Card>
                <CardContent className="p-4 space-y-3">
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                        <Users className="w-4 h-4 text-primary" />
                      </div>
                      <span className="font-medium">Patients</span>
                    </div>
                    <span className="text-2xl font-bold">{stats.patients}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-secondary/10 flex items-center justify-center">
                        <Shield className="w-4 h-4 text-secondary" />
                      </div>
                      <span className="font-medium">Doctors</span>
                    </div>
                    <span className="text-2xl font-bold">{stats.doctors}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-green-500/10 flex items-center justify-center">
                        <DollarSign className="w-4 h-4 text-green-600" />
                      </div>
                      <span className="font-medium">Pharmacists</span>
                    </div>
                    <span className="text-2xl font-bold">{stats.pharmacists}</span>
                  </div>
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
    <DashboardLayout title="Admin Dashboard">
      <div className="space-y-4">
        {/* Welcome Section */}
        <div className="bg-gradient-to-r from-primary to-secondary rounded-xl p-4 text-primary-foreground">
          <h1 className="text-lg font-bold">Admin Dashboard</h1>
          <p className="text-sm opacity-90">Monitor and manage Sanari AI</p>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Card className="min-w-[120px] flex-shrink-0 md:min-w-0">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 p-3 pb-1">
              <CardTitle className="text-xs font-medium">Users</CardTitle>
              <Users className="h-3.5 w-3.5 text-muted-foreground" />
            </CardHeader>
            <CardContent className="p-3 pt-0">
              <div className="text-xl font-bold">{stats.totalUsers}</div>
              <p className="text-[10px] text-muted-foreground">All roles</p>
            </CardContent>
          </Card>
          <Card className="min-w-[120px] flex-shrink-0 md:min-w-0">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 p-3 pb-1">
              <CardTitle className="text-xs font-medium">Revenue</CardTitle>
              <DollarSign className="h-3.5 w-3.5 text-muted-foreground" />
            </CardHeader>
            <CardContent className="p-3 pt-0">
              <div className="text-xl font-bold">₦{stats.totalRevenue.toLocaleString()}</div>
              <p className="text-[10px] text-muted-foreground">Commission</p>
            </CardContent>
          </Card>
          <Card className="min-w-[120px] flex-shrink-0 md:min-w-0">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 p-3 pb-1">
              <CardTitle className="text-xs font-medium">Pending</CardTitle>
              <Shield className="h-3.5 w-3.5 text-muted-foreground" />
            </CardHeader>
            <CardContent className="p-3 pt-0">
              <div className="text-xl font-bold">{stats.pendingVerifications}</div>
              <p className="text-[10px] text-muted-foreground">Verifications</p>
            </CardContent>
          </Card>
          <Card className="min-w-[120px] flex-shrink-0 md:min-w-0">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 p-3 pb-1">
              <CardTitle className="text-xs font-medium">Payouts</CardTitle>
              <DollarSign className="h-3.5 w-3.5 text-muted-foreground" />
            </CardHeader>
            <CardContent className="p-3 pt-0">
              <div className="text-xl font-bold">{stats.pendingPayouts}</div>
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