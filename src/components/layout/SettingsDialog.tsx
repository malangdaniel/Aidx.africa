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
    DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2, LogOut, User, Stethoscope } from 'lucide-react';
import { toast } from 'sonner';
import { DoctorProfileSettings } from '@/components/doctor/settings/DoctorProfileSettings';

interface SettingsDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export function SettingsDialog({ open, onOpenChange }: SettingsDialogProps) {
    const { profile, signOut, refetchProfile } = useAuth();
    const [loading, setLoading] = useState(false);

    // Form State for general profile
    const [firstName, setFirstName] = useState('');
    const [lastName, setLastName] = useState('');
    const [age, setAge] = useState('');
    const [sex, setSex] = useState('');
    const [genotype, setGenotype] = useState('');
    const [address, setAddress] = useState('');
    const [avatarUrl, setAvatarUrl] = useState('');

    const isDoctor = profile?.role === 'doctor';

    // Load initial data
    useEffect(() => {
        if (profile) {
            setFirstName(profile.first_name || '');
            setLastName(profile.last_name || '');

            // Load user metadata fields
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
            toast.success('Profile updated successfully');
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

    // General profile content (for patients and non-doctors)
    const GeneralProfileContent = () => (
        <ScrollArea className="max-h-[60vh] pr-4">
            <div className="grid gap-6 py-4">
                <div className="flex flex-col items-center gap-4">
                    <Avatar className="h-24 w-24">
                        <AvatarImage src={avatarUrl} />
                        <AvatarFallback className="text-2xl bg-primary/10 text-primary">
                            {firstName?.[0]}{lastName?.[0]}
                        </AvatarFallback>
                    </Avatar>
                    <div className="grid w-full max-w-sm items-center gap-1.5">
                        <Label htmlFor="avatar">Profile Picture URL</Label>
                        <Input
                            type="text"
                            id="avatar"
                            placeholder="https://example.com/me.jpg"
                            value={avatarUrl}
                            onChange={(e) => setAvatarUrl(e.target.value)}
                        />
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div className="grid gap-2">
                        <Label htmlFor="firstName">First Name</Label>
                        <Input
                            id="firstName"
                            value={firstName}
                            onChange={(e) => setFirstName(e.target.value)}
                        />
                    </div>
                    <div className="grid gap-2">
                        <Label htmlFor="lastName">Last Name</Label>
                        <Input
                            id="lastName"
                            value={lastName}
                            onChange={(e) => setLastName(e.target.value)}
                        />
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div className="grid gap-2">
                        <Label htmlFor="age">Age</Label>
                        <Input
                            id="age"
                            type="number"
                            value={age}
                            onChange={(e) => setAge(e.target.value)}
                        />
                    </div>
                    <div className="grid gap-2">
                        <Label htmlFor="sex">Sex</Label>
                        <Select value={sex} onValueChange={setSex}>
                            <SelectTrigger id="sex">
                                <SelectValue placeholder="Select sex" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="Male">Male</SelectItem>
                                <SelectItem value="Female">Female</SelectItem>
                                <SelectItem value="Other">Other</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div className="grid gap-2">
                        <Label htmlFor="genotype">Genotype</Label>
                        <Select value={genotype} onValueChange={setGenotype}>
                            <SelectTrigger id="genotype">
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
                </div>

                <div className="grid gap-2">
                    <Label htmlFor="address">Address</Label>
                    <Textarea
                        id="address"
                        value={address}
                        onChange={(e) => setAddress(e.target.value)}
                        placeholder="123 Main St, City, Country"
                    />
                </div>
            </div>
        </ScrollArea>
    );

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className={`${isDoctor ? 'sm:max-w-[700px]' : 'sm:max-w-[500px]'} max-h-[90vh] flex flex-col`}>
                <DialogHeader>
                    <DialogTitle>Account Settings</DialogTitle>
                    <DialogDescription>
                        {isDoctor 
                            ? 'Manage your professional profile and account preferences.'
                            : 'Manage your profile information and account preferences.'
                        }
                    </DialogDescription>
                </DialogHeader>

                {isDoctor ? (
                    <Tabs defaultValue="professional" className="flex-1 flex flex-col min-h-0">
                        <TabsList className="grid grid-cols-2 mb-4">
                            <TabsTrigger value="professional" className="gap-2">
                                <Stethoscope className="h-4 w-4" />
                                Professional Profile
                            </TabsTrigger>
                            <TabsTrigger value="personal" className="gap-2">
                                <User className="h-4 w-4" />
                                Personal Info
                            </TabsTrigger>
                        </TabsList>

                        <TabsContent value="professional" className="flex-1 min-h-0 mt-0">
                            <div className="h-[55vh]">
                                <DoctorProfileSettings onSaved={() => onOpenChange(false)} />
                            </div>
                        </TabsContent>

                        <TabsContent value="personal" className="flex-1 min-h-0 mt-0">
                            <GeneralProfileContent />
                            <DialogFooter className="gap-2 sm:justify-between mt-4 pt-4 border-t">
                                <Button variant="destructive" onClick={handleSignOut} className="gap-2">
                                    <LogOut className="w-4 h-4" />
                                    Sign Out
                                </Button>
                                <div className="flex gap-2">
                                    <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
                                    <Button onClick={handleSave} disabled={loading}>
                                        {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                                        Save Changes
                                    </Button>
                                </div>
                            </DialogFooter>
                        </TabsContent>
                    </Tabs>
                ) : (
                    <>
                        <GeneralProfileContent />
                        <DialogFooter className="gap-2 sm:justify-between">
                            <Button variant="destructive" onClick={handleSignOut} className="gap-2">
                                <LogOut className="w-4 h-4" />
                                Sign Out
                            </Button>
                            <div className="flex gap-2">
                                <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
                                <Button onClick={handleSave} disabled={loading}>
                                    {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                                    Save Changes
                                </Button>
                            </div>
                        </DialogFooter>
                    </>
                )}
            </DialogContent>
        </Dialog>
    );
}
