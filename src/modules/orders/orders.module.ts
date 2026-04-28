import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module';
import { OrdersService } from './orders.service';
import { OrdersController } from './orders.controller';
import { StockMovementsModule } from '../stock-movements/stock-movements.module';
import { InvoicesModule } from '../invoices/invoices.module';
import { AuditLogsModule } from '../audit-logs/audit-logs.module';

@Module({
  imports: [DatabaseModule, StockMovementsModule, InvoicesModule, AuditLogsModule],
  controllers: [OrdersController],
  providers: [OrdersService],
  exports: [OrdersService],
})
export class OrdersModule {}
