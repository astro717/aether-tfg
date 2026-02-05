import { Module } from '@nestjs/common';
import { MessagesController } from './messages.controller';
import { MessagesService } from './messages.service';
import { PrismaModule } from '../prisma.module';
import { PassportModule } from '@nestjs/passport';

@Module({
  imports: [PrismaModule, PassportModule],
  controllers: [MessagesController],
  providers: [MessagesService],
  exports: [MessagesService],
})
export class MessagesModule {}
