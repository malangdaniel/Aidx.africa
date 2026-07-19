import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2, LogOut, User, Stethoscope, HeartPulse } from 'lucide-react';
import { toast } from 'sonner';
import { DoctorProfileSettings } from '@/components/doctor/settings/DoctorProfileSettings';
import { AvatarUpload } from '@/components/shared/AvatarUpload';
import MedicalHistoryView from '@/components/patient/medical-history/MedicalHistoryView';


interface SettingsDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export function SettingsDialog({ open, onOpenChange }: SettingsDialogProps) {
    const { user, profile, signOut, refetchProfile } = useAuth();
    const [loading, setLoading] = useState(false);

    // Form State
    const [firstName, setFirstName] = useState('');
    const [lastName, setLastName] = useState('');
    const [age, setAge] = useState('');
    const [sex, setSex] = useState('');
    const [genotype, setGenotype] = useState('');
    const [address, setAddress] = useState('');
    const [avatarUrl, setAvatarUrl] = useState('');

    const isDoctor = profile?.role === 'doctor';

    useEffect(() => {
        if (profile) {
            setFirstName(profile.first_name || '');
            setLastName(profile.last_name || '');
            const meta = profile.metadata || {};
            setAge(meta.age || '');
            setSex(meta.sex || '');
            setGenotype(meta.genotype || '');
            setAddress(meta.address || '');
            setAvatarUrl(meta.avatar_url || '');
        }
    }, [profile, open]);

    const handleSave = async () => {
        if (!profile) return;
        setLoading(true);

        try {
            const updates = {
                first_name: firstName,
                last_name: lastName,
                updated_at: new Date().toISOString(),
                metadata: {
                    ...profile.metadata,
                    age,
                    sex,
                    genotype,
                    address,
                    avatar_url: avatarUrl
                }
            };

            const { error } = await supabase
                .from('profiles')
                .update(updates)
                .eq('id', profile.id);

            if (error) throw error;

            await refetchProfile();
            toast.success('Profile updated');
            onOpenChange(false);
        } catch (error: any) {
            console.error('Error updating profile:', error);
            toast.error('Failed to update profile');
        } finally {
            setLoading(false);
        }
    };

    const handleSignOut = async () => {
        try {
            await signOut();
            onOpenChange(false);
        } catch (error) {
            toast.error("Error signing out");
        }
    };

    const initials = `${firstName?.[0] || ''}${lastName?.[0] || ''}`.toUpperCase() || 'U';

