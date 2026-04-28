import { Injectable, Logger } from '@nestjs/common';
import { PaymentsService } from '../payments/payments.service';
import { MoMoWebhookDto } from './dto';

@Injectable()
export class WebhooksService {
  private readonly logger = new Logger(WebhooksService.name);

  constructor(private readonly paymentsService: PaymentsService) {}

  /**
   * process mtn webhook
   */
  async processMoMoWebhook(webhookData: MoMoWebhookDto) {
    this.logger.log(`Processing MTN MoMo webhook: ${JSON.stringify(webhookData)}`);

    try {
      const result = await this.paymentsService.processWebhook({
        transactionRef: webhookData.transactionRef,
        status: webhookData.status,
        amount: webhookData.amount,
        reason: webhookData.reason,
      });

      this.logger.log(
        `Webhook processed successfully. Transaction: ${webhookData.transactionRef}, Idempotent: ${result.idempotent || false}`,
      );

      return result;
    } catch (error) {
      this.logger.error(
        `Failed to process webhook for transaction ${webhookData.transactionRef}`,
        error instanceof Error ? error.stack : String(error),
      );
      throw error;
    }
  }
}
