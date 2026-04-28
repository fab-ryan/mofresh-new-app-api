import { Module } from '@nestjs/common';
import { WebhooksController } from './webhooks.controller';
import { WebhooksService } from './webhooks.service';
import { PaymentsModule } from '../payments/payments.module';
import { WebhookSignatureGuard } from './guards/webhook-signature.guard';

@Module({
  imports: [PaymentsModule],
  controllers: [WebhooksController],
  providers: [WebhooksService, WebhookSignatureGuard],
  exports: [WebhooksService],
})
export class WebhooksModule {}
