import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';

@Injectable()
export class WebhookSignatureGuard implements CanActivate {
  private readonly logger = new Logger(WebhookSignatureGuard.name);
  private readonly webhookSecret: string;
  private readonly environment: string;

  constructor(private readonly configService: ConfigService) {
    this.webhookSecret = this.configService.get<string>('MOMO_WEBHOOK_SECRET') || '';
    this.environment = this.configService.get<string>('MOMO_ENVIRONMENT') || 'sandbox';
  }

  canActivate(context: ExecutionContext): boolean {
    if (this.environment === 'sandbox') {
      this.logger.log('Sandbox mode: Skipping webhook signature verification');
      return true;
    }

    if (!this.webhookSecret) {
      this.logger.error(
        'MOMO_WEBHOOK_SECRET not configured in production environment. Rejecting webhook.',
      );
      throw new UnauthorizedException(
        'Webhook authentication not configured. Contact system administrator.',
      );
    }

    const request = context.switchToHttp().getRequest<{
      headers: Record<string, string>;
      body: Record<string, unknown>;
      rawBody?: string;
    }>();
    const signature = request.headers['x-signature'] || request.headers['x-momo-signature'];

    if (!signature) {
      this.logger.warn('Webhook signature missing in request headers');
      throw new UnauthorizedException('Webhook signature missing');
    }

    if (!request.rawBody) {
      this.logger.error(
        'Raw body not captured. Ensure body-parser verify callback is configured in main.ts',
      );
      throw new UnauthorizedException('Webhook verification failed: raw body missing');
    }

    const isValid = this.verifySignature(request.rawBody, signature);

    if (!isValid) {
      this.logger.error('Invalid webhook signature');
      throw new UnauthorizedException('Invalid webhook signature');
    }

    this.logger.log('Webhook signature verified successfully');
    return true;
  }

  private verifySignature(payload: string, signature: string): boolean {
    try {
      const expectedSignature = crypto
        .createHmac('sha256', this.webhookSecret)
        .update(payload)
        .digest('hex');

      // Checking length first to avoid timingSafeEqual throwing on mismatch
      if (signature.length !== expectedSignature.length) {
        return false;
      }

      // timing-safe comparison to prevent timing attacks
      return crypto.timingSafeEqual(
        Buffer.from(signature, 'hex'),
        Buffer.from(expectedSignature, 'hex'),
      );
    } catch (error) {
      this.logger.error('Error verifying webhook signature', error);
      return false;
    }
  }
}
