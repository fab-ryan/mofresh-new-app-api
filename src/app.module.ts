import { Module } from '@nestjs/common';
import { ThrottlerModule } from '@nestjs/throttler';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { DatabaseModule } from './database/database.module';
import { ConfigModule } from './config/config.module';
import { CommonModule } from './common/common.module';
import { AuthModule } from './modules/auth/auth.module';
import { SitesModule } from './modules/sites/sites.module';
import { ColdRoomsModule } from './modules/cold-rooms/cold-rooms.module';
import { ColdAssetsModule } from './modules/cold-assets/cold-assets.module';
import { ProductsModule } from './modules/products/products.module';
import { StockMovementsModule } from './modules/stock-movements/stock-movements.module';
import { OrdersModule } from './modules/orders/orders.module';
import { InvoicesModule } from './modules/invoices/invoices.module';
import { PaymentsModule } from './modules/payments/payments.module';
import { RentalsModule } from './modules/rentals/rentals.module';
import { ReportsModule } from './modules/reports/reports.module';
import { AuditLogsModule } from './modules/audit-logs/audit-logs.module';
import { WebhooksModule } from './modules/webhooks/webhooks.module';
import { UsersModule } from './modules/users/users.module';
import { MailModule } from './modules/mail/mail.module';
import { SeederModule } from './modules/seeder/seeder.module';

@Module({
  imports: [
    ConfigModule,
    ThrottlerModule.forRoot([
      {
        ttl: parseInt(process.env.THROTTLE_TTL || '60', 10) * 1000,
        limit: parseInt(process.env.THROTTLE_LIMIT || '100', 10),
      },
    ]),
    DatabaseModule,
    CommonModule,
    AuthModule,
    UsersModule,
    SitesModule,
    ColdRoomsModule,
    ColdAssetsModule,
    ProductsModule,
    StockMovementsModule,
    OrdersModule,
    InvoicesModule,
    PaymentsModule,
    RentalsModule,
    ReportsModule,
    AuditLogsModule,
    WebhooksModule,
    MailModule,
    SeederModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
