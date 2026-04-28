import { Module } from '@nestjs/common';
import { SitesController } from './sites.controller';
import { SitesService } from './sites.service';
import { PrismaService } from '../../database/prisma.service';

import { AuditLogsModule } from '../audit-logs/audit-logs.module';

@Module({
  imports: [AuditLogsModule],
  controllers: [SitesController],
  providers: [SitesService, PrismaService],
})
export class SitesModule {}
