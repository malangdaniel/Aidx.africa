import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from '@/components/ui/dialog';
import {
    Users,
    Search,
    Shield,
    ChevronLeft,
    ChevronRight,
    Loader2,
    RefreshCw,
    UserCheck,
    UserX,
    Clock
} from 'lucide-react';
import { toast } from 'sonner';
import { AdminRpcService, AdminUserRow } from '@/services/AdminRpcService';

const PAGE_SIZE = 25;

export default function AdminUsersTab() {
    const [users, setUsers] = useState<AdminUserRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [roleFilter, setRoleFilter] = useState<string>('all');
    const [statusFilter, setStatusFilter] = useState<string>('all');
    const [page, setPage] = useState(0);

    // Change role modal
    const [targetUser, setTargetUser] = useState<AdminUserRow | null>(null);
    const [newRole, setNewRole] = useState<string>('');
    const [updatingRole, setUpdatingRole] = useState(false);

    const loadUsers = async () => {
        setLoading(true);
        try {
            const data = await AdminRpcService.listUsers({
                role: roleFilter === 'all' ? null : roleFilter,
                status: statusFilter === 'all' ? null : statusFilter,
                search: search.trim() || null,
                limit: PAGE_SIZE,
                offset: page * PAGE_SIZE,
            });
            setUsers(data);
        } catch (err: any) {
            console.error('Error listing users:', err);
            toast.error(err.message || 'Failed to fetch user directory.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadUsers();
    }, [page, roleFilter, statusFilter]);

    const handleSearchSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setPage(0);
        loadUsers();
    };

    const handleConfirmRoleChange = async () => {
        if (!targetUser || !newRole) return;
        setUpdatingRole(true);
        try {
            await AdminRpcService.grantRole(targetUser.user_id, newRole);
            toast.success(`Role for ${targetUser.full_name || targetUser.email} changed to ${newRole}.`);
            setTargetUser(null);
            loadUsers();
        } catch (err: any) {
            console.error('Role grant error:', err);
            toast.error(err.message || 'Failed to update user role.');
        } finally {
            setUpdatingRole(false);
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h2 className="text-xl font-bold tracking-tight">User Management</h2>
                    <p className="text-xs text-muted-foreground">
                        Search accounts, manage permissions, and assign system roles
                    </p>
                </div>
                <Button variant="outline" size="sm" onClick={loadUsers} disabled={loading} className="gap-1.5 self-start sm:self-auto">
                    <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                    Refresh
                </Button>
            </div>

            {/* Filters Bar */}
            <Card>
                <CardContent className="p-4">
                    <form onSubmit={handleSearchSubmit} className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                        <div className="sm:col-span-2 relative">
                            <Search className="w-4 h-4 absolute left-3 top-3 text-muted-foreground" />
                            <Input
                                placeholder="Search by name, email, or license..."
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                className="pl-9 text-xs"
                            />
                        </div>

                        <div>
                            <Select value={roleFilter} onValueChange={(val) => { setRoleFilter(val); setPage(0); }}>
                                <SelectTrigger className="text-xs">
                                    <SelectValue placeholder="All Roles" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All Roles</SelectItem>
                                    <SelectItem value="patient">Patient</SelectItem>
                                    <SelectItem value="doctor">Doctor</SelectItem>
                                    <SelectItem value="pharmacist">Pharmacist</SelectItem>
                                    <SelectItem value="admin">Admin</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <div>
                            <Select value={statusFilter} onValueChange={(val) => { setStatusFilter(val); setPage(0); }}>
                                <SelectTrigger className="text-xs">
                                    <SelectValue placeholder="All Verification" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All Statuses</SelectItem>
                                    <SelectItem value="verified">Verified</SelectItem>
                                    <SelectItem value="pending">Pending</SelectItem>
                                    <SelectItem value="rejected">Rejected</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </form>
                </CardContent>
            </Card>

            {/* Users Table */}
            <Card>
                <CardContent className="p-0 overflow-x-auto">
                    {loading ? (
                        <div className="flex flex-col items-center justify-center py-16 space-y-3">
                            <Loader2 className="w-8 h-8 animate-spin text-primary" />
                            <p className="text-sm text-muted-foreground">Loading directory...</p>
                        </div>
                    ) : users.length === 0 ? (
                        <div className="text-center py-16 space-y-2 text-muted-foreground">
                            <Users className="w-10 h-10 mx-auto opacity-40" />
                            <p className="text-sm font-medium">No users found</p>
                            <p className="text-xs">Try adjusting your search criteria or role filters.</p>
                        </div>
                    ) : (
                        <table className="w-full text-left text-xs border-collapse">
                            <thead>
                                <tr className="border-b bg-muted/30 text-muted-foreground">
                                    <th className="p-3 font-semibold">User</th>
                                    <th className="p-3 font-semibold">Role</th>
                                    <th className="p-3 font-semibold">Status</th>
                                    <th className="p-3 font-semibold">License / Business</th>
                                    <th className="p-3 font-semibold">Joined</th>
                                    <th className="p-3 font-semibold text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y">
                                {users.map((u) => (
                                    <tr key={u.user_id} className="hover:bg-muted/10 transition-colors">
                                        <td className="p-3">
                                            <div className="font-semibold text-foreground">{u.full_name || 'No Name'}</div>
                                            <div className="text-[11px] text-muted-foreground">{u.email}</div>
                                        </td>
                                        <td className="p-3">
                                            <Badge variant={u.role === 'admin' ? 'default' : 'secondary'} className="capitalize text-[11px]">
                                                {u.role}
                                            </Badge>
                                        </td>
                                        <td className="p-3">
                                            <Badge
                                                variant="outline"
                                                className={`text-[11px] capitalize ${u.verification_status === 'verified'
                                                    ? 'border-emerald-500 text-emerald-600 bg-emerald-50 dark:bg-emerald-950/20'
                                                    : u.verification_status === 'rejected'
                                                        ? 'border-destructive text-destructive bg-destructive/10'
                                                        : 'border-amber-500 text-amber-600 bg-amber-50 dark:bg-amber-950/20'
                                                    }`}
                                            >
                                                {u.verification_status}
                                            </Badge>
                                        </td>
                                        <td className="p-3 text-muted-foreground">
                                            <div>{u.license_number || '—'}</div>
                                            {u.business_name && <div className="text-[10px] italic">{u.business_name}</div>}
                                        </td>
                                        <td className="p-3 text-muted-foreground whitespace-nowrap">
                                            {new Date(u.created_at).toLocaleDateString()}
                                        </td>
                                        <td className="p-3 text-right">
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => {
                                                    setTargetUser(u);
                                                    setNewRole(u.role);
                                                }}
                                                className="h-7 text-xs gap-1"
                                            >
                                                <Shield className="w-3 h-3 text-primary" />
                                                Role
                                            </Button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </CardContent>

                {/* Pagination */}
                <div className="flex items-center justify-between p-3 border-t text-xs text-muted-foreground">
                    <div>
                        Showing page {page + 1} ({users.length} users listed)
                    </div>
                    <div className="flex items-center gap-2">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setPage(p => Math.max(0, p - 1))}
                            disabled={page === 0 || loading}
                            className="h-8 gap-1"
                        >
                            <ChevronLeft className="w-3.5 h-3.5" />
                            Prev
                        </Button>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setPage(p => p + 1)}
                            disabled={users.length < PAGE_SIZE || loading}
                            className="h-8 gap-1"
                        >
                            Next
                            <ChevronRight className="w-3.5 h-3.5" />
                        </Button>
                    </div>
                </div>
            </Card>

            {/* Change Role Dialog */}
            {targetUser && (
                <Dialog open={!!targetUser} onOpenChange={(open) => !open && !updatingRole && setTargetUser(null)}>
                    <DialogContent className="sm:max-w-[420px]">
                        <DialogHeader>
                            <DialogTitle>Change User Role</DialogTitle>
                            <DialogDescription>
                                Modify authorization permissions for {targetUser.full_name || targetUser.email}.
                            </DialogDescription>
                        </DialogHeader>

                        <div className="space-y-3 py-2">
                            <div className="bg-muted/40 p-3 rounded-lg text-xs space-y-1">
                                <p><span className="text-muted-foreground">Current Role:</span> <strong className="capitalize">{targetUser.role}</strong></p>
                                <p><span className="text-muted-foreground">User ID:</span> <span className="font-mono">{targetUser.user_id}</span></p>
                            </div>

                            <div className="space-y-1.5">
                                <label className="text-xs font-semibold">Select New Role</label>
                                <Select value={newRole} onValueChange={setNewRole}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Choose a role" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="patient">Patient (Standard)</SelectItem>
                                        <SelectItem value="doctor">Doctor (Consultations)</SelectItem>
                                        <SelectItem value="pharmacist">Pharmacist (Prescriptions & Orders)</SelectItem>
                                        <SelectItem value="admin">Admin (System Full Access)</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        <DialogFooter className="gap-2 sm:gap-0">
                            <Button variant="outline" onClick={() => setTargetUser(null)} disabled={updatingRole}>
                                Cancel
                            </Button>
                            <Button onClick={handleConfirmRoleChange} disabled={updatingRole || newRole === targetUser.role}>
                                {updatingRole && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                                Save Role
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            )}
        </div>
    );
}
