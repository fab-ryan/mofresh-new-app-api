/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unused-vars */

import { Test, TestingModule } from '@nestjs/testing';
import { PaymentsService } from './payments.service';
import { PrismaService } from '../../database/prisma.service';
import { InvoicesService } from '../invoices/invoices.service';
import { MtnMomoService } from './services/mtn-momo.service';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { PaymentStatus, PaymentMethod, InvoiceStatus } from '@prisma/client';

describe('PaymentsService', () => {
  let service: PaymentsService;
  let prismaService: PrismaService;
  let invoicesService: InvoicesService;
  let mtnMomoService: MtnMomoService;

  const mockInvoice = {
    id: 'invoice-1',
    invoiceNumber: 'INV-KIGALI-2026-00001',
    totalAmount: 100000,
    paidAmount: 0,
    status: InvoiceStatus.UNPAID,
    orderId: 'order-1',
    rentalId: null,
    clientId: 'client-1',
    siteId: 'site-1',
    subtotal: 84745.76,
    taxAmount: 15254.24,
    dueDate: new Date('2026-02-16'),
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockPayment = {
    id: 'payment-1',
    invoiceId: 'invoice-1',
    amount: 100000,
    paymentMethod: PaymentMethod.MOBILE_MONEY,
    status: PaymentStatus.PENDING,
    phoneNumber: '250788123456',
    momoTransactionRef: 'momo-ref-123',
    transactionDate: null,
    markedPaidBy: null,
    markedPaidAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockPrismaService = {
    payment: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
    },
    invoice: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    auditLog: {
      create: jest.fn(),
    },
    $transaction: jest.fn((callback) => callback(mockPrismaService)),
  };

  const mockInvoicesService = {
    findOne: jest.fn(),
    markPaid: jest.fn(),
  };

  const mockMtnMomoService = {
    isConfigured: jest.fn(),
    requestToPay: jest.fn(),
    getTransactionStatus: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaymentsService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: InvoicesService,
          useValue: mockInvoicesService,
        },
        {
          provide: MtnMomoService,
          useValue: mockMtnMomoService,
        },
      ],
    }).compile();

    service = module.get<PaymentsService>(PaymentsService);
    prismaService = module.get<PrismaService>(PrismaService);
    invoicesService = module.get<InvoicesService>(InvoicesService);
    mtnMomoService = module.get<MtnMomoService>(MtnMomoService);

    // Reset all mocks
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('initiatePayment', () => {
    it('should successfully initiate a payment', async () => {
      mockInvoicesService.findOne.mockResolvedValue(mockInvoice);
      mockMtnMomoService.isConfigured.mockReturnValue(true);
      mockMtnMomoService.requestToPay.mockResolvedValue('momo-ref-123');
      mockPrismaService.payment.create.mockResolvedValue(mockPayment);
      mockPrismaService.auditLog.create.mockResolvedValue({});

      const result = await service.initiatePayment('invoice-1', '250788123456', 'user-1');

      expect(result).toEqual({
        paymentId: mockPayment.id,
        momoTransactionRef: 'momo-ref-123',
        amount: mockPayment.amount,
        phoneNumber: mockPayment.phoneNumber,
        status: PaymentStatus.PENDING,
        message: 'Payment request sent to your phone. Please approve to complete payment.',
      });
      expect(mockInvoicesService.findOne).toHaveBeenCalledWith('invoice-1');
      expect(mockMtnMomoService.requestToPay).toHaveBeenCalledWith(
        100000,
        '250788123456',
        'INV-KIGALI-2026-00001',
        expect.any(String),
        expect.any(String),
      );
      expect(mockPrismaService.payment.create).toHaveBeenCalled();
      expect(mockPrismaService.auditLog.create).toHaveBeenCalled();
    });

    it('should throw NotFoundException if invoice not found', async () => {
      mockInvoicesService.findOne.mockResolvedValue(null);

      await expect(service.initiatePayment('invalid-id', '250788123456')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw BadRequestException if invoice is already paid', async () => {
      mockInvoicesService.findOne.mockResolvedValue({
        ...mockInvoice,
        status: InvoiceStatus.PAID,
      });

      await expect(service.initiatePayment('invoice-1', '250788123456')).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.initiatePayment('invoice-1', '250788123456')).rejects.toThrow(
        'Invoice is already paid',
      );
    });

    it('should throw BadRequestException if invoice is voided', async () => {
      mockInvoicesService.findOne.mockResolvedValue({
        ...mockInvoice,
        status: InvoiceStatus.VOID,
      });

      await expect(service.initiatePayment('invoice-1', '250788123456')).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.initiatePayment('invoice-1', '250788123456')).rejects.toThrow(
        'Cannot pay voided invoice',
      );
    });

    it('should throw BadRequestException if no outstanding balance', async () => {
      mockInvoicesService.findOne.mockResolvedValue({
        ...mockInvoice,
        paidAmount: 100000,
      });

      await expect(service.initiatePayment('invoice-1', '250788123456')).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.initiatePayment('invoice-1', '250788123456')).rejects.toThrow(
        'Invoice has no outstanding balance',
      );
    });

    it('should throw BadRequestException if MTN MoMo not configured', async () => {
      mockInvoicesService.findOne.mockResolvedValue(mockInvoice);
      mockMtnMomoService.isConfigured.mockReturnValue(false);

      await expect(service.initiatePayment('invoice-1', '250788123456')).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.initiatePayment('invoice-1', '250788123456')).rejects.toThrow(
        /MTN MoMo payment is not configured/,
      );
    });

    it('should calculate correct amount for partially paid invoice', async () => {
      mockInvoicesService.findOne.mockResolvedValue({
        ...mockInvoice,
        paidAmount: 50000,
      });
      mockMtnMomoService.isConfigured.mockReturnValue(true);
      mockMtnMomoService.requestToPay.mockResolvedValue('momo-ref-123');
      mockPrismaService.payment.create.mockResolvedValue({
        ...mockPayment,
        amount: 50000,
      });

      const result = await service.initiatePayment('invoice-1', '250788123456');

      expect(result.amount).toBe(50000);
      expect(mockMtnMomoService.requestToPay).toHaveBeenCalledWith(
        50000,
        expect.any(String),
        expect.any(String),
        expect.any(String),
        expect.any(String),
      );
    });

    it('should not create audit log if userId not provided', async () => {
      mockInvoicesService.findOne.mockResolvedValue(mockInvoice);
      mockMtnMomoService.isConfigured.mockReturnValue(true);
      mockMtnMomoService.requestToPay.mockResolvedValue('momo-ref-123');
      mockPrismaService.payment.create.mockResolvedValue(mockPayment);

      await service.initiatePayment('invoice-1', '250788123456');

      expect(mockPrismaService.auditLog.create).not.toHaveBeenCalled();
    });
  });

  describe('processWebhook', () => {
    const webhookData = {
      transactionRef: 'momo-ref-123',
      status: 'SUCCESSFUL',
      amount: 100000,
      externalId: 'external-123',
      financialTransactionId: 'financial-123',
    };

    it('should process successful payment webhook', async () => {
      const mockTransaction = jest.fn((callback) => callback(mockPrismaService));
      mockPrismaService.$transaction = mockTransaction;

      mockPrismaService.payment.findUnique.mockResolvedValue(mockPayment);
      mockPrismaService.payment.update.mockResolvedValue({
        ...mockPayment,
        status: PaymentStatus.PAID,
      });
      mockPrismaService.invoice.findUnique.mockResolvedValue({
        ...mockInvoice,
        paidAmount: 0,
      });
      mockPrismaService.invoice.update.mockResolvedValue({});
      mockPrismaService.auditLog.create.mockResolvedValue({});

      const result = await service.processWebhook(webhookData);

      expect(result).toEqual(
        expect.objectContaining({
          message: expect.any(String),
          processed: true,
        }),
      );
    });

    it('should handle failed payment webhook', async () => {
      mockPrismaService.payment.findUnique.mockResolvedValue(mockPayment);
      mockPrismaService.payment.update.mockResolvedValue({
        ...mockPayment,
        status: PaymentStatus.FAILED,
      });

      const failedWebhook = {
        ...webhookData,
        status: 'FAILED',
        reason: 'Insufficient funds',
      };

      const result = await service.processWebhook(failedWebhook);

      expect(result).toEqual(
        expect.objectContaining({
          message: 'Payment marked as failed',
          processed: true,
          status: 'FAILED',
        }),
      );
    });

    it('should return early if payment not found', async () => {
      mockPrismaService.payment.findUnique.mockResolvedValue(null);

      const result = await service.processWebhook(webhookData);

      expect(result).toEqual({
        message: 'Transaction not found',
        processed: false,
      });
    });

    it('should return early if payment already processed', async () => {
      mockPrismaService.payment.findUnique.mockResolvedValue({
        ...mockPayment,
        status: PaymentStatus.PAID,
      });

      const result = await service.processWebhook(webhookData);

      expect(result).toEqual(
        expect.objectContaining({
          message: 'Payment already processed',
          processed: true,
          idempotent: true,
        }),
      );
    });

    it('should mark invoice as paid when full amount received', async () => {
      const mockTransaction = jest.fn((callback) => callback(mockPrismaService));
      mockPrismaService.$transaction = mockTransaction;

      mockPrismaService.payment.findUnique.mockResolvedValue(mockPayment);
      mockPrismaService.payment.update.mockResolvedValue({
        ...mockPayment,
        status: PaymentStatus.PAID,
      });
      mockPrismaService.invoice.findUnique.mockResolvedValue({
        ...mockInvoice,
        paidAmount: 0,
        totalAmount: 100000,
      });
      mockPrismaService.invoice.update.mockResolvedValue({});
      mockPrismaService.auditLog.create.mockResolvedValue({});

      await service.processWebhook(webhookData);

      expect(mockTransaction).toHaveBeenCalled();
    });
  });

  describe('markPaidManually', () => {
    it('should mark payment as paid manually', async () => {
      mockPrismaService.payment.findUnique.mockResolvedValue(mockPayment);
      mockPrismaService.payment.update.mockResolvedValue({
        ...mockPayment,
        status: PaymentStatus.PAID,
        markedPaidBy: 'user-1',
        paidAt: new Date(),
      });
      mockInvoicesService.markPaid.mockResolvedValue({});

      const result = await service.markPaidManually('payment-1', 'user-1');

      expect(result).toEqual(
        expect.objectContaining({
          id: 'payment-1',
          status: PaymentStatus.PAID,
          markedPaidBy: 'user-1',
        }),
      );
      expect(mockInvoicesService.markPaid).toHaveBeenCalledWith(
        mockPayment.invoiceId,
        mockPayment.amount,
        'user-1',
        undefined,
      );
      expect(mockPrismaService.payment.update).toHaveBeenCalled();
    });

    it('should throw NotFoundException if payment not found', async () => {
      mockPrismaService.payment.findUnique.mockResolvedValue(null);

      await expect(service.markPaidManually('invalid-id', 'user-1')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw BadRequestException if payment already paid', async () => {
      mockPrismaService.payment.findUnique.mockResolvedValue({
        ...mockPayment,
        status: PaymentStatus.PAID,
      });

      await expect(service.markPaidManually('payment-1', 'user-1')).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.markPaidManually('payment-1', 'user-1')).rejects.toThrow(
        'Payment is already marked as paid',
      );
    });
  });

  describe('findOne', () => {
    it('should return payment by id', async () => {
      mockPrismaService.payment.findUnique.mockResolvedValue(mockPayment);

      const result = await service.findOne('payment-1');

      expect(result).toEqual(mockPayment);
      expect(mockPrismaService.payment.findUnique).toHaveBeenCalledWith({
        where: { id: 'payment-1' },
        include: { invoice: true },
      });
    });

    it('should throw NotFoundException if payment not found', async () => {
      mockPrismaService.payment.findUnique.mockResolvedValue(null);

      await expect(service.findOne('invalid-id')).rejects.toThrow(NotFoundException);
    });
  });

  describe('findAll', () => {
    it('should return all payments without filters', async () => {
      const payments = [mockPayment];
      mockPrismaService.payment.findMany.mockResolvedValue(payments);

      const result = await service.findAll({});

      expect(result).toEqual(payments);
      expect(mockPrismaService.payment.findMany).toHaveBeenCalledWith({
        where: {},
        include: {
          invoice: {
            select: {
              invoiceNumber: true,
              totalAmount: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      });
    });

    it('should filter by invoiceId', async () => {
      const payments = [mockPayment];
      mockPrismaService.payment.findMany.mockResolvedValue(payments);

      await service.findAll({ invoiceId: 'invoice-1' });

      expect(mockPrismaService.payment.findMany).toHaveBeenCalledWith({
        where: { invoiceId: 'invoice-1' },
        include: {
          invoice: {
            select: {
              invoiceNumber: true,
              totalAmount: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      });
    });

    it('should filter by status', async () => {
      const payments = [mockPayment];
      mockPrismaService.payment.findMany.mockResolvedValue(payments);

      await service.findAll({ status: PaymentStatus.PAID });

      expect(mockPrismaService.payment.findMany).toHaveBeenCalledWith({
        where: { status: PaymentStatus.PAID },
        include: {
          invoice: {
            select: {
              invoiceNumber: true,
              totalAmount: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      });
    });

    it('should filter by both invoiceId and status', async () => {
      const payments = [mockPayment];
      mockPrismaService.payment.findMany.mockResolvedValue(payments);

      await service.findAll({ invoiceId: 'invoice-1', status: PaymentStatus.PENDING });

      expect(mockPrismaService.payment.findMany).toHaveBeenCalledWith({
        where: {
          invoiceId: 'invoice-1',
          status: PaymentStatus.PENDING,
        },
        include: {
          invoice: {
            select: {
              invoiceNumber: true,
              totalAmount: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      });
    });
  });
});
