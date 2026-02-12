import { Injectable, NotFoundException, BadRequestException, Inject, forwardRef } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { SendMessageDto, AttachmentDto } from './dto/send-message.dto';
import { SupabaseService } from '../supabase/supabase.service';
import { UploadUrlDto, UploadUrlResponse } from './dto/upload-url.dto';
import { NotificationsService } from '../notifications/notifications.service';

const BUCKET_NAME = 'chat-uploads';

@Injectable()
export class MessagesService {
  constructor(
    private prisma: PrismaService,
    private supabase: SupabaseService,
    @Inject(forwardRef(() => NotificationsService))
    private notificationsService: NotificationsService,
  ) { }

  /**
   * Get all conversations for a user, grouped by the other participant.
   * Returns the latest message and unread count for each conversation.
   */
  async getConversations(userId: string) {
    // Get all messages where user is sender or receiver
    const messages = await this.prisma.messages.findMany({
      where: {
        OR: [
          { sender_id: userId },
          { receiver_id: userId },
        ],
      },
      include: {
        sender: {
          select: {
            id: true,
            username: true,
            email: true,
            avatar_color: true,
          },
        },
        receiver: {
          select: {
            id: true,
            username: true,
            email: true,
            avatar_color: true,
          },
        },
        attachments: true,
      },
      orderBy: {
        created_at: 'desc',
      },
    });

    // Group messages by the "other" user (conversation partner)
    const conversationsMap = new Map<string, {
      user: { id: string; username: string; email: string };
      lastMessage: typeof messages[0];
      unreadCount: number;
    }>();

    for (const message of messages) {
      const otherUserId = message.sender_id === userId
        ? message.receiver_id
        : message.sender_id;

      const otherUser = message.sender_id === userId
        ? message.receiver
        : message.sender;

      if (!conversationsMap.has(otherUserId)) {
        // Count unread messages from this user
        const unreadCount = messages.filter(
          m => m.sender_id === otherUserId &&
            m.receiver_id === userId &&
            !m.read_at
        ).length;

        conversationsMap.set(otherUserId, {
          user: otherUser,
          lastMessage: message,
          unreadCount,
        });
      }
    }

    // Convert map to array and sort by last message time
    const conversations = Array.from(conversationsMap.values())
      .sort((a, b) => {
        const timeA = a.lastMessage.created_at?.getTime() || 0;
        const timeB = b.lastMessage.created_at?.getTime() || 0;
        return timeB - timeA;
      });

    return conversations;
  }

  /**
   * Get chat history with a specific user.
   */
  async getMessages(currentUserId: string, otherUserId: string) {
    // Verify the other user exists
    const otherUser = await this.prisma.users.findUnique({
      where: { id: otherUserId },
      select: { id: true, username: true, email: true, avatar_color: true },
    });

    if (!otherUser) {
      throw new NotFoundException('User not found');
    }

    const messages = await this.prisma.messages.findMany({
      where: {
        OR: [
          { sender_id: currentUserId, receiver_id: otherUserId },
          { sender_id: otherUserId, receiver_id: currentUserId },
        ],
      },
      include: {
        sender: {
          select: {
            id: true,
            username: true,
            email: true,
            avatar_color: true,
          },
        },
        attachments: true,
      },
      orderBy: {
        created_at: 'asc',
      },
    });

    return {
      user: otherUser,
      messages,
    };
  }

  /**
   * Send a message to another user.
   */
  async sendMessage(senderId: string, dto: SendMessageDto) {
    // Verify receiver exists
    const receiver = await this.prisma.users.findUnique({
      where: { id: dto.receiverId },
    });

    if (!receiver) {
      throw new NotFoundException('Receiver not found');
    }

    // Don't allow sending messages to yourself
    if (senderId === dto.receiverId) {
      throw new BadRequestException('Cannot send messages to yourself');
    }

    // Must have either content or attachments
    if (!dto.content && (!dto.attachments || dto.attachments.length === 0)) {
      throw new BadRequestException('Message must have content or attachments');
    }

    const message = await this.prisma.messages.create({
      data: {
        sender_id: senderId,
        receiver_id: dto.receiverId,
        content: dto.content || null,
        attachments: dto.attachments && dto.attachments.length > 0
          ? {
            create: dto.attachments.map((att: AttachmentDto) => ({
              file_path: att.filePath,
              file_url: att.fileUrl,
              file_name: att.fileName,
              file_size: att.fileSize,
              file_type: att.fileType,
            })),
          }
          : undefined,
      },
      include: {
        sender: {
          select: {
            id: true,
            username: true,
            email: true,
            avatar_color: true,
          },
        },
        receiver: {
          select: {
            id: true,
            username: true,
            email: true,
            avatar_color: true,
          },
        },
        attachments: true,
      },
    });

    // Create a MESSAGE notification for the receiver
    await this.notificationsService.create({
      user_id: dto.receiverId,
      actor_id: senderId,
      type: 'MESSAGE',
      title: 'New Message',
      content: dto.content
        ? dto.content.length > 50
          ? dto.content.substring(0, 50) + '...'
          : dto.content
        : 'Sent an attachment',
      entity_id: message.id,
      entity_type: 'message',
    });

    return message;
  }

  /**
   * Create a comment notification message.
   * Used when someone comments on a task to notify the assignee.
   */
  async createCommentNotification(
    senderId: string,
    receiverId: string,
    content: string,
    taskId: string,
    taskTitle: string,
  ) {
    // Don't send notification if commenter is the assignee
    if (senderId === receiverId) {
      return null;
    }

    const message = await this.prisma.messages.create({
      data: {
        sender_id: senderId,
        receiver_id: receiverId,
        content,
        type: 'comment_notification',
        metadata: { taskId, taskTitle },
      },
      include: {
        sender: {
          select: {
            id: true,
            username: true,
            email: true,
            avatar_color: true,
          },
        },
        receiver: {
          select: {
            id: true,
            username: true,
            email: true,
            avatar_color: true,
          },
        },
      },
    });

    return message;
  }

  /**
   * Mark all messages from a specific user as read.
   */
  async markAsRead(currentUserId: string, otherUserId: string) {
    const result = await this.prisma.messages.updateMany({
      where: {
        sender_id: otherUserId,
        receiver_id: currentUserId,
        read_at: null,
      },
      data: {
        read_at: new Date(),
      },
    });

    return {
      markedAsRead: result.count,
    };
  }

  /**
   * Get total unread message count for a user.
   */
  async getUnreadCount(userId: string) {
    const count = await this.prisma.messages.count({
      where: {
        receiver_id: userId,
        read_at: null,
      },
    });

    return { unreadCount: count };
  }

  /**
   * Generate a signed upload URL for file uploads.
   * This allows authenticated app users to upload directly to Supabase Storage.
   */
  async createUploadUrl(dto: UploadUrlDto): Promise<UploadUrlResponse> {
    // Sanitize filename
    const sanitizedFilename = dto.filename
      .replace(/[^a-zA-Z0-9.-]/g, '_')
      .toLowerCase();

    // Create unique path with timestamp
    const timestamp = Date.now();
    const filePath = `messages/${timestamp}_${sanitizedFilename}`;

    // Generate signed upload URL
    const { signedUrl, token, path } = await this.supabase.createSignedUploadUrl(
      BUCKET_NAME,
      filePath,
    );

    // Get the public URL for the file
    const publicUrl = this.supabase.getPublicUrl(BUCKET_NAME, path);

    return {
      uploadUrl: signedUrl,
      publicUrl,
      filePath: path,
      token,
    };
  }
}
