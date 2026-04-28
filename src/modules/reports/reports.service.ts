import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { InvoiceStatus } from '@prisma/client';
import {
  RevenueReportQueryDto,
  RevenueReportResponseDto,
  AggregatedRevenueReportDto,
  UnpaidInvoicesQueryDto,
  UnpaidInvoicesReportDto,
  UnpaidInvoiceItemDto,
} from './dto';

@Injectable()
export class ReportsService {
  private readonly logger = new Logger(ReportsService.name);
  private readonly DEFAULT_PAGE_LIMIT = 10;
  private readonly MAX_PAGE_LIMIT = 100;

  constructor(private readonly prisma: PrismaService) {}

  /**
   * revenue report for a specific site or all sites
   * aggregates product sales and rental income
   */
  async getRevenueReport(
    query: RevenueReportQueryDto,
    userSiteId?: string,
  ): Promise<RevenueReportResponseDto | AggregatedRevenueReportDto> {
    this.logger.log('Generating revenue report', { query, userSiteId });

    const startDate = query.startDate ? new Date(query.startDate) : new Date('1970-01-01');
    const endDate = query.endDate ? new Date(query.endDate) : new Date();

    const siteId = userSiteId || query.siteId;

    if (siteId) {
      return this.getSingleSiteRevenue(siteId, startDate, endDate);
    } else {
      return this.getAggregatedRevenue(startDate, endDate);
    }
  }

