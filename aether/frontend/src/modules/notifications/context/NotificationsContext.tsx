import { createContext, useContext, useState, useEffect, useCallback, useRef, type ReactNode } from 'react';
import { notificationsApi, type Notification, type NotificationsResponse } from '../api/notificationsApi';
import { useAuth } from '../../auth/context/AuthContext';

interface NotificationsContextType {
  notifications: Notification[];
  unreadCount: number;
  isLoading: boolean;
  totalNotifications: number;
  fetchNotifications: (page?: number) => Promise<void>;
  markAsRead: (notificationId: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  refreshUnreadCount: () => Promise<void>;
}

const NotificationsContext = createContext<NotificationsContextType | null>(null);

const POLLING_INTERVAL = 30000; // 30 seconds

export function NotificationsProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [totalNotifications, setTotalNotifications] = useState(0);
  const hasInitialized = useRef(false);

  const refreshUnreadCount = useCallback(async () => {
    if (!user) return;
    try {
      const { unreadCount: count } = await notificationsApi.getUnreadCount();
      setUnreadCount(count);
    } catch (err) {
      console.error('Error fetching unread count:', err);
    }
  }, [user]);

  const fetchNotifications = useCallback(async (page = 1) => {
    if (!user) return;
    try {
      setIsLoading(true);
      const response: NotificationsResponse = await notificationsApi.getNotifications(page, 20);
      if (page === 1) {
        setNotifications(response.items);
      } else {
        setNotifications(prev => [...prev, ...response.items]);
      }
      setTotalNotifications(response.total);
      // Update unread count based on notifications
      const unread = response.items.filter(n => !n.read_at).length;
      if (page === 1) {
        setUnreadCount(unread);
      }
    } catch (err) {
      console.error('Error fetching notifications:', err);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  const markAsRead = useCallback(async (notificationId: string) => {
    try {
      await notificationsApi.markAsRead(notificationId);
      setNotifications(prev =>
        prev.map(n =>
          n.id === notificationId ? { ...n, read_at: new Date().toISOString() } : n
        )
      );
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (err) {
      console.error('Error marking notification as read:', err);
    }
  }, []);

  const markAllAsRead = useCallback(async () => {
    try {
      await notificationsApi.markAllAsRead();
      setNotifications(prev =>
        prev.map(n => ({ ...n, read_at: n.read_at || new Date().toISOString() }))
      );
      setUnreadCount(0);
    } catch (err) {
      console.error('Error marking all notifications as read:', err);
    }
  }, []);

  // Initial fetch
  useEffect(() => {
    if (user && !hasInitialized.current) {
      hasInitialized.current = true;
      refreshUnreadCount();
    }
  }, [user, refreshUnreadCount]);

  // Polling for unread count
  useEffect(() => {
    if (!user) return;

    const interval = setInterval(() => {
      refreshUnreadCount();
    }, POLLING_INTERVAL);

    return () => clearInterval(interval);
  }, [user, refreshUnreadCount]);

  // Reset on logout
  useEffect(() => {
    if (!user) {
      setNotifications([]);
      setUnreadCount(0);
      setTotalNotifications(0);
      hasInitialized.current = false;
    }
  }, [user]);

  return (
    <NotificationsContext.Provider
      value={{
        notifications,
        unreadCount,
        isLoading,
        totalNotifications,
        fetchNotifications,
        markAsRead,
        markAllAsRead,
        refreshUnreadCount,
      }}
    >
      {children}
    </NotificationsContext.Provider>
  );
}

export function useNotifications() {
  const context = useContext(NotificationsContext);
  if (!context) {
    throw new Error('useNotifications must be used within a NotificationsProvider');
  }
  return context;
}
