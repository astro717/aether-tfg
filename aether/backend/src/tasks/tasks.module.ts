import { Module } from '@nestjs/common';
import { TasksController } from './tasks.controller';
import { TasksService } from './tasks.service';
import { PrismaModule } from '../prisma.module';
import { PassportModule } from '@nestjs/passport';
import { MessagesModule } from '../messages/messages.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { EmailModule } from '../email/email.module';

@Module({
  imports: [PrismaModule, PassportModule, MessagesModule, NotificationsModule, EmailModule],
  controllers: [TasksController],
  providers: [TasksService],
})
export class TasksModule {}