  /**
   * get revenue for a single site
   */
  private async getSingleSiteRevenue(
    siteId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<RevenueReportResponseDto> {
    const site = await this.prisma.site.findUnique({
      where: { id: siteId },
    });

    if (!site) {
      throw new NotFoundException(`Site with ID ${siteId} not found`);
    }

    const where = {
      siteId,
      createdAt: {
        gte: startDate,
        lte: endDate,
      },
      deletedAt: null,
    };

    const [productSalesData, rentalIncomeData, invoiceStats, paidData] = await Promise.all([
      this.prisma.invoice.aggregate({
        where: {
          ...where,
          status: InvoiceStatus.PAID,
          orderId: { not: null },
        },
        _sum: { totalAmount: true },
        _count: true,
      }),
      this.prisma.invoice.aggregate({
        where: {
          ...where,
          status: InvoiceStatus.PAID,
          rentalId: { not: null },
        },
        _sum: { totalAmount: true },
        _count: true,
      }),
      this.prisma.invoice.groupBy({
        by: ['status'],
        where,
        _count: { _all: true },
        _sum: { totalAmount: true },
      }),
      this.prisma.invoice.aggregate({
        where: {
          ...where,
          status: InvoiceStatus.PAID,
        },
        _sum: { paidAmount: true },
      }),
    ]);

    const productSales = productSalesData._sum.totalAmount || 0;
    const rentalIncome = rentalIncomeData._sum.totalAmount || 0;
    const totalRevenue = productSales + rentalIncome;

    const paidInvoices =
      invoiceStats.find((s) => s.status === InvoiceStatus.PAID)?._count._all || 0;
    const unpaidInvoices =
      invoiceStats.find((s) => s.status === InvoiceStatus.UNPAID)?._count._all || 0;
    const totalInvoices = paidInvoices + unpaidInvoices;

    const totalPaidAmount = paidData._sum.paidAmount || 0;
    // total unpaid amount is the outstanding balance (totalAmount - paidAmount for unpaid invoices)
    const totalUnpaidAmount = await this.getUnpaidBalances(siteId, startDate, endDate);

    return {
      productSales,
      rentalIncome,
      totalRevenue,
      totalInvoices,
      paidInvoices,
      unpaidInvoices,
      totalPaidAmount,
      totalUnpaidAmount,
      startDate,
      endDate,
      siteId,
      siteName: site.name,
    };
  }

  /**
   * get aggregated revenue across all sites
   */
  private async getAggregatedRevenue(
    startDate: Date,
    endDate: Date,
  ): Promise<AggregatedRevenueReportDto> {
    const where = {
      createdAt: {
        gte: startDate,
        lte: endDate,
      },
      deletedAt: null,
    };

    const [sites, productSales, rentalIncome, invoiceStats, paidAmount] = await Promise.all([
      this.prisma.site.findMany({
        where: { deletedAt: null },
        select: { id: true, name: true },
      }),
      this.prisma.invoice.aggregate({
        where: {
          ...where,
          status: InvoiceStatus.PAID,
          orderId: { not: null },
        },
        _sum: { totalAmount: true },
      }),
      this.prisma.invoice.aggregate({
        where: {
          ...where,
          status: InvoiceStatus.PAID,
          rentalId: { not: null },
        },
        _sum: { totalAmount: true },
      }),
      this.prisma.invoice.groupBy({
        by: ['status'],
        where,
        _count: { _all: true },
        _sum: { totalAmount: true, paidAmount: true },
      }),
      this.prisma.invoice.aggregate({
        where: {
          ...where,
          status: InvoiceStatus.PAID,
        },
        _sum: { paidAmount: true },
      }),
    ]);

    const totalProductSales = productSales._sum.totalAmount || 0;
    const totalRentalIncome = rentalIncome._sum.totalAmount || 0;
    const totalRevenue = totalProductSales + totalRentalIncome;

    const paidCount = invoiceStats.find((s) => s.status === InvoiceStatus.PAID)?._count._all || 0;
    const unpaidCount =
      invoiceStats.find((s) => s.status === InvoiceStatus.UNPAID)?._count._all || 0;
    const totalInvoices = paidCount + unpaidCount;

    const totalPaidAmount = paidAmount._sum.paidAmount || 0;
    const unpaidStat = invoiceStats.find((s) => s.status === InvoiceStatus.UNPAID);
    const totalUnpaidAmount = unpaidStat
      ? (unpaidStat._sum.totalAmount || 0) - (unpaidStat._sum.paidAmount || 0)
      : 0;

    const siteBreakdown = await Promise.all(
      sites.map(async (site) => {
        const siteWhere = { ...where, siteId: site.id };

        const [siteProductSales, siteRentalIncome, siteInvoiceStats] = await Promise.all([
          this.prisma.invoice.aggregate({
            where: { ...siteWhere, status: InvoiceStatus.PAID, orderId: { not: null } },
            _sum: { totalAmount: true },
          }),
          this.prisma.invoice.aggregate({
            where: { ...siteWhere, status: InvoiceStatus.PAID, rentalId: { not: null } },
            _sum: { totalAmount: true },
          }),
          this.prisma.invoice.groupBy({
            by: ['status'],
            where: siteWhere,
            _count: { _all: true },
          }),
        ]);

        const siteProductSalesTotal = siteProductSales._sum.totalAmount || 0;
        const siteRentalIncomeTotal = siteRentalIncome._sum.totalAmount || 0;
        const siteTotalRevenue = siteProductSalesTotal + siteRentalIncomeTotal;

        const sitePaidCount =
          siteInvoiceStats.find((s) => s.status === InvoiceStatus.PAID)?._count._all || 0;
        const siteUnpaidCount =
          siteInvoiceStats.find((s) => s.status === InvoiceStatus.UNPAID)?._count._all || 0;
        const siteInvoiceCount = sitePaidCount + siteUnpaidCount;

        return {
          siteId: site.id,
          siteName: site.name,
          productSales: siteProductSalesTotal,
          rentalIncome: siteRentalIncomeTotal,
          totalRevenue: siteTotalRevenue,
          invoiceCount: siteInvoiceCount,
          paidCount: sitePaidCount,
          unpaidCount: siteUnpaidCount,
        };
      }),
    );

    return {
      totalProductSales,
      totalRentalIncome,
      totalRevenue,
      totalInvoices,
      totalPaidInvoices: paidCount,
      totalUnpaidInvoices: unpaidCount,
      totalPaidAmount,
      totalUnpaidAmount,
      siteBreakdown,
      startDate,
      endDate,
    };
  }

  /**
   * get unpaid balances for a site
   */
  private async getUnpaidBalances(siteId: string, startDate: Date, endDate: Date): Promise<number> {
    const unpaidInvoices = await this.prisma.invoice.findMany({
      where: {
        siteId,
        status: InvoiceStatus.UNPAID,
        createdAt: { gte: startDate, lte: endDate },
        deletedAt: null,
      },
      select: { totalAmount: true, paidAmount: true },
    });

    return unpaidInvoices.reduce(
      (sum, invoice) => sum + (invoice.totalAmount - invoice.paidAmount),
      0,
    );
  }

  /**
   * generate unpaid invoices report with pagination
   */
  async getUnpaidInvoicesReport(
    query: UnpaidInvoicesQueryDto,
    userSiteId?: string,
  ): Promise<UnpaidInvoicesReportDto> {
    this.logger.log('Generating unpaid invoices report', { query, userSiteId });

    const page = query.page || 1;
    const limit = Math.min(query.limit || this.DEFAULT_PAGE_LIMIT, this.MAX_PAGE_LIMIT);
    const skip = (page - 1) * limit;
    const siteId = userSiteId || query.siteId;

    interface WhereClause {
      status: InvoiceStatus;
      siteId?: string;
      deletedAt: null;
      dueDate?: { lt: Date };
    }

    const where: WhereClause = {
      status: InvoiceStatus.UNPAID,
      deletedAt: null,
    };

    if (siteId) {
      where.siteId = siteId;
    }

    if (query.overdue) {
      where.dueDate = { lt: new Date() };
    }

    const [invoices, total] = await Promise.all([
      this.prisma.invoice.findMany({
        where,
        include: {
          site: { select: { name: true } },
        },
        skip,
        take: limit,
        orderBy: [{ dueDate: 'asc' }, { createdAt: 'desc' }],
      }),
      this.prisma.invoice.count({ where }),
    ]);

    const now = new Date();

    const data: UnpaidInvoiceItemDto[] = invoices.map((invoice) => {
      const balanceDue = invoice.totalAmount - invoice.paidAmount;
      const daysOverdue = Math.max(
        0,
        Math.floor((now.getTime() - invoice.dueDate.getTime()) / (1000 * 60 * 60 * 24)),
      );

      return {
        id: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
        clientId: invoice.clientId,
        siteId: invoice.siteId,
        siteName: invoice.site.name,
        totalAmount: invoice.totalAmount,
        paidAmount: invoice.paidAmount,
        balanceDue,
        dueDate: invoice.dueDate,
        daysOverdue,
        status: invoice.status,
        orderId: invoice.orderId || undefined,
        rentalId: invoice.rentalId || undefined,
        createdAt: invoice.createdAt,
      };
    });

    const overdueInvoices = data.filter((inv) => inv.daysOverdue > 0);
    const totalBalanceDue = data.reduce((sum, inv) => sum + inv.balanceDue, 0);
    const totalOverdueAmount = overdueInvoices.reduce((sum, inv) => sum + inv.balanceDue, 0);

    return {
      data,
      summary: {
        totalUnpaidInvoices: total,
        totalBalanceDue,
        totalOverdueInvoices: overdueInvoices.length,
        totalOverdueAmount,
      },
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }
}
