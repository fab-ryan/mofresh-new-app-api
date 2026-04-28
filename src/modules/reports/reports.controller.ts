import { Controller, Get, Query, Logger, UseGuards, BadRequestException } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiQuery,
  ApiBearerAuth,
  ApiExtraModels,
  getSchemaPath,
} from '@nestjs/swagger';
import { ReportsService } from './reports.service';
import {
  RevenueReportQueryDto,
  RevenueReportResponseDto,
  AggregatedRevenueReportDto,
  UnpaidInvoicesQueryDto,
  UnpaidInvoicesReportDto,
} from './dto';
import { RolesGuard } from '../../common/guards';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { Roles, CurrentUser, CurrentUserPayload } from '../../common/decorators';
import { UserRole } from '@prisma/client';

@ApiTags('Reports')
@Controller('reports')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
@ApiExtraModels(RevenueReportResponseDto, AggregatedRevenueReportDto)
export class ReportsController {
  private readonly logger = new Logger(ReportsController.name);

  constructor(private readonly reportsService: ReportsService) {}

  @Get('revenue')
  @Roles(UserRole.SITE_MANAGER, UserRole.SUPER_ADMIN)
  @ApiOperation({
    summary: 'Get revenue report',
    description:
      'Generate revenue report aggregating product sales and rental income. ' +
      'Site Managers see only their site. Super Admin can see all sites or filter by site.',
  })
  @ApiResponse({
    status: 200,
    description: 'Revenue report generated successfully',
    schema: {
      oneOf: [
        { $ref: getSchemaPath(RevenueReportResponseDto) },
        { $ref: getSchemaPath(AggregatedRevenueReportDto) },
      ],
    },
  })
  @ApiQuery({ name: 'startDate', required: false, type: String })
  @ApiQuery({ name: 'endDate', required: false, type: String })
  @ApiQuery({ name: 'siteId', required: false, type: String })
  async getRevenueReport(
    @Query() query: RevenueReportQueryDto,
    @CurrentUser() user: CurrentUserPayload,
  ): Promise<RevenueReportResponseDto | AggregatedRevenueReportDto> {
    this.logger.log('Revenue report requested', { query });

    let userSiteId: string | undefined;

    if (user.role === UserRole.SUPER_ADMIN) {
      userSiteId = undefined; // Can access all sites
    } else if (user.role === UserRole.SITE_MANAGER) {
      if (!user.siteId) {
        throw new BadRequestException('Site manager must have a valid site assignment');
      }
      userSiteId = user.siteId;
    }

    return this.reportsService.getRevenueReport(query, userSiteId);
  }

  @Get('unpaid-invoices')
  @Roles(UserRole.SITE_MANAGER, UserRole.SUPER_ADMIN)
  @ApiOperation({
    summary: 'Get unpaid invoices report',
    description:
      'List all unpaid invoices with balance due and days overdue. ' +
      'Supports pagination and filtering by site and overdue status.',
  })
  @ApiResponse({
    status: 200,
    description: 'Unpaid invoices report generated successfully',
    type: UnpaidInvoicesReportDto,
  })
  @ApiQuery({ name: 'siteId', required: false, type: String })
  @ApiQuery({ name: 'overdue', required: false, type: Boolean })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  async getUnpaidInvoicesReport(
    @Query() query: UnpaidInvoicesQueryDto,
    @CurrentUser() user: CurrentUserPayload,
  ): Promise<UnpaidInvoicesReportDto> {
    this.logger.log('Unpaid invoices report requested', { query });

    let userSiteId: string | undefined;

    if (user.role === UserRole.SUPER_ADMIN) {
      userSiteId = undefined;
    } else if (user.role === UserRole.SITE_MANAGER) {
      if (!user.siteId) {
        throw new BadRequestException('Site manager must have a valid site assignment');
      }
      userSiteId = user.siteId;
    }

    return this.reportsService.getUnpaidInvoicesReport(query, userSiteId);
  }
}
