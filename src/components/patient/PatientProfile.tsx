import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import MedicalHistoryView from './medical-history/MedicalHistoryView';
import { Settings, User, Bell, Shield, Wallet, LogOut, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { useState } from 'react';
import { SettingsDialog } from '../layout/SettingsDialog';

export default function PatientProfile() {
    const { profile, signOut } = useAuth();
    const [showProfileSettings, setShowProfileSettings] = useState(false);

    const menuItems = [
        { id: 'profile', label: 'Profile Information', icon: User, description: 'Update your personal details and contact info' },
        { id: 'notifications', label: 'Notifications', icon: Bell, description: 'Manage how you receive alerts and reminders' },
        { id: 'security', label: 'Security & Privacy', icon: Shield, description: 'Control your data and account security' },
    ];

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold tracking-tight">Profile</h2>
            </div>

            {/* Profile Overview Card */}
            <Card className="bg-gradient-to-br from-primary/5 to-secondary/5 border-none shadow-sm">
                <CardContent className="p-4 flex items-center gap-4">
                    <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center text-primary text-xl font-bold">
                        {profile?.first_name?.[0] || 'U'}
                    </div>
                    <div className="flex-1">
                        <h3 className="font-bold text-lg">{profile?.first_name} {profile?.last_name}</h3>
                        <p className="text-sm text-muted-foreground">{profile?.role} Account</p>
                    </div>
                    <Button variant="outline" size="sm" onClick={() => setShowProfileSettings(true)}>
                        Edit Profile
                    </Button>
                </CardContent>
            </Card>

            {/* Settings Sections */}
            <div className="grid gap-4">
                <div className="space-y-3">
                    <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Account & Security</h3>
                    <div className="grid gap-2">
                        {menuItems.map((item) => (
                            <button
                                key={item.id}
                                onClick={() => item.id === 'profile' && setShowProfileSettings(true)}
                                className="flex items-center gap-4 p-3 rounded-xl bg-card border hover:border-primary/50 transition-all text-left group"
                            >
                                <div className="w-10 h-10 rounded-lg bg-primary/5 flex items-center justify-center text-primary group-hover:bg-primary/10 transition-colors">
                                    <item.icon className="w-5 h-5" />
                                </div>
                                <div className="flex-1">
                                    <div className="font-semibold text-sm">{item.label}</div>
                                    <div className="text-xs text-muted-foreground">{item.description}</div>
                                </div>
                                <ChevronRight className="w-4 h-4 text-muted-foreground" />
                            </button>
                        ))}
                    </div>
                </div>

                <div className="space-y-3">
                    <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Health Records</h3>
                    <Card>
                        <CardHeader className="pb-2">
                            <CardTitle className="text-base">Medical History</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <MedicalHistoryView />
                        </CardContent>
                    </Card>
                </div>

                <div className="pt-4">
                    <Button variant="destructive" className="w-full" onClick={() => signOut()}>
                        <LogOut className="w-4 h-4 mr-2" />
                        Sign Out
                    </Button>
                </div>
            </div>

            <SettingsDialog open={showProfileSettings} onOpenChange={setShowProfileSettings} />
        </div>
    );
}
