const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

// Types matching backend response structure
export interface MessageUser {
  id: string;
  username: string;
  email: string;
}

export type MessageType = 'text' | 'comment_notification';

export interface CommentNotificationMetadata {
  taskId: string;
  taskTitle: string;
}

export interface Message {
  id: string;
  sender_id: string;
  receiver_id: string;
  content: string;
  type?: MessageType;
  metadata?: CommentNotificationMetadata | null;
  created_at: string;
  read_at: string | null;
  sender: MessageUser;
}

export interface Conversation {
  user: MessageUser;
  lastMessage: Message;
  unreadCount: number;
}

export interface MessagesResponse {
  user: MessageUser;
  messages: Message[];
}

export interface SendMessagePayload {
  receiverId: string;
  content: string;
}

export interface MarkAsReadResponse {
  markedAsRead: number;
}

export interface UnreadCountResponse {
  unreadCount: number;
}

class MessagingApi {
  private getAuthHeaders() {
    const token = localStorage.getItem('token');
    return {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    };
  }

  /**
   * GET /messages/conversations
   * Get list of conversations (grouped by user) with unread counts.
   */
  async getConversations(): Promise<Conversation[]> {
    const response = await fetch(
      `${API_BASE_URL}/messages/conversations`,
      { headers: this.getAuthHeaders() }
    );
    if (!response.ok) throw new Error('Failed to fetch conversations');
    return response.json();
  }

  /**
   * GET /messages/:userId
   * Get chat history with a specific user.
   */
  async getMessages(userId: string): Promise<MessagesResponse> {
    const response = await fetch(
      `${API_BASE_URL}/messages/${userId}`,
      { headers: this.getAuthHeaders() }
    );
    if (!response.ok) throw new Error('Failed to fetch messages');
    return response.json();
  }

  /**
   * POST /messages
   * Send a message { receiverId, content }
   */
  async sendMessage(payload: SendMessagePayload): Promise<Message> {
    const response = await fetch(
      `${API_BASE_URL}/messages`,
      {
        method: 'POST',
        headers: this.getAuthHeaders(),
        body: JSON.stringify(payload),
      }
    );
    if (!response.ok) throw new Error('Failed to send message');
    return response.json();
  }

  /**
   * PATCH /messages/:userId/read
   * Mark all messages from a user as read.
   */
  async markAsRead(userId: string): Promise<MarkAsReadResponse> {
    const response = await fetch(
      `${API_BASE_URL}/messages/${userId}/read`,
      {
        method: 'PATCH',
        headers: this.getAuthHeaders(),
      }
    );
    if (!response.ok) throw new Error('Failed to mark messages as read');
    return response.json();
  }

  /**
   * GET /messages/unread
   * Get total unread message count.
   */
  async getUnreadCount(): Promise<UnreadCountResponse> {
    const response = await fetch(
      `${API_BASE_URL}/messages/unread`,
      { headers: this.getAuthHeaders() }
    );
    if (!response.ok) throw new Error('Failed to fetch unread count');
    return response.json();
  }
}

export const messagingApi = new MessagingApi();
