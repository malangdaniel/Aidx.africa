import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from '@/components/ui/dialog';
import {
    Sliders,
    Save,
    AlertTriangle,
    ShieldAlert,
    Loader2,
    RefreshCw,
    Percent,
    DollarSign,
    Lock
} from 'lucide-react';
import { toast } from 'sonner';
import { AdminRpcService, PlatformSettingRow } from '@/services/AdminRpcService';

export default function AdminSettingsTab() {
    const [settings, setSettings] = useState<Record<string, any>>({});
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    // Form edit states
    const [consultationCommissionPct, setConsultationCommissionPct] = useState<string>('5');
    const [orderCommissionPct, setOrderCommissionPct] = useState<string>('5');
    const [minWithdrawalNgn, setMinWithdrawalNgn] = useState<string>('5000');
    const [requireVerifiedDoctors, setRequireVerifiedDoctors] = useState<boolean>(true);
    const [requireVerifiedPharmacies, setRequireVerifiedPharmacies] = useState<boolean>(true);
    const [enforcePrescriptions, setEnforcePrescriptions] = useState<boolean>(true);

    // Confirmation modal state
    const [confirmModalOpen, setConfirmModalOpen] = useState(false);
    const [pendingChanges, setPendingChanges] = useState<Array<{ key: string; value: any; label: string }>>([]);

    const loadSettings = async () => {
        setLoading(true);
        try {
            const { data, error } = await (supabase as any)
                .from('platform_settings')
                .select('*');
            if (error) throw error;

            const map: Record<string, any> = {};
            (data || []).forEach((row: PlatformSettingRow) => {
                map[row.key] = row.value;
            });
            setSettings(map);

            // Populate form fields
            if (map['consultation_commission_rate'] !== undefined) {
                setConsultationCommissionPct((Number(map['consultation_commission_rate']) * 100).toString());
            }
            if (map['order_commission_rate'] !== undefined) {
                setOrderCommissionPct((Number(map['order_commission_rate']) * 100).toString());
            }
            if (map['min_withdrawal_ngn'] !== undefined) {
                setMinWithdrawalNgn(Number(map['min_withdrawal_ngn']).toString());
            }
            if (map['require_verified_doctors'] !== undefined) {
                setRequireVerifiedDoctors(Boolean(map['require_verified_doctors']));
            }
            if (map['require_verified_pharmacies'] !== undefined) {
                setRequireVerifiedPharmacies(Boolean(map['require_verified_pharmacies']));
            }
            if (map['enforce_prescriptions'] !== undefined) {
                setEnforcePrescriptions(Boolean(map['enforce_prescriptions']));
            }
        } catch (err: any) {
            console.error('Error fetching settings:', err);
            toast.error(err.message || 'Failed to load platform settings.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadSettings();
    }, []);

    const handlePreSubmit = (e: React.FormEvent) => {
        e.preventDefault();

        // 1. Validate consultation commission (between 0% and 50%)
        const consultNum = parseFloat(consultationCommissionPct);
        if (isNaN(consultNum) || consultNum < 0 || consultNum > 50) {
            toast.error('Consultation commission rate must be between 0% and 50%.');
            return;
        }

        // 2. Validate order commission (between 0% and 50%)
        const orderNum = parseFloat(orderCommissionPct);
        if (isNaN(orderNum) || orderNum < 0 || orderNum > 50) {
            toast.error('Order commission rate must be between 0% and 50%.');
            return;
        }

        // 3. Validate minimum withdrawal (>= 0)
        const minWithdrawal = parseFloat(minWithdrawalNgn);
        if (isNaN(minWithdrawal) || minWithdrawal < 0) {
            toast.error('Minimum withdrawal amount must be 0 or greater.');
            return;
        }

        const changes = [
            { key: 'consultation_commission_rate', value: consultNum / 100, label: `Consultation Commission: ${consultNum}%` },
            { key: 'order_commission_rate', value: orderNum / 100, label: `Order Commission: ${orderNum}%` },
            { key: 'min_withdrawal_ngn', value: minWithdrawal, label: `Minimum Withdrawal: ₦${minWithdrawal.toLocaleString()}` },
            { key: 'require_verified_doctors', value: requireVerifiedDoctors, label: `Require Verified Doctors: ${requireVerifiedDoctors ? 'Yes' : 'No'}` },
            { key: 'require_verified_pharmacies', value: requireVerifiedPharmacies, label: `Require Verified Pharmacies: ${requireVerifiedPharmacies ? 'Yes' : 'No'}` },
            { key: 'enforce_prescriptions', value: enforcePrescriptions, label: `Enforce Prescriptions: ${enforcePrescriptions ? 'Enforced' : 'Disabled'}` },
        ];

        setPendingChanges(changes);
        setConfirmModalOpen(true);
    };

    const handleConfirmSave = async () => {
        setSaving(true);
        try {
            for (const item of pendingChanges) {
                await AdminRpcService.updateSetting(item.key, item.value);
            }
            toast.success('Platform configuration saved successfully.');
            setConfirmModalOpen(false);
            loadSettings();
        } catch (err: any) {
            console.error('Save settings error:', err);
            toast.error(err.message || 'Failed to update platform settings.');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h2 className="text-xl font-bold tracking-tight">Platform Configuration & Rules</h2>
                    <p className="text-xs text-muted-foreground">
                        Configure marketplace commission rates, payout limits, and safety enforcement switches
                    </p>
                </div>
                <Button variant="outline" size="sm" onClick={loadSettings} disabled={loading} className="gap-1.5 self-start sm:self-auto">
                    <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                    Reset Form
                </Button>
            </div>

            {loading ? (
                <div className="flex flex-col items-center justify-center py-16 space-y-3">
                    <Loader2 className="w-8 h-8 animate-spin text-primary" />
                    <p className="text-sm text-muted-foreground">Loading platform parameters...</p>
                </div>
            ) : (
                <form onSubmit={handlePreSubmit} className="space-y-6">
                    {/* Financial & Commission Rates */}
                    <Card>
                        <CardHeader className="pb-3">
                            <CardTitle className="text-sm font-bold flex items-center gap-2">
                                <Percent className="w-4 h-4 text-primary" />
                                Marketplace Fees & Payout Thresholds
                            </CardTitle>
                            <CardDescription>
                                Set the platform take-rate automatically applied to consultations and order settlements
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="consult-rate" className="text-xs font-semibold">
                                    Consultation Commission (%)
                                </Label>
                                <div className="relative">
                                    <Input
                                        id="consult-rate"
                                        type="number"
                                        step="0.1"
                                        min="0"
                                        max="50"
                                        value={consultationCommissionPct}
                                        onChange={(e) => setConsultationCommissionPct(e.target.value)}
                                        className="pr-8 text-xs font-mono"
                                    />
                                    <span className="absolute right-3 top-2.5 text-xs text-muted-foreground">%</span>
                                </div>
                                <p className="text-[11px] text-muted-foreground">
                                    Stored as fraction (e.g. 5% = 0.05). Max allowed: 50%.
                                </p>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="order-rate" className="text-xs font-semibold">
                                    Pharmacy Order Commission (%)
                                </Label>
                                <div className="relative">
                                    <Input
                                        id="order-rate"
                                        type="number"
                                        step="0.1"
                                        min="0"
                                        max="50"
                                        value={orderCommissionPct}
                                        onChange={(e) => setOrderCommissionPct(e.target.value)}
                                        className="pr-8 text-xs font-mono"
                                    />
                                    <span className="absolute right-3 top-2.5 text-xs text-muted-foreground">%</span>
                                </div>
                                <p className="text-[11px] text-muted-foreground">
                                    Platform cut on total sub-order volume (0% to 50%).
                                </p>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="min-payout" className="text-xs font-semibold">
                                    Min. Practitioner Withdrawal (₦)
                                </Label>
                                <div className="relative">
                                    <Input
                                        id="min-payout"
                                        type="number"
                                        min="0"
                                        step="500"
                                        value={minWithdrawalNgn}
                                        onChange={(e) => setMinWithdrawalNgn(e.target.value)}
                                        className="pl-7 text-xs font-mono"
                                    />
                                    <span className="absolute left-2.5 top-2.5 text-xs text-muted-foreground">₦</span>
                                </div>
                                <p className="text-[11px] text-muted-foreground">
                                    Minimum wallet balance required to request a bank transfer.
                                </p>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Enforcement & Security Switches */}
                    <Card>
                        <CardHeader className="pb-3">
                            <CardTitle className="text-sm font-bold flex items-center gap-2">
                                <Lock className="w-4 h-4 text-primary" />
                                Regulatory & Security Policies
                            </CardTitle>
                            <CardDescription>
                                Enforce compliance gates for doctors, pharmacies, and prescription validation
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            {/* Require verified doctors */}
                            <div className="flex items-center justify-between p-3 border rounded-xl bg-card">
                                <div className="space-y-0.5 max-w-[80%]">
                                    <Label className="text-sm font-semibold">Require Verified Doctors</Label>
                                    <p className="text-xs text-muted-foreground">
                                        When active, unverified doctors cannot accept appointment bookings or conduct consultations.
                                    </p>
                                </div>
                                <Switch
                                    checked={requireVerifiedDoctors}
                                    onCheckedChange={setRequireVerifiedDoctors}
                                />
                            </div>

                            {/* Require verified pharmacies */}
                            <div className="flex items-center justify-between p-3 border rounded-xl bg-card">
                                <div className="space-y-0.5 max-w-[80%]">
                                    <Label className="text-sm font-semibold">Require Verified Pharmacies</Label>
                                    <p className="text-xs text-muted-foreground">
                                        When active, only verified pharmacists can list stock and fulfill medicine orders.
                                    </p>
                                </div>
                                <Switch
                                    checked={requireVerifiedPharmacies}
                                    onCheckedChange={setRequireVerifiedPharmacies}
                                />
                            </div>

                            {/* Enforce prescriptions */}
                            <div className={`flex items-center justify-between p-3 border rounded-xl ${!enforcePrescriptions ? 'border-destructive bg-destructive/10' : 'bg-card'}`}>
                                <div className="space-y-0.5 max-w-[80%]">
                                    <div className="flex items-center gap-2">
                                        <Label className="text-sm font-semibold">Enforce Prescriptions</Label>
                                        {!enforcePrescriptions && (
                                            <Badge variant="destructive" className="text-[10px]">Disabled</Badge>
                                        )}
                                    </div>
                                    <p className="text-xs text-muted-foreground">
                                        Mandatory upload or doctor sign-off for prescription-required drugs during checkout.
                                    </p>
                                    {!enforcePrescriptions && (
                                        <div className="flex items-center gap-1.5 text-xs text-destructive font-semibold pt-1">
                                            <AlertTriangle className="w-3.5 h-3.5" />
                                            Never turn this off in production. Disabling exposes the platform to regulatory sanctions.
                                        </div>
                                    )}
                                </div>
                                <Switch
                                    checked={enforcePrescriptions}
                                    onCheckedChange={(checked) => {
                                        setEnforcePrescriptions(checked);
                                        if (!checked) {
                                            toast.warning("Never turn this off in production", {
                                                description: "Prescription enforcement is mandatory for clinical safety and compliance.",
                                                duration: 6000,
                                            });
                                        }
                                    }}
                                />
                            </div>
                        </CardContent>
                    </Card>

                    {/* Submit Bar */}
                    <div className="flex justify-end gap-3">
                        <Button type="button" variant="outline" onClick={loadSettings} disabled={saving}>
                            Discard Changes
                        </Button>
                        <Button type="submit" disabled={saving} className="gap-2">
                            <Save className="w-4 h-4" />
                            Review & Save Settings
                        </Button>
                    </div>
                </form>
            )}

            {/* Confirmation Dialog */}
            <Dialog open={confirmModalOpen} onOpenChange={setConfirmModalOpen}>
                <DialogContent className="sm:max-w-[460px]">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <ShieldAlert className="w-5 h-5 text-primary" />
                            Confirm Platform Configuration
                        </DialogTitle>
                        <DialogDescription>
                            The following parameters will be written to `platform_settings` and take effect across the system immediately:
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-2 py-2">
                        <div className="bg-muted/40 p-3 rounded-lg text-xs space-y-1.5">
                            {pendingChanges.map((change) => (
                                <div key={change.key} className="flex justify-between items-center py-0.5 border-b border-muted">
                                    <span className="font-mono text-muted-foreground">{change.key}:</span>
                                    <span className="font-semibold">{String(change.value)}</span>
                                </div>
                            ))}
                        </div>

                        {!enforcePrescriptions && (
                            <div className="p-3 bg-red-100 dark:bg-red-950/40 border border-red-300 dark:border-red-900 rounded-lg text-red-800 dark:text-red-300 text-xs flex items-start gap-2">
                                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                                <p><strong>CRITICAL WARNING:</strong> Never turn this off in production. You are about to disable prescription verification for scheduled medicines.</p>
                            </div>
                        )}
                    </div>

                    <DialogFooter className="gap-2 sm:gap-0">
                        <Button variant="outline" onClick={() => setConfirmModalOpen(false)} disabled={saving}>
                            Cancel
                        </Button>
                        <Button onClick={handleConfirmSave} disabled={saving} className="gap-2">
                            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                            Confirm & Apply
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
