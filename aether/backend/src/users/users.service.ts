import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { UpdateNotificationSettingsDto } from './dto/update-notification-settings.dto';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) { }

  async findAll() {
    return this.prisma.users.findMany({
      select: {
        id: true,
        username: true,
        email: true,
        avatar_color: true,
        role: true,
        created_at: true,
      },
    });
  }

  async findOne(id: string) {
    const user = await this.prisma.users.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async remove(id: string) {
    const user = await this.prisma.users.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('User not found');
    return this.prisma.users.delete({ where: { id } });
  }

  /**
   * Get notification settings for a user
   */
  async getNotificationSettings(userId: string) {
    const user = await this.prisma.users.findUnique({
      where: { id: userId },
      select: {
        notify_email_enabled: true,
        notify_email_assignments: true,
        notify_email_comments: true,
        notify_email_mentions: true,
        notify_inapp_enabled: true,
        deadline_reminder_hours: true,
      },
    });

    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  /**
   * Update notification settings for a user
   */
  async updateNotificationSettings(userId: string, dto: UpdateNotificationSettingsDto) {
    const user = await this.prisma.users.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    return this.prisma.users.update({
      where: { id: userId },
      data: {
        ...(dto.notify_email_enabled !== undefined && { notify_email_enabled: dto.notify_email_enabled }),
        ...(dto.notify_email_assignments !== undefined && { notify_email_assignments: dto.notify_email_assignments }),
        ...(dto.notify_email_comments !== undefined && { notify_email_comments: dto.notify_email_comments }),
        ...(dto.notify_email_mentions !== undefined && { notify_email_mentions: dto.notify_email_mentions }),
        ...(dto.notify_inapp_enabled !== undefined && { notify_inapp_enabled: dto.notify_inapp_enabled }),
        ...(dto.deadline_reminder_hours !== undefined && { deadline_reminder_hours: dto.deadline_reminder_hours }),
      },
      select: {
        notify_email_enabled: true,
        notify_email_assignments: true,
        notify_email_comments: true,
        notify_email_mentions: true,
        notify_inapp_enabled: true,
        deadline_reminder_hours: true,
      },
    });
  }

  async updateProfile(userId: string, dto: any) {
    const user = await this.prisma.users.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    return this.prisma.users.update({
      where: { id: userId },
      data: {
        ...dto,
      },
      select: {
        id: true,
        username: true,
        email: true,
        avatar_color: true,
        // Add other profile fields here if they exist in schema
        // display_name: true,
        // job_title: true,
        // bio: true,
      }
    });
  }
}
