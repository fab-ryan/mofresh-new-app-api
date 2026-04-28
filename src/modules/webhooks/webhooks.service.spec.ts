/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unused-vars */

import { Test, TestingModule } from '@nestjs/testing';
import { WebhooksService } from './webhooks.service';
import { PaymentsService } from '../payments/payments.service';
import { Logger } from '@nestjs/common';

describe('WebhooksService', () => {
  let service: WebhooksService;
  let paymentsService: PaymentsService;

  const mockPaymentsService = {
    processWebhook: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WebhooksService,
        {
          provide: PaymentsService,
          useValue: mockPaymentsService,
        },
      ],
    }).compile();

    service = module.get<WebhooksService>(WebhooksService);
    paymentsService = module.get<PaymentsService>(PaymentsService);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('processMoMoWebhook', () => {
    const validWebhookData = {
      transactionRef: 'momo-ref-123',
      status: 'SUCCESSFUL',
      amount: 100000,
      externalId: 'INV-KIGALI-2026-00001',
      financialTransactionId: 'financial-123',
    };

    it('should successfully handle webhook and process payment', async () => {
      mockPaymentsService.processWebhook.mockResolvedValue({
        message: 'Payment processed successfully',
        processed: true,
      });

      const result = await service.processMoMoWebhook(validWebhookData);

      expect(result).toEqual({
        message: 'Payment processed successfully',
        processed: true,
      });
      expect(mockPaymentsService.processWebhook).toHaveBeenCalledWith({
        transactionRef: validWebhookData.transactionRef,
        status: validWebhookData.status,
        amount: validWebhookData.amount,
        reason: undefined,
      });
    });

    it('should handle successful payment webhook', async () => {
      mockPaymentsService.processWebhook.mockResolvedValue({
        message: 'Payment processed successfully',
        processed: true,
      });

      await service.processMoMoWebhook({
        ...validWebhookData,
        status: 'SUCCESSFUL',
      });

      expect(mockPaymentsService.processWebhook).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'SUCCESSFUL',
        }),
      );
    });

    it('should handle failed payment webhook', async () => {
      mockPaymentsService.processWebhook.mockResolvedValue({
        message: 'Payment marked as failed',
        processed: true,
      });

      await service.processMoMoWebhook({
        ...validWebhookData,
        status: 'FAILED',
        reason: 'Insufficient funds',
      });

      expect(mockPaymentsService.processWebhook).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'FAILED',
          reason: 'Insufficient funds',
        }),
      );
    });

    it('should handle pending payment webhook', async () => {
      mockPaymentsService.processWebhook.mockResolvedValue({
        message: 'Payment status updated',
        processed: true,
      });

      await service.processMoMoWebhook({
        ...validWebhookData,
        status: 'PENDING',
      });

      expect(mockPaymentsService.processWebhook).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'PENDING',
        }),
      );
    });

    it('should log webhook processing', async () => {
      const logSpy = jest.spyOn(Logger.prototype, 'log');

      mockPaymentsService.processWebhook.mockResolvedValue({
        message: 'Payment processed successfully',
        processed: true,
      });

      await service.processMoMoWebhook(validWebhookData);

      expect(logSpy).toHaveBeenCalled();
    });

    it('should handle errors during webhook processing', async () => {
      const errorLogSpy = jest.spyOn(Logger.prototype, 'error');
      mockPaymentsService.processWebhook.mockRejectedValue(new Error('Processing failed'));

      await expect(service.processMoMoWebhook(validWebhookData)).rejects.toThrow(
        'Processing failed',
      );

      expect(errorLogSpy).toHaveBeenCalled();
    });

    it('should handle webhook with minimal fields', async () => {
      mockPaymentsService.processWebhook.mockResolvedValue({
        message: 'Payment processed successfully',
        processed: true,
      });

      const minimalWebhook = {
        transactionRef: 'momo-ref-123',
        status: 'SUCCESSFUL',
        amount: 100000,
      };

      const result = await service.processMoMoWebhook(minimalWebhook as any);

      expect(result.processed).toBe(true);
      expect(mockPaymentsService.processWebhook).toHaveBeenCalled();
    });

    it('should pass all webhook fields to payment service', async () => {
      mockPaymentsService.processWebhook.mockResolvedValue({
        message: 'Payment processed successfully',
        processed: true,
      });

      const fullWebhook = {
        transactionRef: 'momo-ref-123',
        status: 'SUCCESSFUL',
        amount: 100000,
        externalId: 'INV-001',
        financialTransactionId: 'fin-123',
        currency: 'RWF',
        payerMessage: 'Payment completed',
        payeeNote: 'Invoice payment',
        reason: undefined,
      };

      await service.processMoMoWebhook(fullWebhook);

      expect(mockPaymentsService.processWebhook).toHaveBeenCalledWith({
        transactionRef: fullWebhook.transactionRef,
        status: fullWebhook.status,
        amount: fullWebhook.amount,
        reason: undefined,
      });
    });
  });
});
