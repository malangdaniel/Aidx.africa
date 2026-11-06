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
import { Checkbox } from '@/components/ui/checkbox';
import { Loader2, LogOut, User, Stethoscope, HeartPulse, Building2, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import { DoctorProfileSettings } from '@/components/doctor/settings/DoctorProfileSettings';
import PharmacyProfileSettings from '@/components/pharmacist/onboarding/PharmacyProfileSettings';
import { AvatarUpload } from '@/components/shared/AvatarUpload';
import MedicalHistoryView from '@/components/patient/medical-history/MedicalHistoryView';
import { cn } from '@/lib/utils';

interface SettingsDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export function SettingsDialog({ open, onOpenChange }: SettingsDialogProps) {
    const { user, profile, signOut, refetchProfile } = useAuth();
    const [loading, setLoading] = useState(false);

    // Form State (for general/doctor personal profiles)
    const [firstName, setFirstName] = useState('');
    const [lastName, setLastName] = useState('');
    const [age, setAge] = useState('');
    const [sex, setSex] = useState('');
    const [genotype, setGenotype] = useState('');
    const [address, setAddress] = useState('');
    const [avatarUrl, setAvatarUrl] = useState('');
    const [shareRecords, setShareRecords] = useState(false);

    const isDoctor = profile?.role === 'doctor';
    const isPharmacist = profile?.role === 'pharmacist';

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
            setShareRecords(!!profile.records_sharing_consent);
        }
    }, [profile, open]);

    const handleSave = async () => {
        if (!profile) return;
        setLoading(true);

        try {
            const updates: Record<string, any> = {
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

            // Record-sharing consent is a patient-only setting; stamp the time only when it changes.
            if (profile.role === 'patient' && shareRecords !== !!profile.records_sharing_consent) {
                updates.records_sharing_consent = shareRecords;
                updates.records_sharing_consent_at = new Date().toISOString();
            }

            const { error } = await supabase
                .from('profiles')
                .update(updates as any)
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

            {/* Consent to share the full record with doctors (patients only) */}
            {profile?.role === 'patient' && (
                <label
                    htmlFor="share-records"
                    className="flex items-start gap-3 rounded-lg border-2 border-primary/40 bg-primary/5 p-3 cursor-pointer"
                >
                    <Checkbox
                        id="share-records"
                        checked={shareRecords}
                        onCheckedChange={(v) => setShareRecords(v === true)}
                        className="mt-0.5"
                    />
                    <span className="space-y-1 text-xs">
                        <span className="flex items-center gap-1.5 font-semibold text-foreground">
                            <ShieldCheck className="h-3.5 w-3.5 text-primary" />
                            Share my full health record with doctors I book
                        </span>
                        <span className="block text-muted-foreground">
                            Helps your doctor give safe, continuous care by letting them see your health history,
                            vitals, AI diagnoses, and the finalized notes, prescriptions and lab orders from other
                            doctors who treated you. This is optional and off until you tick it. You are notified
                            every time a doctor opens your record, and you can turn this off at any time.
                        </span>
                    </span>
                </label>
            )}

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
            <DialogContent
                className={cn(
                    "p-0 gap-0 overflow-hidden flex flex-col",
                    isPharmacist
                        ? "w-[94vw] sm:w-[90vw] max-w-5xl lg:max-w-6xl h-[90vh] max-h-[90vh] rounded-2xl border shadow-2xl bg-background"
                        : isDoctor
                        ? "sm:max-w-[600px] max-h-[85vh]"
                        : "sm:max-w-[380px] max-h-[85vh]"
                )}
            >
                {isPharmacist ? (
                    <div className="flex flex-col h-full overflow-hidden">
                        {/* Accessible Modal Header */}
                        <div className="flex items-center justify-between px-6 py-4 border-b bg-card/60 flex-shrink-0">
                            <div className="flex items-center gap-3">
                                <div className="h-10 w-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center flex-shrink-0">
                                    <Building2 className="h-5 w-5" />
                                </div>
                                <div>
                                    <DialogTitle className="text-base sm:text-lg font-bold tracking-tight text-foreground">
                                        Pharmacy Profile
                                    </DialogTitle>
                                    <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                                        Manage premises, regulatory licenses, operations, delivery, and payout details
                                    </DialogDescription>
                                </div>
                            </div>
                            <div className="flex items-center gap-2 mr-8">
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={handleSignOut}
                                    className="text-muted-foreground hover:text-destructive hover:bg-destructive/10 h-8 px-2.5 text-xs gap-1.5"
                                >
                                    <LogOut className="h-3.5 w-3.5" />
                                    <span className="hidden sm:inline">Sign Out</span>
                                </Button>
                            </div>
                        </div>

                        {/* Complete Pharmacy Profile Management Interface */}
                        <div className="flex-1 min-h-0 overflow-hidden">
                            <PharmacyProfileSettings inModal onClose={() => onOpenChange(false)} />
                        </div>
                    </div>
                ) : (
                    <>
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
                    </>
                )}
            </DialogContent>
        </Dialog>
    );
}
