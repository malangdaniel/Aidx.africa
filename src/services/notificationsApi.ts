import {
    useQuery,
    useMutation,
    useQueryClient,
    type UseQueryResult,
} from '@tanstack/react-query';
import { notificationsService, type Notification } from './notificationsService';
import { useAuth } from '@/contexts/AuthContext';

export const notificationKeys = {
    all: ['notifications'] as const,
    list: (userId: string, limit: number, offset: number) => ['notifications', 'list', userId, limit, offset] as const,
    unreadCount: (userId: string) => ['notifications', 'unread', userId] as const,
};

export function useNotifications(limit = 20, offset = 0): UseQueryResult<Notification[]> {
    const { user } = useAuth();
    return useQuery({
        queryKey: notificationKeys.list(user?.id ?? '', limit, offset),
        queryFn: () => notificationsService.getNotifications(user!.id, limit, offset),
        enabled: !!user,
        staleTime: 1 * 60 * 1000, // 1 minute
        refetchInterval: 2 * 60 * 1000, // Auto-refresh every 2 mins
    });
}

export function useUnreadNotificationsCount(): UseQueryResult<number> {
    const { user } = useAuth();
    return useQuery({
        queryKey: notificationKeys.unreadCount(user?.id ?? ''),
        queryFn: () => notificationsService.getUnreadCount(user!.id),
        enabled: !!user,
        staleTime: 30 * 1000,
        refetchInterval: 1 * 60 * 1000,
    });
}

export function useMarkNotificationAsRead() {
    const { user } = useAuth();
    const qc = useQueryClient();

    return useMutation({
        mutationFn: (notificationId: string) => notificationsService.markAsRead(notificationId),
        onSuccess: () => {
            if (user) {
                qc.invalidateQueries({ queryKey: notificationKeys.all });
            }
        },
    });
}

export function useMarkAllNotificationsAsRead() {
    const { user } = useAuth();
    const qc = useQueryClient();

    return useMutation({
        mutationFn: () => notificationsService.markAllAsRead(user!.id),
        onSuccess: () => {
            if (user) {
                qc.invalidateQueries({ queryKey: notificationKeys.all });
            }
        },
    });
}
