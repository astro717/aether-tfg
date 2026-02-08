import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
import { MessagesService } from './messages.service';
import { SendMessageDto } from './dto/send-message.dto';
import { UploadUrlDto } from './dto/upload-url.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import type { users as User } from '@prisma/client';

@UseGuards(JwtAuthGuard)
@Controller('messages')
export class MessagesController {
  constructor(private readonly messagesService: MessagesService) {}

  /**
   * GET /messages/conversations
   * Get list of conversations (grouped by user) with unread counts.
   */
  @Get('conversations')
  async getConversations(@CurrentUser() user: User) {
    return this.messagesService.getConversations(user.id);
  }

  /**
   * GET /messages/unread
   * Get total unread message count for current user.
   */
  @Get('unread')
  async getUnreadCount(@CurrentUser() user: User) {
    return this.messagesService.getUnreadCount(user.id);
  }

  /**
   * GET /messages/:userId
   * Get chat history with a specific user.
   */
  @Get(':userId')
  async getMessages(
    @Param('userId', new ParseUUIDPipe()) userId: string,
    @CurrentUser() user: User,
  ) {
    return this.messagesService.getMessages(user.id, userId);
  }

  /**
   * POST /messages/upload-url
   * Generate a signed upload URL for file uploads.
   */
  @Post('upload-url')
  async getUploadUrl(@Body() dto: UploadUrlDto) {
    return this.messagesService.createUploadUrl(dto);
  }

  /**
   * POST /messages
   * Send a message { receiverId, content }
   */
  @Post()
  async sendMessage(
    @Body() dto: SendMessageDto,
    @CurrentUser() user: User,
  ) {
    return this.messagesService.sendMessage(user.id, dto);
  }

  /**
   * PATCH /messages/:userId/read
   * Mark all messages from a user as read.
   */
  @Patch(':userId/read')
  async markAsRead(
    @Param('userId', new ParseUUIDPipe()) userId: string,
    @CurrentUser() user: User,
  ) {
    return this.messagesService.markAsRead(user.id, userId);
  }
}
