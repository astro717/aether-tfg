import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Bell, CheckCheck, MessageSquare, AtSign, ClipboardList, X, Trash2, Clock, Check } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useNotifications } from '../context/NotificationsContext';
import type { Notification, NotificationType } from '../api/notificationsApi';

interface NotificationsPopoverProps {
  isCollapsed?: boolean;
}

export function NotificationsPopover({ isCollapsed = false }: NotificationsPopoverProps) {
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const [coords, setCoords] = useState({ top: 0, left: 0 });
  const anchorRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const {
    notifications,
    unreadCount,
    isLoading,
    fetchNotifications,
    markAsRead,
    markAllAsRead,
    clearAll,
    removeNotification,
  } = useNotifications();

  // Fetch notifications when popover opens
  useEffect(() => {
    if (isOpen) {
      fetchNotifications(1);
    }
  }, [isOpen, fetchNotifications]);

  // Update coordinates when opening
  useEffect(() => {
    if (isOpen && anchorRef.current) {
      const rect = anchorRef.current.getBoundingClientRect();
      const popoverWidth = 400;
      const margin = 16;
      // Anchor to the left edge of the button, but ensure it doesn't overflow viewport
      const idealLeft = rect.left;
      const maxLeft = window.innerWidth - popoverWidth - margin;
      setCoords({
        top: rect.bottom + 8,
        left: Math.max(margin, Math.min(idealLeft, maxLeft)),
      });
    }
  }, [isOpen]);

  // Close on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      // Check if click is inside anchor or popover
      if (
        anchorRef.current && anchorRef.current.contains(event.target as Node) ||
        popoverRef.current && popoverRef.current.contains(event.target as Node)
      ) {
        return;
      }
      setIsOpen(false);
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  const handleNotificationClick = async (notification: Notification) => {
    // Mark as read
    if (!notification.read_at) {
      await markAsRead(notification.id);
    }

    // Navigate based on entity type
    if (notification.entity_type === 'task' && notification.entity_id) {
      navigate(`/tasks/${notification.entity_id}`);
    } else if (notification.entity_type === 'message' && notification.actor_id) {
      navigate(`/messages?user=${notification.actor_id}`);
    }

    setIsOpen(false);
  };

  const getNotificationIcon = (type: NotificationType) => {
    switch (type) {
      case 'TASK_ASSIGNED':
        return <ClipboardList size={16} className="text-blue-500" />;
      case 'TASK_COMMENT':
        return <MessageSquare size={16} className="text-green-500" />;
      case 'TASK_DEADLINE':
        return <Clock size={16} className="text-red-500" />;
      case 'MENTION':
        return <AtSign size={16} className="text-purple-500" />;
      case 'MESSAGE':
        return <MessageSquare size={16} className="text-gray-500" />;
      default:
        return <Bell size={16} className="text-gray-500" />;
    }
  };

  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  return (
    <>
      {/* Bell Button */}
      <button
        ref={anchorRef}
        onClick={() => setIsOpen(!isOpen)}
        className={`
          relative flex items-center justify-center group transition-all duration-200
          ${isCollapsed ? 'w-10 h-10' : 'w-10 h-10'}
          rounded-xl hover:bg-gray-100 dark:hover:bg-zinc-800
        `}
        title="Notifications"
      >
        <Bell
          size={20}
          className="text-gray-500 dark:text-gray-400 group-hover:text-gray-700 dark:group-hover:text-gray-300 transition-colors"
        />
        {/* Badge */}
        <AnimatePresence>
          {unreadCount > 0 && (
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0 }}
              className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] flex items-center justify-center px-1 rounded-full bg-red-500 text-white text-[10px] font-semibold shadow-sm"
            >
              {unreadCount > 99 ? '99+' : unreadCount}
            </motion.div>
          )}
        </AnimatePresence>
      </button>

      {/* Popover via Portal */}
      {createPortal(
        <AnimatePresence>
          {isOpen && (
            <motion.div
              ref={popoverRef}
              initial={{ opacity: 0, y: -10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.95 }}
              transition={{ duration: 0.15, ease: 'easeOut' }}
              style={{
                top: coords.top,
                left: coords.left,
                position: 'fixed'
              }}
              className="w-[400px] max-h-[480px] bg-white dark:bg-zinc-900 rounded-2xl shadow-xl border border-gray-200 dark:border-zinc-800 overflow-hidden z-[9999]"
            >
              {/* Header */}
              <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-zinc-800 bg-white/50 dark:bg-zinc-900/50 backdrop-blur-sm sticky top-0 z-10">
                <h3 className="font-semibold text-gray-900 dark:text-white">Notifications</h3>
                <div className="flex items-center gap-2">
                  {notifications.length > 0 && (
                    <button
                      onClick={clearAll}
                      className="flex items-center gap-1.5 text-xs text-red-500 hover:text-red-600 dark:text-red-400 dark:hover:text-red-300 transition-colors mr-2"
                      title="Clear all notifications"
                    >
                      <Trash2 size={14} />
                      Clear all
                    </button>
                  )}
                  {unreadCount > 0 && (
                    <button
                      onClick={markAllAsRead}
                      className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors"
                    >
                      <CheckCheck size={14} />
                      Read all
                    </button>
                  )}
                  <button
                    onClick={() => setIsOpen(false)}
                    className="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors"
                  >
                    <X size={16} className="text-gray-400" />
                  </button>
                </div>
              </div>

              {/* Notifications List */}
              <div className="overflow-y-auto max-h-[400px]">
                {isLoading && notifications.length === 0 ? (
                  <div className="flex items-center justify-center py-12">
                    <div className="w-6 h-6 border-2 border-gray-200 border-t-gray-600 rounded-full animate-spin" />
                  </div>
                ) : notifications.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 px-4">
                    <div className="w-12 h-12 rounded-full bg-gray-100 dark:bg-zinc-800 flex items-center justify-center mb-3">
                      <Bell size={24} className="text-gray-400" />
                    </div>
                    <p className="text-gray-500 dark:text-gray-400 text-sm">No notifications yet</p>
                  </div>
                ) : (
                  <div className="divide-y divide-gray-50 dark:divide-zinc-800">
                    {notifications.map((notification, index) => (
                      <motion.div
                        key={notification.id}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: index * 0.03 }}
                      >
                        <NotificationItem
                          notification={notification}
                          onClick={() => handleNotificationClick(notification)}
                          onRemove={(e) => {
                            e.stopPropagation();
                            removeNotification(notification.id);
                          }}
                          onMarkAsRead={(e) => {
                            e.stopPropagation();
                            markAsRead(notification.id);
                          }}
                          getIcon={getNotificationIcon}
                          formatTime={formatTimeAgo}
                        />
                      </motion.div>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>,
        document.body
      )}
    </>
  );
}

interface NotificationItemProps {
  notification: Notification;
  onClick: () => void;
  onRemove: (e: React.MouseEvent) => void;
  onMarkAsRead: (e: React.MouseEvent) => void;
  getIcon: (type: NotificationType) => React.ReactNode;
  formatTime: (date: string) => string;
}

function NotificationItem({ notification, onClick, onRemove, onMarkAsRead, getIcon, formatTime }: NotificationItemProps) {
  const isUnread = !notification.read_at;

  return (
    <div className="group relative">
      <button
        onClick={onClick}
        className={`
            w-full flex items-start gap-3 px-4 py-3 text-left transition-colors
            ${isUnread
            ? 'bg-blue-50/50 dark:bg-blue-500/5 hover:bg-blue-50 dark:hover:bg-blue-500/10'
            : 'hover:bg-gray-50 dark:hover:bg-zinc-800/50'
          }
        `}
      >
        {/* Avatar with icon overlay */}
        <div className="relative flex-shrink-0">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-gray-200 to-gray-300 dark:from-zinc-600 dark:to-zinc-700 flex items-center justify-center text-sm font-semibold text-gray-600 dark:text-gray-300">
            {notification.actor?.username?.charAt(0).toUpperCase() || '?'}
          </div>
          <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-white dark:bg-zinc-900 flex items-center justify-center shadow-sm border border-gray-100 dark:border-zinc-700">
            {getIcon(notification.type)}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0 pr-2">
          <div className="flex items-start gap-2">
            <p className={`text-sm flex-1 ${isUnread ? 'font-semibold text-gray-900 dark:text-white' : 'text-gray-700 dark:text-gray-300'}`}>
              {notification.title}
            </p>
          </div>
          {notification.content && (
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5 line-clamp-2">
              {notification.content}
            </p>
          )}
          {notification.actor && (
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
              by {notification.actor.username}
            </p>
          )}
        </div>

        {/* Right section: timestamp + unread dot (hidden on hover) */}
        <div className="flex items-center gap-2 flex-shrink-0 transition-opacity duration-150 group-hover:opacity-0">
          <span className="text-[11px] text-gray-400 dark:text-gray-500">
            {formatTime(notification.created_at)}
          </span>
          {isUnread && (
            <div className="w-2 h-2 rounded-full bg-blue-500" />
          )}
        </div>
      </button>

      {/* Action Bar (appears on hover, replaces timestamp area) */}
      <div className="absolute top-1/2 -translate-y-1/2 right-3 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-150 bg-white dark:bg-zinc-800 shadow-md rounded-xl px-1.5 py-1 border border-gray-200 dark:border-zinc-600">
        {/* Mark as Read Button - only shows for unread */}
        {isUnread && (
          <button
            onClick={onMarkAsRead}
            className="p-2 text-gray-500 hover:text-green-600 hover:bg-green-50 dark:text-gray-400 dark:hover:text-green-400 dark:hover:bg-green-900/30 rounded-lg transition-colors"
            title="Mark as read"
          >
            <Check size={15} strokeWidth={2.5} />
          </button>
        )}
        {/* Delete Button */}
        <button
          onClick={onRemove}
          className="p-2 text-gray-500 hover:text-red-500 hover:bg-red-50 dark:text-gray-400 dark:hover:text-red-400 dark:hover:bg-red-900/30 rounded-lg transition-colors"
          title="Remove notification"
        >
          <Trash2 size={15} />
        </button>
      </div>
    </div>
  );
}
