import { useState } from 'react';
import {
    Bell,
    Search,
    Filter,
    CheckCircle2,
    MoreVertical,
    ChevronLeft,
    ChevronRight,
    AlertTriangle,
    Heart,
    Zap,
    Shield
} from 'lucide-react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
    useNotifications,
    useMarkNotificationAsRead,
    useMarkAllNotificationsAsRead
} from '@/services/notificationsApi';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';

export default function NotificationsPage() {
    const [page, setPage] = useState(0);
    const [severityFilter, setSeverityFilter] = useState<string | null>(null);
    const limit = 15;

    const { data: notifications = [], isLoading } = useNotifications(limit, page * limit);
    const markAsRead = useMarkNotificationAsRead();
    const markAllAsRead = useMarkAllNotificationsAsRead();

    // Filter logic (client-side for now, could be API-driven later)
    const filtered = severityFilter
        ? notifications.filter(n => n.severity === severityFilter)
        : notifications;

    const getSeverityStyles = (severity: string) => {
        switch (severity) {
            case 'critical': return "border-l-4 border-l-rose-500 bg-rose-50/20";
            case 'high': return "border-l-4 border-l-amber-500 bg-amber-50/20";
            case 'attention': return "border-l-4 border-l-amber-400 bg-amber-50/10";
            default: return "";
        }
    };

    const getSeverityBadge = (severity: string) => {
        switch (severity) {
            case 'critical': return <Badge className="bg-rose-500 hover:bg-rose-600 border-none">Critical</Badge>;
            case 'high': return <Badge className="bg-amber-500 hover:bg-amber-600 border-none text-white">High Severity</Badge>;
            case 'attention': return <Badge variant="outline" className="text-amber-600 border-amber-200">Attention</Badge>;
            default: return <Badge variant="secondary">{severity}</Badge>;
        }
    };

    return (
        <DashboardLayout title="Health Notifications">
            <SEO
                title="Health Notifications | Sanari AI"
                description="Your Sanari AI health alerts: vitals trends, consultation reminders and medication order updates."
                path="/notifications"
                noindex
            />
            <div className="max-w-4xl mx-auto space-y-6 pb-20">

                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-2xl font-bold text-slate-900">Notifications</h1>
                        <p className="text-sm text-slate-500">Stay informed about your health patterns and stability.</p>
                    </div>
                    <div className="flex items-center gap-2">
                        <Button
                            variant="outline"
                            size="sm"
                            className="text-xs h-9"
                            onClick={() => markAllAsRead.mutate()}
                        >
                            Mark all as read
                        </Button>
                    </div>
                </div>

                <Card className="border-slate-200/60 shadow-sm overflow-hidden">
                    <CardHeader className="p-4 bg-slate-50 border-b flex flex-row items-center justify-between space-y-0 text-slate-700">
                        <div className="flex items-center gap-4">
                            <div className="flex items-center gap-1">
                                <Button
                                    variant={severityFilter === null ? "secondary" : "ghost"}
                                    size="sm"
                                    className="h-8 text-[11px] font-semibold"
                                    onClick={() => setSeverityFilter(null)}
                                >
                                    All
                                </Button>
                                <Button
                                    variant={severityFilter === 'critical' ? "secondary" : "ghost"}
                                    size="sm"
                                    className="h-8 text-[11px] font-semibold text-rose-600"
                                    onClick={() => setSeverityFilter('critical')}
                                >
                                    Critical
                                </Button>
                                <Button
                                    variant={severityFilter === 'high' ? "secondary" : "ghost"}
                                    size="sm"
                                    className="h-8 text-[11px] font-semibold text-amber-600"
                                    onClick={() => setSeverityFilter('high')}
                                >
                                    High
                                </Button>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="text-[11px] font-medium text-slate-400">Page {page + 1}</span>
                            <div className="flex items-center">
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7"
                                    disabled={page === 0}
                                    onClick={() => setPage(p => p - 1)}
                                >
                                    <ChevronLeft className="w-4 h-4" />
                                </Button>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7"
                                    disabled={notifications.length < limit}
                                    onClick={() => setPage(p => p + 1)}
                                >
                                    <ChevronRight className="w-4 h-4" />
                                </Button>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent className="p-0">
                        {isLoading ? (
                            <div className="p-12 text-center text-slate-400">Loading notifications...</div>
                        ) : filtered.length === 0 ? (
                            <div className="p-20 flex flex-col items-center justify-center text-center">
                                <div className="w-16 h-16 rounded-full bg-slate-50 flex items-center justify-center mb-4">
                                    <Bell className="w-8 h-8 text-slate-200" />
                                </div>
                                <h3 className="font-semibold text-slate-900">No notifications found</h3>
                                <p className="text-sm text-slate-500 max-w-xs mt-1">
                                    You're all caught up. New health alerts will appear here as they are generated.
                                </p>
                            </div>
                        ) : (
                            <div className="divide-y divide-slate-100">
                                {filtered.map((notif) => (
                                    <div
                                        key={notif.id}
                                        className={cn(
                                            "p-5 transition-all relative group",
                                            !notif.read ? "bg-white" : "bg-slate-50/30 opacity-80",
                                            getSeverityStyles(notif.severity)
                                        )}
                                    >
                                        <div className="flex gap-4">
                                            <div className={cn(
                                                "mt-1 w-10 h-10 rounded-xl flex items-center justify-center shrink-0",
                                                notif.severity === 'critical' ? "bg-rose-50 text-rose-500" :
                                                    notif.severity === 'high' ? "bg-amber-50 text-amber-500" :
                                                        "bg-blue-50 text-blue-500"
                                            )}>
                                                {notif.severity === 'critical' ? <AlertTriangle className="w-5 h-5" /> :
                                                    notif.severity === 'high' ? <Heart className="w-5 h-5" /> :
                                                        <Shield className="w-5 h-5" />}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-start justify-between gap-4 mb-1">
                                                    <div className="flex items-center gap-2">
                                                        <h3 className={cn(
                                                            "font-bold text-sm",
                                                            !notif.read ? "text-slate-900" : "text-slate-600"
                                                        )}>
                                                            {notif.title}
                                                        </h3>
                                                        {getSeverityBadge(notif.severity)}
                                                        {!notif.read && <Badge className="bg-violet-500 text-[9px] h-4 py-0 px-1 border-none uppercase">New</Badge>}
                                                    </div>
                                                    <span className="text-[11px] text-slate-400 whitespace-nowrap">
                                                        {format(new Date(notif.created_at), 'MMM d, h:mm a')}
                                                    </span>
                                                </div>
                                                <p className={cn(
                                                    "text-sm leading-relaxed max-w-2xl",
                                                    !notif.read ? "text-slate-700" : "text-slate-500"
                                                )}>
                                                    {notif.message}
                                                </p>

                                                <div className="mt-4 flex items-center gap-3">
                                                    {!notif.read && (
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            className="h-8 text-[11px] font-semibold text-violet-600 hover:text-violet-700 hover:bg-violet-50"
                                                            onClick={() => markAsRead.mutate(notif.id)}
                                                        >
                                                            <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                                                            Mark as read
                                                        </Button>
                                                    )}
                                                    {notif.related_score_id && (
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            className="h-8 text-[11px] font-semibold text-slate-500 hover:text-slate-900 hover:bg-slate-100"
                                                            asChild
                                                        >
                                                            <a href="/elite">View Scores</a>
                                                        </Button>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
        </DashboardLayout>
    );
}
