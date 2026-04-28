import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { InvoicesService } from './invoices.service';
import { PrismaService } from '../../database/prisma.service';
import { InsufficientDataException, InvoiceAlreadyExistsException } from './exceptions';
import { InvoiceStatus } from '@prisma/client';

describe('InvoicesService', () => {
  let service: InvoicesService;

  const mockTransaction = jest.fn();
  const mockPrismaService = {
    $transaction: mockTransaction,
    invoice: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      create: jest.fn(),
    },
    order: {
      findUnique: jest.fn(),
    },
    rental: {
      findUnique: jest.fn(),
    },
    site: {
      findUnique: jest.fn(),
    },
    auditLog: {
      create: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InvoicesService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<InvoicesService>(InvoicesService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('generateOrderInvoice', () => {
    const mockOrder = {
      id: 'order-1',
      clientId: 'client-1',
      siteId: 'site-1',
      status: 'APPROVED',
      totalAmount: 100000,
      deletedAt: null,
      items: [
        {
          quantityKg: 10,
          unitPrice: 10000,
          subtotal: 100000,
          product: {
            name: 'Fresh Tomatoes',
            unit: 'kg',
          },
        },
      ],
      client: {
        id: 'client-1',
        firstName: 'John',
        lastName: 'Doe',
      },
      site: {
        id: 'site-1',
        name: 'Kigali',
      },
    };

    const mockSite = {
      id: 'site-1',
      name: 'Kigali',
    };

    const mockInvoice = {
      id: 'invoice-1',
      invoiceNumber: 'INV-KIGALI-2026-00001',
      orderId: 'order-1',
      rentalId: null,
      clientId: 'client-1',
      siteId: 'site-1',
      subtotal: 100000,
      taxAmount: 0,
      totalAmount: 100000,
      paidAmount: 0,
      status: InvoiceStatus.UNPAID,
      dueDate: new Date(),
      items: [
        {
          id: 'item-1',
          description: 'Fresh Tomatoes',
          quantity: 10,
          unit: 'kg',
          unitPrice: 10000,
          subtotal: 100000,
        },
      ],
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null,
    };

    it('should generate invoice for approved order', async () => {
      mockTransaction.mockImplementation(
        // eslint-disable-next-line @typescript-eslint/require-await
        async (callback) => {
          const mockTx = {
            invoice: {
              findFirst: jest.fn().mockResolvedValue(null),
              create: jest.fn().mockResolvedValue(mockInvoice),
            },
            order: {
              findUnique: jest.fn().mockResolvedValue(mockOrder),
            },
            $queryRaw: jest.fn().mockResolvedValue([mockSite]),
            auditLog: {
              create: jest.fn().mockResolvedValue({}),
            },
          };
          // eslint-disable-next-line @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-call
          return callback(mockTx);
        },
      );

      const result = await service.generateOrderInvoice('order-1', undefined, 'user-1');

      expect(result).toBeDefined();
      expect(result.invoiceNumber).toContain('INV-KIGALI-2026');
      expect(result.orderId).toBe('order-1');
      expect(result.status).toBe(InvoiceStatus.UNPAID);
      expect(mockTransaction).toHaveBeenCalled();
    });

    it('should throw InvoiceAlreadyExistsException if invoice exists', async () => {
      mockTransaction.mockImplementation(
        // eslint-disable-next-line @typescript-eslint/require-await
        async (callback) => {
          const mockTx = {
            invoice: {
              findFirst: jest.fn().mockResolvedValue(mockInvoice),
            },
          };
          // eslint-disable-next-line @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-call
          return callback(mockTx);
        },
      );

      await expect(service.generateOrderInvoice('order-1')).rejects.toThrow(
        InvoiceAlreadyExistsException,
      );
    });

    it('should throw NotFoundException if order not found', async () => {
      mockTransaction.mockImplementation(
        // eslint-disable-next-line @typescript-eslint/require-await
        async (callback) => {
          const mockTx = {
            invoice: {
              findFirst: jest.fn().mockResolvedValue(null),
            },
            order: {
              findUnique: jest.fn().mockResolvedValue(null),
            },
          };
          // eslint-disable-next-line @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-call
          return callback(mockTx);
        },
      );

      await expect(service.generateOrderInvoice('order-1')).rejects.toThrow(NotFoundException);
    });

    it('should throw InsufficientDataException if order not approved', async () => {
      mockTransaction.mockImplementation(
        // eslint-disable-next-line @typescript-eslint/require-await
        async (callback) => {
          const mockTx = {
            invoice: {
              findFirst: jest.fn().mockResolvedValue(null),
            },
            order: {
              findUnique: jest.fn().mockResolvedValue({ ...mockOrder, status: 'REQUESTED' }),
            },
          };
          // eslint-disable-next-line @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-call
          return callback(mockTx);
        },
      );

      await expect(service.generateOrderInvoice('order-1')).rejects.toThrow(
        InsufficientDataException,
      );
    });

    it('should throw InsufficientDataException if order has no items', async () => {
      mockTransaction.mockImplementation(
        // eslint-disable-next-line @typescript-eslint/require-await
        async (callback) => {
          const mockTx = {
            invoice: {
              findFirst: jest.fn().mockResolvedValue(null),
            },
            order: {
              findUnique: jest.fn().mockResolvedValue({ ...mockOrder, items: [] }),
            },
          };
          // eslint-disable-next-line @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-call
          return callback(mockTx);
        },
      );

      await expect(service.generateOrderInvoice('order-1')).rejects.toThrow(
        InsufficientDataException,
      );
    });

    it('should throw InsufficientDataException if order is deleted', async () => {
      mockTransaction.mockImplementation(
        // eslint-disable-next-line @typescript-eslint/require-await
        async (callback) => {
          const mockTx = {
            invoice: {
              findFirst: jest.fn().mockResolvedValue(null),
            },
            order: {
              findUnique: jest.fn().mockResolvedValue({ ...mockOrder, deletedAt: new Date() }),
            },
          };
          // eslint-disable-next-line @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-call
          return callback(mockTx);
        },
      );

      await expect(service.generateOrderInvoice('order-1')).rejects.toThrow(
        InsufficientDataException,
      );
    });
  });

  describe('findOne', () => {
    it('should return invoice by ID', async () => {
      const mockInvoice = {
        id: 'invoice-1',
        invoiceNumber: 'INV-KIGALI-2026-00001',
        items: [],
        status: InvoiceStatus.UNPAID,
        deletedAt: null,
      };

      mockPrismaService.invoice.findFirst.mockResolvedValue(mockInvoice);

      const result = await service.findOne('invoice-1');

      expect(result).toBeDefined();
      expect(result.id).toBe('invoice-1');
    });

    it('should throw NotFoundException if invoice not found', async () => {
      mockPrismaService.invoice.findFirst.mockResolvedValue(null);

      await expect(service.findOne('invalid-id')).rejects.toThrow(NotFoundException);
    });
  });

  describe('findAll', () => {
    it('should return paginated invoices', async () => {
      const mockInvoices = [
        {
          id: 'invoice-1',
          invoiceNumber: 'INV-KIGALI-2026-00001',
          items: [],
          status: InvoiceStatus.UNPAID,
        },
      ];

      mockPrismaService.invoice.findMany.mockResolvedValue(mockInvoices);
      mockPrismaService.invoice.count.mockResolvedValue(1);

      const result = await service.findAll({ page: 1, limit: 10 });

      expect(result.data).toHaveLength(1);
      expect(result.meta.total).toBe(1);
      expect(result.meta.page).toBe(1);
    });

    it('should enforce max page limit', async () => {
      const mockInvoices = [];
      mockPrismaService.invoice.findMany.mockResolvedValue(mockInvoices);
      mockPrismaService.invoice.count.mockResolvedValue(0);

      const result = await service.findAll({ page: 1, limit: 200 });

      expect(result.meta.limit).toBe(100);
    });
  });
});
