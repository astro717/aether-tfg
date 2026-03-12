import { Module } from '@nestjs/common';
import { KanbanHeartbeatService } from './kanban-heartbeat.service';
import { PrismaModule } from '../prisma.module';

@Module({
    imports: [PrismaModule],
    providers: [KanbanHeartbeatService],
})
export class KanbanHeartbeatModule {}
