import { Module } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { AuditLogsService } from './audit-logs.service';
import { AuditLogsController } from './audit-logs.controller';

@Module({
  imports: [],
  controllers: [AuditLogsController],
  providers: [AuditLogsService, PrismaService],
  exports: [AuditLogsService],
})
export class AuditLogsModule {}
