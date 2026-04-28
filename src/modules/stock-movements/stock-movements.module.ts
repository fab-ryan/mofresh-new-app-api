import { Module } from '@nestjs/common';
import { StockMovementsController } from './stock-movement.controller';
import { StockMovementsService } from './stock-movements.service';
import { AuditLogsModule } from '../audit-logs/audit-logs.module';

@Module({
  imports: [AuditLogsModule],
  controllers: [StockMovementsController],
  providers: [StockMovementsService],
  exports: [StockMovementsService],
})
export class StockMovementsModule {}
