import { Badge } from '@/components/ui/badge';
import { ShieldCheck, Clock, CheckCircle2, RotateCcw, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';

export type ConsultationPaymentStatus =
    | 'pending'
    | 'escrowed'
    | 'released'
    | 'refunded'
    | 'failed';

const CONFIG: Record<
    ConsultationPaymentStatus,
    { label: string; hint: string; icon: typeof Clock; className: string }
> = {
    pending: {
        label: 'Awaiting payment',
        hint: 'Slot is held but not confirmed until payment clears.',
        icon: Clock,
        className: 'bg-muted text-muted-foreground border-border',
    },
    escrowed: {
        label: 'Paid · In escrow',
        hint: 'Slot confirmed. Funds are held safely until the consult is completed.',
        icon: ShieldCheck,
        className: 'bg-secondary text-secondary-foreground border-transparent',
    },
    released: {
        label: 'Paid out',
        hint: 'Consult completed and funds released to the doctor.',
        icon: CheckCircle2,
        className: 'bg-secondary text-secondary-foreground border-transparent',
    },
    refunded: {
        label: 'Refunded',
        hint: 'Payment was returned to your wallet.',
        icon: RotateCcw,
        className: 'bg-muted text-muted-foreground border-border',
    },
    failed: {
        label: 'Payment failed',
        hint: 'Slot is not confirmed. Please retry the payment.',
        icon: AlertTriangle,
        className: 'bg-destructive/10 text-destructive border-destructive/30',
    },
};

export const getPaymentStatusHint = (status?: string | null) =>
    CONFIG[(status as ConsultationPaymentStatus) ?? 'pending']?.hint ?? CONFIG.pending.hint;

interface Props {
    status?: string | null;
    className?: string;
}

export default function PaymentStatusBadge({ status, className }: Props) {
    const config = CONFIG[(status as ConsultationPaymentStatus) ?? 'pending'] ?? CONFIG.pending;
    const Icon = config.icon;

    return (
        <Badge variant="outline" className={cn('gap-1 font-medium', config.className, className)}>
            <Icon className="w-3 h-3" />
            {config.label}
        </Badge>
    );
}