    const GeneralProfileContent = () => (
        <div className="space-y-5 py-2">
            {/* Avatar Upload */}
            <div className="flex flex-col items-center gap-3">
                <AvatarUpload
                    userId={user?.id || ''}
                    currentAvatarUrl={avatarUrl}
                    fallbackInitials={initials}
                    onUploadComplete={(url) => setAvatarUrl(url)}
                    size="lg"
                />
                <p className="text-xs text-muted-foreground">Tap to change photo</p>
            </div>

            {/* Name Fields */}
            <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                    <Label htmlFor="firstName" className="text-xs">First Name</Label>
                    <Input
                        id="firstName"
                        value={firstName}
                        onChange={(e) => setFirstName(e.target.value)}
                        className="h-9"
                    />
                </div>
                <div className="space-y-1.5">
                    <Label htmlFor="lastName" className="text-xs">Last Name</Label>
                    <Input
                        id="lastName"
                        value={lastName}
                        onChange={(e) => setLastName(e.target.value)}
                        className="h-9"
                    />
                </div>
            </div>

            {/* Age & Sex */}
            <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                    <Label htmlFor="age" className="text-xs">Age</Label>
                    <Input
                        id="age"
                        type="number"
                        value={age}
                        onChange={(e) => setAge(e.target.value)}
                        className="h-9"
                    />
                </div>
                <div className="space-y-1.5">
                    <Label htmlFor="sex" className="text-xs">Sex</Label>
                    <Select value={sex} onValueChange={setSex}>
                        <SelectTrigger id="sex" className="h-9">
                            <SelectValue placeholder="Select" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="Male">Male</SelectItem>
                            <SelectItem value="Female">Female</SelectItem>
                            <SelectItem value="Other">Other</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
            </div>

            {/* Genotype */}
            <div className="space-y-1.5">
                <Label htmlFor="genotype" className="text-xs">Genotype</Label>
                <Select value={genotype} onValueChange={setGenotype}>
                    <SelectTrigger id="genotype" className="h-9">
                        <SelectValue placeholder="Select genotype" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="AA">AA</SelectItem>
                        <SelectItem value="AS">AS</SelectItem>
                        <SelectItem value="SS">SS</SelectItem>
                        <SelectItem value="AC">AC</SelectItem>
                    </SelectContent>
                </Select>
            </div>

            {/* Address */}
            <div className="space-y-1.5">
                <Label htmlFor="address" className="text-xs">Address</Label>
                <Input
                    id="address"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder="123 Main St, City"
                    className="h-9"
                />
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col gap-2 pt-3 border-t">
                <Button onClick={handleSave} disabled={loading} className="w-full h-9">
                    {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                    Save Changes
                </Button>
                <Button variant="outline" onClick={handleSignOut} className="w-full h-9 text-destructive hover:text-destructive">
                    <LogOut className="w-4 h-4 mr-2" />
                    Sign Out
                </Button>
            </div>
        </div>
    );

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className={`${isDoctor ? 'sm:max-w-[600px]' : 'sm:max-w-[380px]'} max-h-[85vh] p-0 gap-0`}>
                <DialogHeader className="px-4 pt-4 pb-2">
                    <DialogTitle className="text-lg">Settings</DialogTitle>
                    <DialogDescription className="text-xs">
                        {isDoctor ? 'Manage your professional profile' : 'Manage your profile'}
                    </DialogDescription>
                </DialogHeader>

                {isDoctor ? (
                    <Tabs defaultValue="professional" className="flex-1">
                        <TabsList className="grid grid-cols-2 mx-4 mb-2">
                            <TabsTrigger value="professional" className="gap-1.5 text-xs">
                                <Stethoscope className="h-3.5 w-3.5" />
                                Professional
                            </TabsTrigger>
                            <TabsTrigger value="personal" className="gap-1.5 text-xs">
                                <User className="h-3.5 w-3.5" />
                                Personal
                            </TabsTrigger>
                        </TabsList>

                        <TabsContent value="professional" className="mt-0 px-4 pb-4">
                            <ScrollArea className="h-[55vh]">
                                <DoctorProfileSettings onSaved={() => onOpenChange(false)} />
                            </ScrollArea>
                        </TabsContent>

                        <TabsContent value="personal" className="mt-0 px-4 pb-4">
                            <ScrollArea className="h-[55vh] pr-3">
                                <GeneralProfileContent />
                            </ScrollArea>
                        </TabsContent>
                    </Tabs>
                ) : profile?.role === 'patient' ? (
                    <Tabs defaultValue="personal" className="flex-1">
                        <TabsList className="grid grid-cols-2 mx-4 mb-2">
                            <TabsTrigger value="personal" className="gap-1.5 text-xs">
                                <User className="h-3.5 w-3.5" />
                                Personal
                            </TabsTrigger>
                            <TabsTrigger value="medical" className="gap-1.5 text-xs">
                                <HeartPulse className="h-3.5 w-3.5" />
                                Medical History
                            </TabsTrigger>
                        </TabsList>
                        <TabsContent value="personal" className="mt-0 px-4 pb-4">
                            <ScrollArea className="h-[60vh] pr-3">
                                <GeneralProfileContent />
                            </ScrollArea>
                        </TabsContent>
                        <TabsContent value="medical" className="mt-0 px-4 pb-4">
                            <ScrollArea className="h-[60vh] pr-3">
                                <MedicalHistoryView />
                            </ScrollArea>
                        </TabsContent>
                    </Tabs>
                ) : (
                    <ScrollArea className="h-[60vh] px-4 pb-4">
                        <GeneralProfileContent />
                    </ScrollArea>
                )}

            </DialogContent>
        </Dialog>
    );
}
