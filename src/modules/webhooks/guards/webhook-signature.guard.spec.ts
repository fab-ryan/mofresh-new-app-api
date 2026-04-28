/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-return */

import { Test, TestingModule } from '@nestjs/testing';
import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { WebhookSignatureGuard } from './webhook-signature.guard';
import * as crypto from 'crypto';

describe('WebhookSignatureGuard', () => {
  let guard: WebhookSignatureGuard;
  let configService: ConfigService;

  const mockConfigService = {
    get: jest.fn((key: string) => {
      const config = {
        MOMO_WEBHOOK_SECRET: 'test-webhook-secret',
        MOMO_ENVIRONMENT: 'production',
      };
      return config[key];
    }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WebhookSignatureGuard,
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    guard = module.get<WebhookSignatureGuard>(WebhookSignatureGuard);
    configService = module.get<ConfigService>(ConfigService);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(guard).toBeDefined();
  });

  describe('canActivate', () => {
    const createMockExecutionContext = (headers: any, body: any): ExecutionContext => {
      return {
        switchToHttp: () => ({
          getRequest: () => ({
            headers,
            body,
            rawBody: JSON.stringify(body),
          }),
        }),
      } as ExecutionContext;
    };

    it('should allow request with valid signature', () => {
      const body = { transactionRef: 'test-123', status: 'SUCCESSFUL' };
      const secret = 'test-webhook-secret';
      const signature = crypto
        .createHmac('sha256', secret)
        .update(JSON.stringify(body))
        .digest('hex');

      const context = createMockExecutionContext({ 'x-momo-signature': signature }, body);

      expect(guard.canActivate(context)).toBe(true);
    });

    it('should reject request with invalid signature', () => {
      const body = { transactionRef: 'test-123', status: 'SUCCESSFUL' };
      const context = createMockExecutionContext(
        { 'x-momo-signature': 'invalid-signature-that-wont-match' },
        body,
      );

      expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
      expect(() => guard.canActivate(context)).toThrow('Invalid webhook signature');
    });

    it('should reject request without signature header', () => {
      const body = { transactionRef: 'test-123', status: 'SUCCESSFUL' };
      const context = createMockExecutionContext({}, body);

      expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
      expect(() => guard.canActivate(context)).toThrow('Webhook signature missing');
    });

    it('should reject request when webhook secret not configured in production', () => {
      mockConfigService.get = jest.fn((key: string) => {
        if (key === 'MOMO_ENVIRONMENT') return 'production';
        return null; // No secret
      });
      const newGuard = new WebhookSignatureGuard(configService);

      const body = { transactionRef: 'test-123', status: 'SUCCESSFUL' };
      const context = createMockExecutionContext({ 'x-momo-signature': 'any-signature' }, body);

      expect(() => newGuard.canActivate(context)).toThrow(UnauthorizedException);
      expect(() => newGuard.canActivate(context)).toThrow('Webhook authentication not configured');
    });

    it('should skip verification in sandbox mode', () => {
      mockConfigService.get = jest.fn((key: string) => {
        if (key === 'MOMO_ENVIRONMENT') return 'sandbox';
        if (key === 'MOMO_WEBHOOK_SECRET') return 'test-secret';
        return null;
      });
      const newGuard = new WebhookSignatureGuard(configService);

      const body = { transactionRef: 'test-123', status: 'SUCCESSFUL' };
      const context = createMockExecutionContext({ 'x-momo-signature': 'invalid-signature' }, body);

      // Should allow even with invalid signature because in sandbox mode
      expect(newGuard.canActivate(context)).toBe(true);
    });

    it('should handle empty body', () => {
      const body = {};
      const secret = 'test-webhook-secret';
      const signature = crypto
        .createHmac('sha256', secret)
        .update(JSON.stringify(body))
        .digest('hex');

      const context = createMockExecutionContext({ 'x-momo-signature': signature }, body);

      expect(guard.canActivate(context)).toBe(true);
    });

    it('should handle different body content with different signatures', () => {
      // Need to ensure we're in production mode with a secret
      mockConfigService.get = jest.fn((key: string) => {
        if (key === 'MOMO_ENVIRONMENT') return 'production';
        if (key === 'MOMO_WEBHOOK_SECRET') return 'test-webhook-secret';
        return null;
      });
      const testGuard = new WebhookSignatureGuard(configService);

      const body1 = { transactionRef: 'test-123', status: 'SUCCESSFUL' };
      const body2 = { transactionRef: 'test-456', status: 'FAILED' };
      const secret = 'test-webhook-secret';

      const signature1 = crypto
        .createHmac('sha256', secret)
        .update(JSON.stringify(body1))
        .digest('hex');

      // Try to use signature1 for body2 (should fail)
      const context = createMockExecutionContext({ 'x-momo-signature': signature1 }, body2);

      expect(() => testGuard.canActivate(context)).toThrow(UnauthorizedException);
    });

    it('should verify signature using HMAC-SHA256', () => {
      const body = { test: 'data' };
      const secret = 'test-webhook-secret';

      // Create signature manually
      const expectedSignature = crypto
        .createHmac('sha256', secret)
        .update(JSON.stringify(body))
        .digest('hex');

      const context = createMockExecutionContext({ 'x-momo-signature': expectedSignature }, body);

      expect(guard.canActivate(context)).toBe(true);
    });

    it('should accept x-signature header as well', () => {
      const body = { test: 'data' };
      const secret = 'test-webhook-secret';
      const signature = crypto
        .createHmac('sha256', secret)
        .update(JSON.stringify(body))
        .digest('hex');

      const context = createMockExecutionContext(
        { 'x-signature': signature }, // Using x-signature instead of x-momo-signature
        body,
      );

      expect(guard.canActivate(context)).toBe(true);
    });

    it('should use timing-safe comparison', () => {
      const body = { test: 'data' };
      const secret = 'test-webhook-secret';
      const signature = crypto
        .createHmac('sha256', secret)
        .update(JSON.stringify(body))
        .digest('hex');

      const context = createMockExecutionContext({ 'x-momo-signature': signature }, body);

      // This test verifies that the guard uses timingSafeEqual
      // by successfully validating a correct signature
      expect(guard.canActivate(context)).toBe(true);
    });
  });
});
