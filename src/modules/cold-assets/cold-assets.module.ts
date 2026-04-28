import { Module } from '@nestjs/common';
import { ColdAssetsController } from './cold-assets.controller';
import { ColdAssetsService } from './cold-assets.services';
import { DatabaseModule } from '@/database/database.module';
import { AuditLogsModule } from '../audit-logs/audit-logs.module';

@Module({
  imports: [DatabaseModule, AuditLogsModule],
  controllers: [ColdAssetsController],
  providers: [ColdAssetsService],
  exports: [ColdAssetsService],
})
export class ColdAssetsModule {}
