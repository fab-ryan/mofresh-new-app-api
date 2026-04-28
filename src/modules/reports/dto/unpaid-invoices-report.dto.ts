import { IsOptional, IsBoolean, IsUUID, IsInt, Min, Max } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { InvoiceStatus } from '@prisma/client';

export class UnpaidInvoicesQueryDto {
  @ApiPropertyOptional({
    description: 'Filter by specific site ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsOptional()
  @IsUUID()
  siteId?: string;

  @ApiPropertyOptional({
    description: 'Filter only overdue invoices',
    example: true,
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  overdue?: boolean;

  @ApiPropertyOptional({
    description: 'Page number for pagination',
    example: 1,
    default: 1,
    minimum: 1,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  page?: number;

  @ApiPropertyOptional({
    description: 'Number of items per page',
    example: 10,
    default: 10,
    minimum: 1,
    maximum: 100,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  @Type(() => Number)
  limit?: number;
}

export class UnpaidInvoiceItemDto {
  id: string;
  invoiceNumber: string;
  clientId: string;
  clientName?: string;
  siteId: string;
  siteName?: string;
  totalAmount: number;
  paidAmount: number;
  balanceDue: number;
  dueDate: Date;
  daysOverdue: number;
  status: InvoiceStatus;
  orderId?: string;
  rentalId?: string;
  createdAt: Date;
}

export class UnpaidInvoicesReportDto {
  data: UnpaidInvoiceItemDto[];
  summary: {
    totalUnpaidInvoices: number;
    totalBalanceDue: number;
    totalOverdueInvoices: number;
    totalOverdueAmount: number;
  };
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}
