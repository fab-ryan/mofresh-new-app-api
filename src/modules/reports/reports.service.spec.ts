import { Test, TestingModule } from '@nestjs/testing';
import { ReportsService } from './reports.service';
import { PrismaService } from '../../database/prisma.service';
import { InvoiceStatus } from '@prisma/client';
import { NotFoundException } from '@nestjs/common';

describe('ReportsService', () => {
  let service: ReportsService;

  const mockPrismaService = {
    site: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
    },
    invoice: {
      aggregate: jest.fn(),
      groupBy: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReportsService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<ReportsService>(ReportsService);
    // prisma = module.get<PrismaService>(PrismaService);

    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  describe('getRevenueReport', () => {
    const mockSite = {
      id: 'site-1',
      name: 'Kigali Site',
    };

    const startDate = new Date('2026-01-01');
    const endDate = new Date('2026-12-31');

    it('should generate revenue report for a single site', async () => {
      mockPrismaService.site.findUnique.mockResolvedValue(mockSite);
      mockPrismaService.invoice.aggregate
        .mockResolvedValueOnce({ _sum: { totalAmount: 500000 }, _count: 10 }) // product sales
        .mockResolvedValueOnce({ _sum: { totalAmount: 200000 }, _count: 5 }) // rental income
        .mockResolvedValueOnce({ _sum: { paidAmount: 700000 } }); // paid amount

      mockPrismaService.invoice.groupBy.mockResolvedValue([
        { status: InvoiceStatus.PAID, _count: { _all: 12 }, _sum: { totalAmount: 700000 } },
        { status: InvoiceStatus.UNPAID, _count: { _all: 3 }, _sum: { totalAmount: 150000 } },
      ]);

      mockPrismaService.invoice.findMany.mockResolvedValue([]);

      const result = await service.getRevenueReport(
        { startDate: startDate.toISOString(), endDate: endDate.toISOString() },
        'site-1',
      );

      expect(result).toEqual({
        productSales: 500000,
        rentalIncome: 200000,
        totalRevenue: 700000,
        totalInvoices: 15,
        paidInvoices: 12,
        unpaidInvoices: 3,
        totalPaidAmount: 700000,
        totalUnpaidAmount: expect.any(Number) as number,
        startDate,
        endDate,
        siteId: 'site-1',
        siteName: 'Kigali Site',
      });

      expect(mockPrismaService.site.findUnique).toHaveBeenCalledWith({
        where: { id: 'site-1' },
      });
    });

    it('should throw NotFoundException if site not found', async () => {
      mockPrismaService.site.findUnique.mockResolvedValue(null);

      await expect(
        service.getRevenueReport(
          { startDate: startDate.toISOString(), endDate: endDate.toISOString() },
          'invalid-site',
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('should handle zero revenue for a site', async () => {
      mockPrismaService.site.findUnique.mockResolvedValue(mockSite);
      mockPrismaService.invoice.aggregate
        .mockResolvedValueOnce({ _sum: { totalAmount: null }, _count: 0 })
        .mockResolvedValueOnce({ _sum: { totalAmount: null }, _count: 0 })
        .mockResolvedValueOnce({ _sum: { paidAmount: null } });

      mockPrismaService.invoice.groupBy.mockResolvedValue([]);
      mockPrismaService.invoice.findMany.mockResolvedValue([]);

      const result = await service.getRevenueReport(
        { startDate: startDate.toISOString(), endDate: endDate.toISOString() },
        'site-1',
      );

      expect(result).toMatchObject({
        productSales: 0,
        rentalIncome: 0,
        totalRevenue: 0,
        totalInvoices: 0,
        paidInvoices: 0,
        unpaidInvoices: 0,
      });
    });

    it('should generate aggregated revenue report for all sites', async () => {
      const mockSites = [
        { id: 'site-1', name: 'Kigali' },
        { id: 'site-2', name: 'Musanze' },
      ];

      mockPrismaService.site.findMany.mockResolvedValue(mockSites);
      mockPrismaService.invoice.aggregate
        .mockResolvedValueOnce({ _sum: { totalAmount: 800000 } }) // total product sales
        .mockResolvedValueOnce({ _sum: { totalAmount: 300000 } }) // total rental income
        .mockResolvedValueOnce({ _sum: { paidAmount: 1100000 } }) // paid amount
        .mockResolvedValueOnce({ _sum: { totalAmount: 500000 } }) // site 1 product
        .mockResolvedValueOnce({ _sum: { totalAmount: 150000 } }) // site 1 rental
        .mockResolvedValueOnce({ _sum: { totalAmount: 300000 } }) // site 2 product
        .mockResolvedValueOnce({ _sum: { totalAmount: 150000 } }); // site 2 rental

      mockPrismaService.invoice.groupBy
        .mockResolvedValueOnce([
          {
            status: InvoiceStatus.PAID,
            _count: { _all: 20 },
            _sum: { totalAmount: 1100000, paidAmount: 1100000 },
          },
          {
            status: InvoiceStatus.UNPAID,
            _count: { _all: 5 },
            _sum: { totalAmount: 200000, paidAmount: 0 },
          },
        ])
        .mockResolvedValueOnce([
          { status: InvoiceStatus.PAID, _count: { _all: 12 } },
          { status: InvoiceStatus.UNPAID, _count: { _all: 3 } },
        ])
        .mockResolvedValueOnce([
          { status: InvoiceStatus.PAID, _count: { _all: 8 } },
          { status: InvoiceStatus.UNPAID, _count: { _all: 2 } },
        ]);

      const result = await service.getRevenueReport(
        { startDate: startDate.toISOString(), endDate: endDate.toISOString() },
        undefined,
      );

      expect(result).toMatchObject({
        totalProductSales: 800000,
        totalRentalIncome: 300000,
        totalRevenue: 1100000,
        totalInvoices: 25,
        totalPaidInvoices: 20,
        totalUnpaidInvoices: 5,
        startDate,
        endDate,
      });

      expect(result).toHaveProperty('siteBreakdown');
      const aggregatedResult = result as { siteBreakdown: unknown[] };
      expect(aggregatedResult.siteBreakdown).toHaveLength(2);
    });

    it('should use default dates if not provided', async () => {
      mockPrismaService.site.findUnique.mockResolvedValue(mockSite);
      mockPrismaService.invoice.aggregate.mockResolvedValue({
        _sum: { totalAmount: 0 },
        _count: 0,
      });
      mockPrismaService.invoice.groupBy.mockResolvedValue([]);
      mockPrismaService.invoice.findMany.mockResolvedValue([]);

      const result = await service.getRevenueReport({}, 'site-1');

      expect(result.startDate).toBeInstanceOf(Date);
      expect(result.endDate).toBeInstanceOf(Date);
    });
  });

  describe('getUnpaidInvoicesReport', () => {
    const mockInvoices = [
      {
        id: 'inv-1',
        invoiceNumber: 'INV-KIGALI-2026-001',
        clientId: 'client-1',
        siteId: 'site-1',
        totalAmount: 100000,
        paidAmount: 0,
        dueDate: new Date('2026-01-15'),
        status: InvoiceStatus.UNPAID,
        orderId: 'order-1',
        rentalId: null,
        createdAt: new Date('2026-01-01'),
        site: { name: 'Kigali' },
      },
      {
        id: 'inv-2',
        invoiceNumber: 'INV-KIGALI-2026-002',
        clientId: 'client-2',
        siteId: 'site-1',
        totalAmount: 50000,
        paidAmount: 10000,
        dueDate: new Date('2026-02-01'),
        status: InvoiceStatus.UNPAID,
        orderId: null,
        rentalId: 'rental-1',
        createdAt: new Date('2026-01-10'),
        site: { name: 'Kigali' },
      },
    ];

    it('should generate unpaid invoices report with pagination', async () => {
      mockPrismaService.invoice.findMany.mockResolvedValue(mockInvoices);
      mockPrismaService.invoice.count.mockResolvedValue(2);

      const result = await service.getUnpaidInvoicesReport({ page: 1, limit: 10 });

      expect(result.data).toHaveLength(2);
      expect(result.data[0]).toMatchObject({
        id: 'inv-1',
        invoiceNumber: 'INV-KIGALI-2026-001',
        balanceDue: 100000,
        daysOverdue: expect.any(Number) as number,
      });
      expect(result.summary.totalUnpaidInvoices).toBe(2);
      expect(result.summary.totalBalanceDue).toBe(140000);
      expect(result.meta.total).toBe(2);
      expect(result.meta.totalPages).toBe(1);
    });

    it('should filter by site ID', async () => {
      mockPrismaService.invoice.findMany.mockResolvedValue([mockInvoices[0]]);
      mockPrismaService.invoice.count.mockResolvedValue(1);

      const result = await service.getUnpaidInvoicesReport({ siteId: 'site-1' });

      expect(mockPrismaService.invoice.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ siteId: 'site-1' }) as Record<string, unknown>,
        }) as Record<string, unknown>,
      );
      expect(result.data).toHaveLength(1);
    });

    it('should filter only overdue invoices', async () => {
      const overdueInvoice = { ...mockInvoices[0], dueDate: new Date('2020-01-01') };
      mockPrismaService.invoice.findMany.mockResolvedValue([overdueInvoice]);
      mockPrismaService.invoice.count.mockResolvedValue(1);

      const result = await service.getUnpaidInvoicesReport({ overdue: true });

      expect(mockPrismaService.invoice.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            dueDate: { lt: expect.any(Date) as Date },
          }) as Record<string, unknown>,
        }) as Record<string, unknown>,
      );
      expect(result.summary.totalOverdueInvoices).toBeGreaterThan(0);
    });

    it('should calculate days overdue correctly', async () => {
      const pastDueDate = new Date();
      pastDueDate.setDate(pastDueDate.getDate() - 10);

      const overdueInvoice = {
        ...mockInvoices[0],
        dueDate: pastDueDate,
      };

      mockPrismaService.invoice.findMany.mockResolvedValue([overdueInvoice]);
      mockPrismaService.invoice.count.mockResolvedValue(1);

      const result = await service.getUnpaidInvoicesReport({});

      expect(result.data[0].daysOverdue).toBeGreaterThanOrEqual(10);
    });

    it('should handle pagination correctly', async () => {
      mockPrismaService.invoice.findMany.mockResolvedValue([mockInvoices[0]]);
      mockPrismaService.invoice.count.mockResolvedValue(25);

      const result = await service.getUnpaidInvoicesReport({ page: 2, limit: 10 });

      expect(mockPrismaService.invoice.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 10,
          take: 10,
        }),
      );
      expect(result.meta.page).toBe(2);
      expect(result.meta.totalPages).toBe(3);
    });

    it('should enforce maximum page limit', async () => {
      mockPrismaService.invoice.findMany.mockResolvedValue([]);
      mockPrismaService.invoice.count.mockResolvedValue(0);

      await service.getUnpaidInvoicesReport({ limit: 200 });

      expect(mockPrismaService.invoice.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 100,
        }),
      );
    });

    it('should use default pagination values', async () => {
      mockPrismaService.invoice.findMany.mockResolvedValue([]);
      mockPrismaService.invoice.count.mockResolvedValue(0);

      await service.getUnpaidInvoicesReport({});

      expect(mockPrismaService.invoice.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 0,
          take: 10,
        }),
      );
    });

    it('should return empty result when no unpaid invoices exist', async () => {
      mockPrismaService.invoice.findMany.mockResolvedValue([]);
      mockPrismaService.invoice.count.mockResolvedValue(0);

      const result = await service.getUnpaidInvoicesReport({});

      expect(result.data).toHaveLength(0);
      expect(result.summary.totalUnpaidInvoices).toBe(0);
      expect(result.summary.totalBalanceDue).toBe(0);
    });

    it('should scope to user site if userSiteId provided', async () => {
      mockPrismaService.invoice.findMany.mockResolvedValue([mockInvoices[0]]);
      mockPrismaService.invoice.count.mockResolvedValue(1);

      const userSiteId: string = 'user-site-id';
      await service.getUnpaidInvoicesReport({}, userSiteId);

      expect(mockPrismaService.invoice.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ siteId: userSiteId }) as Record<string, unknown>,
        }) as Record<string, unknown>,
      );
    });
  });
});
