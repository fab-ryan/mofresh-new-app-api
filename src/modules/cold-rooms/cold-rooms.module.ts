import { Module } from '@nestjs/common';
import { ColdRoomsController } from './cold-rooms.controller';
import { ColdRoomService } from './cold-rooms.service';
import { AuditLogsModule } from '../audit-logs/audit-logs.module';

@Module({
  imports: [AuditLogsModule],
  controllers: [ColdRoomsController],
  providers: [ColdRoomService],
  exports: [ColdRoomService],
})
export class ColdRoomsModule {}
