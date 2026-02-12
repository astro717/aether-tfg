import {
  Controller,
  Get,
  Patch,
  Delete,
  Param,
  Query,
  UseGuards,
  Request,
  NotFoundException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { NotificationsService } from './notifications.service';

interface AuthenticatedRequest {
  user: {
    id: string;
  };
}

@Controller('notifications')
@UseGuards(AuthGuard('jwt'))
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) { }

  /**
   * GET /notifications
   * Get paginated notifications for the current user
   */
  @Get()
  async findAll(
    @Request() req: AuthenticatedRequest,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.notificationsService.findAll(req.user.id, {
      page: page ? parseInt(page, 10) : undefined,
      pageSize: pageSize ? parseInt(pageSize, 10) : undefined,
    });
  }

  /**
   * GET /notifications/unread-count
   * Get unread notification count
   */
  @Get('unread-count')
  async getUnreadCount(@Request() req: AuthenticatedRequest) {
    return this.notificationsService.getUnreadCount(req.user.id);
  }

  /**
   * PATCH /notifications/:id/read
   * Mark a single notification as read
   */
  @Patch(':id/read')
  async markAsRead(@Request() req: AuthenticatedRequest, @Param('id') id: string) {
    const result = await this.notificationsService.markAsRead(id, req.user.id);
    if (!result) {
      throw new NotFoundException('Notification not found');
    }
    return result;
  }

  /**
   * PATCH /notifications/read-all
   * Mark all notifications as read
   */
  @Patch('read-all')
  async markAllAsRead(@Request() req: AuthenticatedRequest) {
    return this.notificationsService.markAllAsRead(req.user.id);
  }

  /**
   * DELETE /notifications/:id
   * Delete a notification
   */
  @Delete(':id')
  async delete(@Request() req: AuthenticatedRequest, @Param('id') id: string) {
    const result = await this.notificationsService.delete(id, req.user.id);
    if (!result) {
      throw new NotFoundException('Notification not found');
    }
    return { deleted: true };
  }

  /**
   * DELETE /notifications
   * Delete all notifications
   */
  @Delete()
  async deleteAll(@Request() req: AuthenticatedRequest) {
    return this.notificationsService.deleteAll(req.user.id);
  }
}
