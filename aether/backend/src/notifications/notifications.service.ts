import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { CreateNotificationDto } from './dto/create-notification.dto';

@Injectable()
export class NotificationsService {
  constructor(private prisma: PrismaService) {}

  /**
   * Create a new notification
   */
  async create(dto: CreateNotificationDto) {
    return this.prisma.notifications.create({
      data: {
        user_id: dto.user_id,
        actor_id: dto.actor_id,
        type: dto.type,
        title: dto.title,
        content: dto.content,
        entity_id: dto.entity_id,
        entity_type: dto.entity_type,
      },
      include: {
        actor: {
          select: {
            id: true,
            username: true,
            email: true,
          },
        },
      },
    });
  }

  /**
   * Get all notifications for a user (paginated)
   */
  async findAll(userId: string, opts?: { page?: number; pageSize?: number }) {
    const page = Math.max(1, opts?.page ?? 1);
    const pageSize = Math.min(50, Math.max(1, opts?.pageSize ?? 20));

    const [items, total] = await this.prisma.$transaction([
      this.prisma.notifications.findMany({
        where: { user_id: userId },
        include: {
          actor: {
            select: {
              id: true,
              username: true,
              email: true,
            },
          },
        },
        orderBy: { created_at: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.notifications.count({ where: { user_id: userId } }),
    ]);

    return { items, total, page, pageSize };
  }

  /**
   * Mark a notification as read
   */
  async markAsRead(notificationId: string, userId: string) {
    // Verify ownership and update
    const notification = await this.prisma.notifications.findFirst({
      where: {
        id: notificationId,
        user_id: userId,
      },
    });

    if (!notification) {
      return null;
    }

    return this.prisma.notifications.update({
      where: { id: notificationId },
      data: { read_at: new Date() },
    });
  }

  /**
   * Mark all notifications as read for a user
   */
  async markAllAsRead(userId: string) {
    const result = await this.prisma.notifications.updateMany({
      where: {
        user_id: userId,
        read_at: null,
      },
      data: { read_at: new Date() },
    });

    return { markedAsRead: result.count };
  }

  /**
   * Get unread count for a user
   */
  async getUnreadCount(userId: string) {
    const count = await this.prisma.notifications.count({
      where: {
        user_id: userId,
        read_at: null,
      },
    });

    return { unreadCount: count };
  }

  /**
   * Delete a notification
   */
  async delete(notificationId: string, userId: string) {
    const notification = await this.prisma.notifications.findFirst({
      where: {
        id: notificationId,
        user_id: userId,
      },
    });

    if (!notification) {
      return null;
    }

    return this.prisma.notifications.delete({
      where: { id: notificationId },
    });
  }
}
