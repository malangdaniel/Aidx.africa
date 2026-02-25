import { supabase } from '@/integrations/supabase/client';

export type NotificationSeverity = 'attention' | 'high' | 'critical';

export interface Notification {
    id: string;
    user_id: string;
    severity: NotificationSeverity;
    title: string;
    message: string;
    created_at: string;
    read: boolean;
    related_score_id: string | null;
}

export const notificationsService = {
    async getNotifications(userId: string, limit = 20, offset = 0): Promise<Notification[]> {
        const { data, error } = await supabase
            .from('notifications')
            .select('*')
            .eq('user_id', userId)
            .order('created_at', { ascending: false })
            .range(offset, offset + limit - 1);

        if (error) {
            console.error('Error fetching notifications:', error);
            throw error;
        }
        return data as Notification[];
    },

    async getUnreadCount(userId: string): Promise<number> {
        const { count, error } = await supabase
            .from('notifications')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', userId)
            .eq('read', false);

        if (error) {
            console.error('Error fetching unread count:', error);
            throw error;
        }
        return count || 0;
    },

    async markAsRead(notificationId: string): Promise<void> {
        const { error } = await supabase
            .from('notifications')
            .update({ read: true })
            .eq('id', notificationId);

        if (error) {
            console.error('Error marking notification as read:', error);
            throw error;
        }
    },

    async markAllAsRead(userId: string): Promise<void> {
        const { error } = await supabase
            .from('notifications')
            .update({ read: true })
            .eq('user_id', userId)
            .eq('read', false);

        if (error) {
            console.error('Error marking all notifications as read:', error);
            throw error;
        }
    }
};
