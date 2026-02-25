import { useState, useEffect } from 'react';
import { AlertTriangle, Info, X, Zap, Heart, Sparkles } from 'lucide-react';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useNotifications, useMarkNotificationAsRead } from '@/services/notificationsApi';
import { cn } from '@/lib/utils';

export function HealthAlertTriggers() {
    const { data: notifications = [] } = useNotifications(20);
    const markAsRead = useMarkNotificationAsRead();

    const [criticalNotif, setCriticalNotif] = useState<any | null>(null);
    const [showCriticalModal, setShowCriticalModal] = useState(false);

    // Find most recent unread critical and high alerts
    const unreadCritical = notifications.find(n => n.severity === 'critical' && !n.read);
    const unreadHigh = notifications.find(n => n.severity === 'high' && !n.read);

    useEffect(() => {
        if (unreadCritical && !showCriticalModal) {
            setCriticalNotif(unreadCritical);
            setShowCriticalModal(true);
        }
    }, [unreadCritical, showCriticalModal]);

    const handleAcknowledgeCritical = () => {
        if (criticalNotif) {
            markAsRead.mutate(criticalNotif.id);
            setShowCriticalModal(false);
            setCriticalNotif(null);
        }
    };

    return (
        <>
            {/* High Severity Banner */}
            {unreadHigh && (
                <Alert className="mb-4 border-amber-500/50 bg-amber-500/10 text-amber-900 border-l-4">
                    <Heart className="h-4 w-4 text-amber-600" />
                    <AlertTitle className="text-xs font-bold uppercase tracking-tight text-amber-700">Health Pattern Alert</AlertTitle>
                    <AlertDescription className="text-xs mt-1 flex items-center justify-between gap-4">
                        <span className="leading-relaxed">{unreadHigh.message}</span>
                        <Button
                            size="sm"
                            variant="outline"
                            className="h-7 px-2 text-[10px] border-amber-500/30 bg-amber-500/5 hover:bg-amber-500/10 text-amber-700"
                            onClick={() => markAsRead.mutate(unreadHigh.id)}
                        >
                            Dismiss
                        </Button>
                    </AlertDescription>
                </Alert>
            )}

            {/* Critical Severity Modal */}
            <Dialog open={showCriticalModal} onOpenChange={(open) => !open && handleAcknowledgeCritical()}>
                <DialogContent className="sm:max-w-[425px] border-rose-500/20 shadow-2xl shadow-rose-900/20">
                    <DialogHeader className="flex flex-col items-center text-center space-y-3">
                        <div className="w-12 h-12 rounded-full bg-rose-500/10 flex items-center justify-center animate-pulse">
                            <AlertTriangle className="w-6 h-6 text-rose-500" />
                        </div>
                        <DialogTitle className="text-rose-600 font-bold text-xl uppercase tracking-tight">
                            {criticalNotif?.title || "Critical Health Alert"}
                        </DialogTitle>
                        <DialogDescription className="text-slate-600 font-medium leading-relaxed">
                            {criticalNotif?.message}
                        </DialogDescription>
                    </DialogHeader>

                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 flex items-start gap-3">
                        <div className="w-8 h-8 rounded-lg bg-violet-500/10 flex items-center justify-center shrink-0">
                            <Sparkles className="w-4 h-4 text-violet-500" />
                        </div>
                        <div>
                            <p className="text-[11px] font-bold text-slate-800 uppercase tracking-tight">Coach Guidance</p>
                            <p className="text-xs text-slate-600 mt-0.5 leading-relaxed">
                                Please monitor your symptoms closely and consider contacting your healthcare provider if you feel unwell.
                            </p>
                        </div>
                    </div>

                    <DialogFooter className="mt-6">
                        <Button
                            className="w-full bg-rose-600 hover:bg-rose-700 text-white font-bold h-11 rounded-xl shadow-lg shadow-rose-900/20"
                            onClick={handleAcknowledgeCritical}
                        >
                            I Understand & Acknowledge
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}
