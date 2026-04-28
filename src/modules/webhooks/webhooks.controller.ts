import { Controller, Post, Body, HttpCode, HttpStatus, UseGuards, Logger } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiExcludeEndpoint } from '@nestjs/swagger';
import { WebhooksService } from './webhooks.service';
import { WebhookSignatureGuard } from './guards/webhook-signature.guard';
import { MoMoWebhookDto } from './dto';

@ApiTags('Webhooks')
@Controller('webhooks')
export class WebhooksController {
  private readonly logger = new Logger(WebhooksController.name);

  constructor(private readonly webhooksService: WebhooksService) {}

  @Post('momo')
  @HttpCode(HttpStatus.OK)
  @UseGuards(WebhookSignatureGuard)
  @ApiOperation({
    summary: 'MTN MoMo webhook endpoint',
    description:
      'Receives payment status callbacks from MTN MoMo. This endpoint is public but requires signature verification.',
  })
  @ApiResponse({ status: 200, description: 'Webhook processed successfully' })
  @ApiResponse({ status: 401, description: 'Invalid webhook signature' })
  @ApiExcludeEndpoint(false)
  async handleMoMoWebhook(@Body() webhookData: MoMoWebhookDto) {
    this.logger.log(`Received MTN MoMo webhook: ${webhookData.transactionRef}`);

    const result = await this.webhooksService.processMoMoWebhook(webhookData);

    return {
      status: 'success',
      message: 'Webhook processed',
      ...result,
    };
  }
}
