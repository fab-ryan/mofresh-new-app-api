import { IsOptional, IsDateString, IsUUID } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class RevenueReportQueryDto {
  @ApiPropertyOptional({
    description: 'Start date for revenue report (ISO 8601 format)',
    example: '2026-01-01T00:00:00.000Z',
  })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional({
    description: 'End date for revenue report (ISO 8601 format)',
    example: '2026-12-31T23:59:59.999Z',
  })
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @ApiPropertyOptional({
    description: 'Filter by specific site ID (Super Admin only)',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsOptional()
  @IsUUID()
  siteId?: string;
}

export class RevenueReportResponseDto {
  productSales: number;
  rentalIncome: number;
  totalRevenue: number;
  totalInvoices: number;
  paidInvoices: number;
  unpaidInvoices: number;
  totalPaidAmount: number;
  totalUnpaidAmount: number;
  startDate: Date;
  endDate: Date;
  siteId?: string;
  siteName?: string;
}

export class SiteRevenueBreakdownDto {
  siteId: string;
  siteName: string;
  productSales: number;
  rentalIncome: number;
  totalRevenue: number;
  invoiceCount: number;
  paidCount: number;
  unpaidCount: number;
}

export class AggregatedRevenueReportDto {
  totalProductSales: number;
  totalRentalIncome: number;
  totalRevenue: number;
  totalInvoices: number;
  totalPaidInvoices: number;
  totalUnpaidInvoices: number;
  totalPaidAmount: number;
  totalUnpaidAmount: number;
  siteBreakdown: SiteRevenueBreakdownDto[];
  startDate: Date;
  endDate: Date;
}
