import { createContext, useContext, useState, useEffect, useCallback, useRef, type ReactNode } from 'react';
import { notificationsApi, type Notification, type NotificationsResponse } from '../api/notificationsApi';
import { useAuth } from '../../auth/context/AuthContext';
import { useToast } from '../../../components/ui/Toast';
import { useSettings } from '../../settings/context/SettingsContext';

interface NotificationsContextType {
  notifications: Notification[];
  unreadCount: number;
  isLoading: boolean;
  totalNotifications: number;
  fetchNotifications: (page?: number) => Promise<void>;
  markAsRead: (notificationId: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  refreshUnreadCount: () => Promise<void>;
  playNotificationSound: (type?: 'default' | 'critical') => void;
  clearAll: () => Promise<void>;
  removeNotification: (id: string) => Promise<void>;
}

const NotificationsContext = createContext<NotificationsContextType | null>(null);

const POLLING_INTERVAL = 30000; // 30 seconds

export function NotificationsProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const { showToast } = useToast();
  const { soundSettings } = useSettings();

  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [totalNotifications, setTotalNotifications] = useState(0);
  // Audio refs for preloading and control
  const notificationAudioRef = useRef<HTMLAudioElement | null>(null);
  const criticalAudioRef = useRef<HTMLAudioElement | null>(null);
  const lastPlayedRef = useRef<number>(0);
  const hasInitialized = useRef(false);

  // Initialize and update Audio objects when settings change
  useEffect(() => {
    // Message/Notification Sound
    if (!notificationAudioRef.current) {
      notificationAudioRef.current = new Audio(`/sounds/${soundSettings.notificationSound}`);
    } else if (!notificationAudioRef.current.src.endsWith(soundSettings.notificationSound)) {
      notificationAudioRef.current.src = `/sounds/${soundSettings.notificationSound}`;
      notificationAudioRef.current.load();
    }
    notificationAudioRef.current.volume = soundSettings.volume;

    // Critical Alert Sound
    if (!criticalAudioRef.current) {
      criticalAudioRef.current = new Audio(`/sounds/${soundSettings.criticalSound}`);
    } else if (!criticalAudioRef.current.src.endsWith(soundSettings.criticalSound)) {
      criticalAudioRef.current.src = `/sounds/${soundSettings.criticalSound}`;
      criticalAudioRef.current.load();
    }
    criticalAudioRef.current.volume = soundSettings.volume;
  }, [soundSettings.notificationSound, soundSettings.criticalSound, soundSettings.volume]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      notificationAudioRef.current?.pause();
      criticalAudioRef.current?.pause();
    };
  }, []);

  const playNotificationSound = useCallback((type: 'default' | 'critical' = 'default') => {
    const now = Date.now();
    // Rate limit: prevent playing more than once every 2 seconds
    if (now - lastPlayedRef.current < 2000) {
      return;
    }

    try {
      const audio = type === 'critical' ? criticalAudioRef.current : notificationAudioRef.current;

      if (audio) {
        // Reset timestamp to 0 to handle overlaps/restarts immediately
        audio.currentTime = 0;
        // Ensure volume is up to date (though effect handles it, this is safe)
        if (audio.volume !== soundSettings.volume) {
          audio.volume = soundSettings.volume;
        }

        const playPromise = audio.play();
        if (playPromise !== undefined) {
          playPromise.catch(e => {
            // Auto-play policy or load error
            console.log('Audio play failed:', e);
          });
        }

        lastPlayedRef.current = now;
      }
    } catch (e) {
      console.error('Error playing sound:', e);
    }
  }, [soundSettings.volume]);

  const refreshUnreadCount = useCallback(async () => {
    if (!user) return;
    try {
      const { unreadCount: count } = await notificationsApi.getUnreadCount();

      // If count increased, show toast and play sound
      // (Only if we have initialized, to avoid spam on load)
      if (hasInitialized.current && count > unreadCount) {
        playNotificationSound();

        // Fetch the latest to show in toast
        const response = await notificationsApi.getNotifications(1, 1);
        if (response.items.length > 0) {
          const latest = response.items[0];
          showToast({
            type: 'info',
            title: latest.title,
            message: latest.content || 'New notification',
            onClick: () => {
              // Navigation handled by Toast onClick or manual logic? 
            }
          });
        }
      }

      setUnreadCount(count);
    } catch (err) {
      console.error('Error fetching unread count:', err);
    }
  }, [user, unreadCount, playNotificationSound, showToast]);

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

      // Update unread count based on notifications (fallback)
      if (page === 1) {
        const unread = response.items.filter(n => !n.read_at).length;
        if (unread !== unreadCount) {
          setUnreadCount(unread);
        }
      }
    } catch (err) {
      console.error('Error fetching notifications:', err);
    } finally {
      setIsLoading(false);
    }
  }, [user, unreadCount]);

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
      showToast('Failed to mark as read', 'error');
    }
  }, [showToast]);

  const markAllAsRead = useCallback(async () => {
    try {
      await notificationsApi.markAllAsRead();
      setNotifications(prev =>
        prev.map(n => ({ ...n, read_at: n.read_at || new Date().toISOString() }))
      );
      setUnreadCount(0);
      showToast('All notifications marked as read', 'success');
    } catch (err) {
      console.error('Error marking all notifications as read:', err);
      showToast('Failed to mark all as read', 'error');
    }
  }, [showToast]);

  const clearAll = useCallback(async () => {
    try {
      // Optimistic update
      const prevNotifications = [...notifications];
      setNotifications([]);
      setUnreadCount(0);
      setTotalNotifications(0);

      await notificationsApi.deleteAllNotifications();
      showToast('All notifications cleared', 'success');
    } catch (err) {
      console.error('Error clearing notifications:', err);
      showToast('Failed to clear notifications', 'error');
      // Revert optimism if needed, but usually a re-fetch is better or just error toast
      fetchNotifications(1);
    }
  }, [notifications, showToast, fetchNotifications]);

  const removeNotification = useCallback(async (id: string) => {
    try {
      // Optimistic update
      setNotifications(prev => prev.filter(n => n.id !== id));
      // If it was unread, decrement count
      const wasUnread = notifications.find(n => n.id === id && !n.read_at);
      if (wasUnread) {
        setUnreadCount(prev => Math.max(0, prev - 1));
      }
      setTotalNotifications(prev => Math.max(0, prev - 1));

      await notificationsApi.deleteNotification(id);
    } catch (err) {
      console.error('Error removing notification:', err);
      showToast('Failed to remove notification', 'error');
      // Revert optimism if needed
    }
  }, [notifications, showToast]);

  // Initial fetch
  useEffect(() => {
    if (user && !hasInitialized.current) {
      hasInitialized.current = true;
      refreshUnreadCount();
      // Also fetch initial list? Optional.
      fetchNotifications(1);
    }
  }, [user, refreshUnreadCount, fetchNotifications]);

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
        playNotificationSound,
        clearAll,
        removeNotification,
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
