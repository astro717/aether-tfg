const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

export type NotificationType = 'TASK_ASSIGNED' | 'TASK_COMMENT' | 'MENTION' | 'MESSAGE';

export interface NotificationUser {
  id: string;
  username: string;
  email: string;
}

export interface Notification {
  id: string;
  user_id: string;
  actor_id: string | null;
  type: NotificationType;
  title: string;
  content: string | null;
  entity_id: string | null;
  entity_type: 'task' | 'message' | null;
  read_at: string | null;
  created_at: string;
  actor: NotificationUser | null;
}

export interface NotificationsResponse {
  items: Notification[];
  total: number;
  page: number;
  pageSize: number;
}

export interface UnreadCountResponse {
  unreadCount: number;
}

export interface MarkAllAsReadResponse {
  markedAsRead: number;
}

class NotificationsApi {
  private getAuthHeaders() {
    const token = localStorage.getItem('token');
    return {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    };
  }

  /**
   * GET /notifications
   * Get paginated notifications for the current user.
   */
  async getNotifications(page = 1, pageSize = 20): Promise<NotificationsResponse> {
    const response = await fetch(
      `${API_BASE_URL}/notifications?page=${page}&pageSize=${pageSize}`,
      { headers: this.getAuthHeaders() }
    );
    if (!response.ok) throw new Error('Failed to fetch notifications');
    return response.json();
  }

  /**
   * GET /notifications/unread-count
   * Get unread notification count.
   */
  async getUnreadCount(): Promise<UnreadCountResponse> {
    const response = await fetch(
      `${API_BASE_URL}/notifications/unread-count`,
      { headers: this.getAuthHeaders() }
    );
    if (!response.ok) throw new Error('Failed to fetch unread count');
    return response.json();
  }

  /**
   * PATCH /notifications/:id/read
   * Mark a single notification as read.
   */
  async markAsRead(notificationId: string): Promise<Notification> {
    const response = await fetch(
      `${API_BASE_URL}/notifications/${notificationId}/read`,
      {
        method: 'PATCH',
        headers: this.getAuthHeaders(),
      }
    );
    if (!response.ok) throw new Error('Failed to mark notification as read');
    return response.json();
  }

  /**
   * PATCH /notifications/read-all
   * Mark all notifications as read.
   */
  async markAllAsRead(): Promise<MarkAllAsReadResponse> {
    const response = await fetch(
      `${API_BASE_URL}/notifications/read-all`,
      {
        method: 'PATCH',
        headers: this.getAuthHeaders(),
      }
    );
    if (!response.ok) throw new Error('Failed to mark all notifications as read');
    return response.json();
  }

  /**
   * DELETE /notifications/:id
   * Delete a notification.
   */
  async deleteNotification(notificationId: string): Promise<{ deleted: boolean }> {
    const response = await fetch(
      `${API_BASE_URL}/notifications/${notificationId}`,
      {
        method: 'DELETE',
        headers: this.getAuthHeaders(),
      }
    );
    if (!response.ok) throw new Error('Failed to delete notification');
    return response.json();
  }
}

export const notificationsApi = new NotificationsApi();
