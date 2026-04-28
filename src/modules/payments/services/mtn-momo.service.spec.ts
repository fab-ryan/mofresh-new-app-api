/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-return */

import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { MtnMomoService } from './mtn-momo.service';
import { BadRequestException, HttpException } from '@nestjs/common';
import axios from 'axios';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('MtnMomoService', () => {
  let service: MtnMomoService;
  let configService: ConfigService;

  const mockConfigService = {
    get: jest.fn((key: string) => {
      const config = {
        MOMO_API_USER: 'test-api-user',
        MOMO_API_KEY: 'test-api-key',
        MOMO_PRIMARY_KEY: 'test-primary-key',
        MOMO_API_URL: 'https://sandbox.momodeveloper.mtn.com',
        MOMO_CALLBACK_URL: 'https://test.com/webhook',
        MOMO_ENVIRONMENT: 'sandbox',
      };
      return config[key];
    }),
  };

  const mockAxiosInstance = {
    post: jest.fn(),
    get: jest.fn(),
    create: jest.fn(),
  };

  beforeEach(async () => {
    mockedAxios.create = jest.fn().mockReturnValue(mockAxiosInstance as any);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MtnMomoService,
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    service = module.get<MtnMomoService>(MtnMomoService);
    configService = module.get<ConfigService>(ConfigService);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('isConfigured', () => {
    it('should return true when all config is present', () => {
      expect(service.isConfigured()).toBe(true);
    });

    it('should return false when config is missing', () => {
      mockConfigService.get = jest.fn().mockReturnValue('');
      const newService = new MtnMomoService(configService);
      expect(newService.isConfigured()).toBe(false);
    });
  });

  describe('requestToPay', () => {
    const validParams = {
      amount: 100000,
      phoneNumber: '250788123456',
      externalId: 'INV-KIGALI-2026-00001',
      payerMessage: 'Payment for invoice',
      payeeNote: 'Invoice payment',
    };

    it('should successfully request payment', async () => {
      const referenceId = 'test-reference-id';
      mockAxiosInstance.post
        .mockResolvedValueOnce({
          data: { access_token: 'test-token', expires_in: 3600 },
        })
        .mockResolvedValueOnce({
          status: 202,
          headers: { 'x-reference-id': referenceId },
        });

      const result = await service.requestToPay(
        validParams.amount,
        validParams.phoneNumber,
        validParams.externalId,
        validParams.payerMessage,
        validParams.payeeNote,
      );

      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(0);
      expect(mockAxiosInstance.post).toHaveBeenCalledTimes(2);
    });

    it('should throw BadRequestException for invalid phone number', async () => {
      mockAxiosInstance.post.mockResolvedValueOnce({
        data: { access_token: 'test-token', expires_in: 3600 },
      });

      await expect(
        service.requestToPay(
          validParams.amount,
          '123', // Too short
          validParams.externalId,
          validParams.payerMessage,
          validParams.payeeNote,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should handle MTN API errors', async () => {
      mockAxiosInstance.post
        .mockResolvedValueOnce({
          data: { access_token: 'test-token', expires_in: 3600 },
        })
        .mockRejectedValueOnce({
          isAxiosError: true,
          response: {
            status: 400,
            data: { message: 'Invalid request' },
          },
        });

      await expect(
        service.requestToPay(
          validParams.amount,
          validParams.phoneNumber,
          validParams.externalId,
          validParams.payerMessage,
          validParams.payeeNote,
        ),
      ).rejects.toThrow(HttpException);
    });

    it('should handle network errors', async () => {
      mockAxiosInstance.post
        .mockResolvedValueOnce({
          data: { access_token: 'test-token', expires_in: 3600 },
        })
        .mockRejectedValueOnce(new Error('Network error'));

      await expect(
        service.requestToPay(
          validParams.amount,
          validParams.phoneNumber,
          validParams.externalId,
          validParams.payerMessage,
          validParams.payeeNote,
        ),
      ).rejects.toThrow();
    });
  });

  describe('getTransactionStatus', () => {
    const transactionRef = 'momo-ref-123';

    beforeEach(() => {
      mockAxiosInstance.post.mockResolvedValueOnce({
        data: { access_token: 'test-token', expires_in: 3600 },
      });
    });

    it('should get transaction status successfully', async () => {
      mockAxiosInstance.post.mockResolvedValueOnce({
        data: { access_token: 'test-token', expires_in: 3600 },
      });

      mockAxiosInstance.get.mockResolvedValueOnce({
        data: {
          status: 'SUCCESSFUL',
          amount: '100000',
          currency: 'RWF',
          externalId: 'INV-001',
          financialTransactionId: 'fin-123',
        },
      });

      const result = await service.getTransactionStatus(transactionRef);

      expect(result).toEqual({
        status: 'SUCCESSFUL',
        amount: '100000',
        currency: 'RWF',
        externalId: 'INV-001',
        financialTransactionId: 'fin-123',
      });

      expect(mockAxiosInstance.get).toHaveBeenCalledWith(
        `/collection/v1_0/requesttopay/${transactionRef}`,
        expect.any(Object),
      );
    });

    it('should handle failed transaction status', async () => {
      mockAxiosInstance.post.mockResolvedValueOnce({
        data: { access_token: 'test-token', expires_in: 3600 },
      });

      mockAxiosInstance.get.mockResolvedValueOnce({
        data: {
          status: 'FAILED',
          amount: '100000',
          currency: 'RWF',
          externalId: 'INV-001',
          reason: 'Insufficient funds',
        },
      });

      const result = await service.getTransactionStatus(transactionRef);

      expect(result.status).toBe('FAILED');
      expect(result.reason).toBe('Insufficient funds');
    });

    it('should handle pending transaction status', async () => {
      mockAxiosInstance.post.mockResolvedValueOnce({
        data: { access_token: 'test-token', expires_in: 3600 },
      });

      mockAxiosInstance.get.mockResolvedValueOnce({
        data: {
          status: 'PENDING',
          amount: '100000',
          currency: 'RWF',
          externalId: 'INV-001',
        },
      });

      const result = await service.getTransactionStatus(transactionRef);

      expect(result.status).toBe('PENDING');
    });

    it('should handle API errors when getting status', async () => {
      mockAxiosInstance.post.mockResolvedValueOnce({
        data: { access_token: 'test-token', expires_in: 3600 },
      });

      mockAxiosInstance.get.mockRejectedValueOnce({
        isAxiosError: true,
        response: {
          status: 404,
          data: { message: 'Transaction not found' },
        },
      });

      await expect(service.getTransactionStatus(transactionRef)).rejects.toThrow(HttpException);
    });
  });

  describe('configuration validation', () => {
    it('should be defined', () => {
      expect(service).toBeDefined();
    });
  });
});
