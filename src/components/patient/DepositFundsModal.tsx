import { useState } from 'react';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { WalletService, DepositInitResponse } from '@/services/WalletService';
import { toast } from 'sonner';
import {
    Wallet,
    ShieldCheck,
    CreditCard,
    ArrowRight,
    Loader2,
    CheckCircle2,
    AlertCircle,
    ExternalLink,
    Lock,
    Sparkles,
} from 'lucide-react';

interface DepositFundsModalProps {
    isOpen: boolean;
    onClose: () => void;
    onDepositSuccess: () => void;
    initialAmount?: number;
}

const PRESET_AMOUNTS = [2000, 5000, 10000, 25000, 50000];

export default function DepositFundsModal({
    isOpen,
    onClose,
    onDepositSuccess,
    initialAmount,
}: DepositFundsModalProps) {
    const [amount, setAmount] = useState<number>(initialAmount || 5000);
    const [customAmount, setCustomAmount] = useState<string>(initialAmount ? String(initialAmount) : '5000');
    const [loading, setLoading] = useState(false);
    const [step, setStep] = useState<'input' | 'processing' | 'sandbox_confirm' | 'success'>('input');
    const [depositResult, setDepositResult] = useState<DepositInitResponse | null>(null);

    const handleSelectPreset = (val: number) => {
        setAmount(val);
        setCustomAmount(String(val));
    };

    const handleCustomChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value.replace(/[^0-9]/g, '');
        setCustomAmount(val);
        const parsed = parseInt(val, 10);
        if (!isNaN(parsed)) {
            setAmount(parsed);
        } else {
            setAmount(0);
        }
    };

    const handleStartDeposit = async () => {
        if (amount < 500) {
            toast.error('Minimum deposit amount is ₦500');
            return;
        }
        if (amount > 500000) {
            toast.error('Maximum deposit amount per transaction is ₦500,000');
            return;
        }

        setLoading(true);
        try {
            const res = await WalletService.initializeDeposit(amount);
            setDepositResult(res);

            if (res.checkoutUrl && !res.isSandbox) {
                // If live Paystack checkout url is available, open or redirect
                setStep('processing');
                window.open(res.checkoutUrl, '_blank');
                toast.info('Opened Paystack secure payment window. Complete the payment, then click "I have completed payment" below.');
            } else {
                // Sandbox / test simulation mode
                setStep('sandbox_confirm');
            }
        } catch (err: any) {
            console.error('Deposit init failed:', err);
            toast.error(err?.message || 'Failed to initialize deposit');
        } finally {
            setLoading(false);
        }
    };

    const handleVerifySandboxPayment = async () => {
        if (!depositResult?.reference) return;
        setLoading(true);
        try {
            const verifyRes = await WalletService.verifyDeposit(depositResult.reference);
            if (verifyRes.success) {
                setStep('success');
                toast.success(`Successfully funded ₦${amount.toLocaleString()} into your wallet!`);
                onDepositSuccess();
            } else {
                toast.error(verifyRes.message || 'Payment not verified yet');
            }
        } catch (err: any) {
            console.error('Verification failed:', err);
            toast.error(err?.message || 'Verification failed');
        } finally {
            setLoading(false);
        }
    };

    const handleCloseModal = () => {
        setStep('input');
        setDepositResult(null);
        setLoading(false);
        onClose();
    };

    return (
        <Dialog open={isOpen} onOpenChange={handleCloseModal}>
            <DialogContent className="sm:max-w-[460px]">
                <DialogHeader>
                    <div className="flex items-center gap-2">
                        <div className="p-2 bg-primary/10 rounded-xl text-primary">
                            <Wallet className="w-5 h-5" />
                        </div>
                        <div>
                            <DialogTitle className="text-lg font-bold">Add Funds to Wallet</DialogTitle>
                            <DialogDescription className="text-xs">
                                Instant top-up for doctor consultations & medication orders
                            </DialogDescription>
                        </div>
                    </div>
                </DialogHeader>

                {step === 'input' && (
                    <div className="space-y-4 py-2">
                        {/* Quick Preset Selector */}
                        <div>
                            <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                                Select Amount (NGN)
                            </Label>
                            <div className="grid grid-cols-3 gap-2 mt-2">
                                {PRESET_AMOUNTS.map((preset) => (
                                    <button
                                        key={preset}
                                        type="button"
                                        onClick={() => handleSelectPreset(preset)}
                                        className={`py-2 px-3 rounded-lg text-xs font-semibold border transition-all ${
                                            amount === preset
                                                ? 'border-primary bg-primary text-primary-foreground shadow-sm'
                                                : 'border-border hover:border-primary/50 bg-card hover:bg-muted/50'
                                        }`}
                                    >
                                        ₦{preset.toLocaleString()}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Custom Input */}
                        <div className="space-y-1.5">
                            <Label htmlFor="custom-amount" className="text-xs font-medium">
                                Custom Amount (₦500 - ₦500,000)
                            </Label>
                            <div className="relative">
                                <span className="absolute left-3 top-2.5 text-sm font-semibold text-muted-foreground">
                                    ₦
                                </span>
                                <Input
                                    id="custom-amount"
                                    type="text"
                                    value={customAmount}
                                    onChange={handleCustomChange}
                                    className="pl-7 font-bold text-base"
                                    placeholder="5000"
                                />
                            </div>
                        </div>

                        {/* Summary breakdown card */}
                        <div className="rounded-xl border border-border/80 bg-muted/30 p-3 space-y-2 text-xs">
                            <div className="flex justify-between text-muted-foreground">
                                <span>Deposit Amount</span>
                                <span className="font-semibold text-foreground">₦{amount.toLocaleString()}</span>
                            </div>
                            <div className="flex justify-between text-muted-foreground">
                                <span>Processing Fee (Sanari)</span>
                                <span className="text-emerald-600 font-semibold">FREE (₦0.00)</span>
                            </div>
                            <div className="border-t border-border pt-2 flex justify-between font-bold text-sm">
                                <span>Total to Pay</span>
                                <span className="text-primary">₦{amount.toLocaleString()}</span>
                            </div>
                        </div>

                        {/* Closed-loop policy badge */}
                        <div className="flex items-start gap-2 p-2.5 rounded-lg bg-primary/5 border border-primary/20 text-[11px] text-muted-foreground">
                            <Lock className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                            <span>
                                <strong>Closed-Loop Patient Wallet:</strong> Funds are dedicated strictly for healthcare services on Sanari.ai and cannot be withdrawn or transferred.
                            </span>
                        </div>

                        <DialogFooter className="pt-2">
                            <Button
                                type="button"
                                variant="outline"
                                onClick={handleCloseModal}
                                disabled={loading}
                                className="w-full sm:w-auto text-xs"
                            >
                                Cancel
                            </Button>
                            <Button
                                type="button"
                                onClick={handleStartDeposit}
                                disabled={loading || amount < 500 || amount > 500000}
                                className="w-full sm:w-auto gap-2 text-xs font-semibold"
                            >
                                {loading ? (
                                    <>
                                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                        Initializing...
                                    </>
                                ) : (
                                    <>
                                        <CreditCard className="w-3.5 h-3.5" />
                                        Proceed to Pay ₦{amount.toLocaleString()}
                                    </>
                                )}
                            </Button>
                        </DialogFooter>
                    </div>
                )}

                {step === 'processing' && depositResult && (
                    <div className="space-y-4 py-4 text-center">
                        <div className="w-12 h-12 rounded-full bg-primary/10 text-primary flex items-center justify-center mx-auto animate-pulse">
                            <ExternalLink className="w-6 h-6" />
                        </div>
                        <div className="space-y-1">
                            <h3 className="font-semibold text-base">Awaiting Payment Confirmation</h3>
                            <p className="text-xs text-muted-foreground">
                                Complete your transaction in the Paystack window.
                            </p>
                            <p className="text-[11px] font-mono bg-muted p-1 rounded mt-2">
                                Ref: {depositResult.reference}
                            </p>
                        </div>

                        <div className="flex flex-col gap-2 pt-2">
                            {depositResult.checkoutUrl && (
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => window.open(depositResult.checkoutUrl, '_blank')}
                                    className="gap-2 text-xs"
                                >
                                    <ExternalLink className="w-3.5 h-3.5" />
                                    Reopen Payment Window
                                </Button>
                            )}
                            <Button
                                onClick={handleVerifySandboxPayment}
                                disabled={loading}
                                className="gap-2 text-xs"
                            >
                                {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                                I Have Completed Payment
                            </Button>
                        </div>
                    </div>
                )}

                {step === 'sandbox_confirm' && depositResult && (
                    <div className="space-y-4 py-2">
                        <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl space-y-1 text-xs">
                            <div className="flex items-center gap-1.5 font-semibold text-amber-700 dark:text-amber-400">
                                <Sparkles className="w-4 h-4" />
                                <span>Sandbox Development Mode</span>
                            </div>
                            <p className="text-muted-foreground text-[11px]">
                                Live Paystack gateway keys are not yet configured in environment secrets. You can test the wallet funding flow via sandbox verification.
                            </p>
                        </div>

                        <div className="rounded-xl border border-border p-3 space-y-2 text-xs">
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">Deposit Reference:</span>
                                <span className="font-mono font-semibold">{depositResult.reference}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">Crediting Amount:</span>
                                <span className="font-bold text-foreground">₦{amount.toLocaleString()}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">Status:</span>
                                <Badge variant="outline" className="text-amber-600 border-amber-500/40">
                                    Ready to Credit
                                </Badge>
                            </div>
                        </div>

                        <DialogFooter className="pt-2">
                            <Button variant="outline" onClick={handleCloseModal} disabled={loading} className="text-xs">
                                Cancel
                            </Button>
                            <Button
                                onClick={handleVerifySandboxPayment}
                                disabled={loading}
                                className="gap-2 text-xs font-semibold"
                            >
                                {loading ? (
                                    <>
                                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                        Crediting Ledger...
                                    </>
                                ) : (
                                    <>
                                        <CheckCircle2 className="w-3.5 h-3.5" />
                                        Simulate Successful Deposit
                                    </>
                                )}
                            </Button>
                        </DialogFooter>
                    </div>
                )}

                {step === 'success' && (
                    <div className="space-y-4 py-4 text-center">
                        <div className="w-12 h-12 rounded-full bg-emerald-500/10 text-emerald-600 flex items-center justify-center mx-auto">
                            <CheckCircle2 className="w-6 h-6" />
                        </div>
                        <div className="space-y-1">
                            <h3 className="font-bold text-base text-foreground">Funds Added Successfully!</h3>
                            <p className="text-xs text-muted-foreground">
                                ₦{amount.toLocaleString()} has been credited to your Sanari Patient Wallet.
                            </p>
                        </div>
                        <Button onClick={handleCloseModal} className="w-full text-xs font-semibold">
                            Done
                        </Button>
                    </div>
                )}
            </DialogContent>
        </Dialog>
    );
}
