import { Module } from '@nestjs/common';
import { TasksController } from './tasks.controller';
import { TasksService } from './tasks.service';
import { PrismaModule } from '../prisma.module';
import { PassportModule } from '@nestjs/passport';
import { MessagesModule } from '../messages/messages.module';

@Module({
  imports: [PrismaModule, PassportModule, MessagesModule],
  controllers: [TasksController],
  providers: [TasksService],
})
export class TasksModule {}
