import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { PaymentsService } from './payments.service';
import { PaymentsController } from './payments.controller';
import { InvoicesModule } from '../invoices/invoices.module';
import { MtnMomoService } from './services/mtn-momo.service';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [
    InvoicesModule,
    PassportModule.register({ defaultStrategy: 'jwt' }),
    AuthModule,
  ],
  providers: [PaymentsService, MtnMomoService],
  controllers: [PaymentsController],
  exports: [PaymentsService],
})
export class PaymentsModule {}
