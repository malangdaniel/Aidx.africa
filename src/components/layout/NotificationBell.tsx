import { useState } from 'react';
import { Bell, Sparkles, CheckCircle2 } from 'lucide-react';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { useNotifications, useUnreadNotificationsCount, useMarkNotificationAsRead, useMarkAllNotificationsAsRead } from '@/services/notificationsApi';
import { formatDistanceToNow } from 'date-fns';

export function NotificationBell() {
    const { data: notifications = [] } = useNotifications(5);
    const { data: unreadCount = 0 } = useUnreadNotificationsCount();
    const markAsRead = useMarkNotificationAsRead();
    const markAllAsRead = useMarkAllNotificationsAsRead();

    const getSeverityColor = (severity: string) => {
        switch (severity) {
            case 'critical': return 'bg-rose-500/10 text-rose-500 border-rose-500/20';
            case 'high': return 'bg-amber-500/10 text-amber-600 border-amber-500/20';
            case 'attention': return 'bg-amber-500/5 text-amber-500 border-amber-500/10';
            default: return 'bg-slate-500/10 text-slate-500 border-slate-500/20';
        }
    };

    const getTimeAgo = (dateStr: string) => {
        try {
            return formatDistanceToNow(new Date(dateStr), { addSuffix: true });
        } catch {
            return 'just now';
        }
    };

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="relative text-muted-foreground hover:text-foreground">
                    <Bell className="w-5 h-5" />
                    {unreadCount > 0 && (
                        <Badge className="absolute -top-1 -right-1 h-4 min-w-[16px] px-1 bg-rose-500 text-white text-[10px] flex items-center justify-center border-none">
                            {unreadCount > 9 ? '9+' : unreadCount}
                        </Badge>
                    )}
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-80 p-0" align="end">
                <div className="flex items-center justify-between p-4 border-b">
                    <DropdownMenuLabel className="font-bold text-sm">Notifications</DropdownMenuLabel>
                    {unreadCount > 0 && (
                        <Button
                            variant="ghost"
                            size="sm"
                            className="h-auto px-2 py-1 text-[11px] text-violet-600 hover:text-violet-700 hover:bg-violet-50"
                            onClick={() => markAllAsRead.mutate()}
                        >
                            Mark all read
                        </Button>
                    )}
                </div>

                <ScrollArea className="h-[350px]">
                    {notifications.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
                            <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mb-3">
                                <Bell className="w-6 h-6 text-slate-300" />
                            </div>
                            <p className="text-sm font-medium text-slate-900">All caught up!</p>
                            <p className="text-xs text-slate-500 mt-1">No new health alerts for you right now.</p>
                        </div>
                    ) : (
                        <div className="flex flex-col">
                            {notifications.map((notif) => (
                                <div
                                    key={notif.id}
                                    className={cn(
                                        "p-4 border-b last:border-0 transition-colors cursor-pointer hover:bg-slate-50/50",
                                        !notif.read && "bg-violet-50/30"
                                    )}
                                    onClick={() => !notif.read && markAsRead.mutate(notif.id)}
                                >
                                    <div className="flex gap-3">
                                        <div className={cn(
                                            "mt-1 w-2 h-2 rounded-full shrink-0",
                                            !notif.read ? "bg-violet-500" : "bg-transparent"
                                        )} />
                                        <div className="flex-1 space-y-1">
                                            <div className="flex items-center justify-between gap-2">
                                                <span className="text-[11px] font-bold text-slate-900 uppercase tracking-tight">
                                                    {notif.title}
                                                </span>
                                                <Badge variant="outline" className={cn("text-[8px] px-1 py-0 h-4 border uppercase", getSeverityColor(notif.severity))}>
                                                    {notif.severity}
                                                </Badge>
                                            </div>
                                            <p className="text-xs text-slate-600 leading-relaxed line-clamp-2">
                                                {notif.message}
                                            </p>
                                            <p className="text-[10px] text-slate-400">
                                                {getTimeAgo(notif.created_at)}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </ScrollArea>

                <div className="p-2 border-t">
                    <Button
                        variant="ghost"
                        className="w-full text-xs font-semibold text-violet-600 hover:text-violet-700 hover:bg-violet-50 h-8"
                        asChild
                    >
                        <a href="/notifications">View all alerts</a>
                    </Button>
                </div>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
