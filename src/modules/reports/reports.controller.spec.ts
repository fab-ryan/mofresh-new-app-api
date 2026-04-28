import { Test, TestingModule } from '@nestjs/testing';
import { ReportsController } from './reports.controller';
import { ReportsService } from './reports.service';
import { UserRole, InvoiceStatus } from '@prisma/client';
import { CurrentUserPayload } from '../../common/decorators';

describe('ReportsController', () => {
  let controller: ReportsController;

  const mockReportsService = {
    getRevenueReport: jest.fn(),
    getUnpaidInvoicesReport: jest.fn(),
  };

  const mockUser: CurrentUserPayload = {
    userId: 'user-1',
    email: 'admin@mofresh.com',
    role: UserRole.SUPER_ADMIN,
    siteId: undefined,
  };

  const mockSiteManagerUser: CurrentUserPayload = {
    userId: 'user-2',
    email: 'manager@mofresh.com',
    role: UserRole.SITE_MANAGER,
    siteId: 'site-1',
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ReportsController],
      providers: [
        {
          provide: ReportsService,
          useValue: mockReportsService,
        },
      ],
    }).compile();

    controller = module.get<ReportsController>(ReportsController);

    jest.clearAllMocks();
  });

  describe('getRevenueReport', () => {
    const mockRevenueReport = {
      productSales: 500000,
      rentalIncome: 200000,
      totalRevenue: 700000,
      totalInvoices: 15,
      paidInvoices: 12,
      unpaidInvoices: 3,
      totalPaidAmount: 700000,
      totalUnpaidAmount: 150000,
      startDate: new Date('2026-01-01'),
      endDate: new Date('2026-12-31'),
      siteId: 'site-1',
      siteName: 'Kigali',
    };

    it('should return revenue report', async () => {
      mockReportsService.getRevenueReport.mockResolvedValue(mockRevenueReport);

      const query = {
        startDate: '2026-01-01T00:00:00.000Z',
        endDate: '2026-12-31T23:59:59.999Z',
      };

      const result = await controller.getRevenueReport(query, mockUser);

      expect(result).toEqual(mockRevenueReport);
      expect(mockReportsService.getRevenueReport).toHaveBeenCalledWith(query, undefined);
    });

    it('should handle query with siteId for super admin', async () => {
      mockReportsService.getRevenueReport.mockResolvedValue(mockRevenueReport);

      const query = {
        startDate: '2026-01-01T00:00:00.000Z',
        endDate: '2026-12-31T23:59:59.999Z',
        siteId: 'site-1',
      };

      await controller.getRevenueReport(query, mockUser);

      expect(mockReportsService.getRevenueReport).toHaveBeenCalledWith(query, undefined);
    });

    it('should scope to site manager site', async () => {
      mockReportsService.getRevenueReport.mockResolvedValue(mockRevenueReport);

      const query = {
        startDate: '2026-01-01T00:00:00.000Z',
        endDate: '2026-12-31T23:59:59.999Z',
      };

      await controller.getRevenueReport(query, mockSiteManagerUser);

      expect(mockReportsService.getRevenueReport).toHaveBeenCalledWith(query, 'site-1');
    });

    it('should handle empty query parameters', async () => {
      mockReportsService.getRevenueReport.mockResolvedValue(mockRevenueReport);

      await controller.getRevenueReport({}, mockUser);

      expect(mockReportsService.getRevenueReport).toHaveBeenCalledWith({}, undefined);
    });

    it('should return aggregated report for Super Admin', async () => {
      const mockAggregatedReport = {
        totalProductSales: 800000,
        totalRentalIncome: 300000,
        totalRevenue: 1100000,
        totalInvoices: 25,
        totalPaidInvoices: 20,
        totalUnpaidInvoices: 5,
        totalPaidAmount: 1100000,
        totalUnpaidAmount: 200000,
        siteBreakdown: [
          {
            siteId: 'site-1',
            siteName: 'Kigali',
            productSales: 500000,
            rentalIncome: 150000,
            totalRevenue: 650000,
            invoiceCount: 15,
            paidCount: 12,
            unpaidCount: 3,
          },
        ],
        startDate: new Date('2026-01-01'),
        endDate: new Date('2026-12-31'),
      };

      mockReportsService.getRevenueReport.mockResolvedValue(mockAggregatedReport);

      const result = await controller.getRevenueReport({}, mockUser);

      expect(result).toEqual(mockAggregatedReport);
      expect(result).toHaveProperty('siteBreakdown');
    });
  });

  describe('getUnpaidInvoicesReport', () => {
    const mockUnpaidReport = {
      data: [
        {
          id: 'inv-1',
          invoiceNumber: 'INV-KIGALI-2026-001',
          clientId: 'client-1',
          siteId: 'site-1',
          siteName: 'Kigali',
          totalAmount: 100000,
          paidAmount: 0,
          balanceDue: 100000,
          dueDate: new Date('2026-01-15'),
          daysOverdue: 5,
          status: InvoiceStatus.UNPAID,
          orderId: 'order-1',
          createdAt: new Date('2026-01-01'),
        },
      ],
      summary: {
        totalUnpaidInvoices: 1,
        totalBalanceDue: 100000,
        totalOverdueInvoices: 1,
        totalOverdueAmount: 100000,
      },
      meta: {
        total: 1,
        page: 1,
        limit: 10,
        totalPages: 1,
      },
    };

    it('should return unpaid invoices report', async () => {
      mockReportsService.getUnpaidInvoicesReport.mockResolvedValue(mockUnpaidReport);

      const result = await controller.getUnpaidInvoicesReport({}, mockUser);

      expect(result).toEqual(mockUnpaidReport);
      expect(mockReportsService.getUnpaidInvoicesReport).toHaveBeenCalledWith({}, undefined);
    });

    it('should handle query with siteId filter for super admin', async () => {
      mockReportsService.getUnpaidInvoicesReport.mockResolvedValue(mockUnpaidReport);

      const query = { siteId: 'site-1' };

      await controller.getUnpaidInvoicesReport(query, mockUser);

      expect(mockReportsService.getUnpaidInvoicesReport).toHaveBeenCalledWith(query, undefined);
    });

    it('should scope to site manager site', async () => {
      mockReportsService.getUnpaidInvoicesReport.mockResolvedValue(mockUnpaidReport);

      const query = { overdue: true };

      await controller.getUnpaidInvoicesReport(query, mockSiteManagerUser);

      expect(mockReportsService.getUnpaidInvoicesReport).toHaveBeenCalledWith(query, 'site-1');
    });

    it('should handle pagination parameters', async () => {
      mockReportsService.getUnpaidInvoicesReport.mockResolvedValue(mockUnpaidReport);

      const query = { page: 2, limit: 20 };

      await controller.getUnpaidInvoicesReport(query, mockUser);

      expect(mockReportsService.getUnpaidInvoicesReport).toHaveBeenCalledWith(query, undefined);
    });

    it('should handle combined filters', async () => {
      mockReportsService.getUnpaidInvoicesReport.mockResolvedValue(mockUnpaidReport);

      const query = {
        siteId: 'site-1',
        overdue: true,
        page: 1,
        limit: 10,
      };

      await controller.getUnpaidInvoicesReport(query, mockUser);

      expect(mockReportsService.getUnpaidInvoicesReport).toHaveBeenCalledWith(query, undefined);
    });

    it('should return empty report when no unpaid invoices', async () => {
      const emptyReport = {
        data: [],
        summary: {
          totalUnpaidInvoices: 0,
          totalBalanceDue: 0,
          totalOverdueInvoices: 0,
          totalOverdueAmount: 0,
        },
        meta: {
          total: 0,
          page: 1,
          limit: 10,
          totalPages: 0,
        },
      };

      mockReportsService.getUnpaidInvoicesReport.mockResolvedValue(emptyReport);

      const result = await controller.getUnpaidInvoicesReport({}, mockUser);

      expect(result.data).toHaveLength(0);
      expect(result.summary.totalUnpaidInvoices).toBe(0);
    });
  });
});
