import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiBearerAuth } from '@nestjs/swagger';
import { InvoicesService } from './invoices.service';
import {
  GenerateOrderInvoiceDto,
  GenerateRentalInvoiceDto,
  InvoiceResponseDto,
  QueryInvoicesDto,
  MarkPaidDto,
  VoidInvoiceDto,
} from './dto';
import { RolesGuard } from '../../common/guards';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { Roles } from '../../common/decorators';
import { CurrentUser, CurrentUserPayload } from '../../common/decorators';

import { UserRole } from '@prisma/client';

@ApiTags('Invoices')
@Controller('invoices')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class InvoicesController {
  constructor(private readonly invoicesService: InvoicesService) {}

  @Post('generate/order')
  @HttpCode(HttpStatus.CREATED)
  @Roles(UserRole.SITE_MANAGER, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Generate invoice for an approved order' })
  @ApiResponse({
    status: 201,
    description: 'Invoice successfully generated',
    type: InvoiceResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Bad request - Order not approved or insufficient data',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Authentication required',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Insufficient permissions',
  })
  @ApiResponse({
    status: 404,
    description: 'Order not found',
  })
  @ApiResponse({
    status: 409,
    description: 'Invoice already exists for this order',
  })
  async generateOrderInvoice(
    @Body() dto: GenerateOrderInvoiceDto,
    @CurrentUser() user: CurrentUserPayload,
  ): Promise<InvoiceResponseDto> {
    const dueDate = dto.dueDate ? new Date(dto.dueDate) : undefined;
    const userSiteId = user.role === UserRole.SUPER_ADMIN ? undefined : user.siteId;
    return this.invoicesService.generateOrderInvoice(dto.orderId, dueDate, user.userId, userSiteId);
  }

  @Post('generate/rental')
  @HttpCode(HttpStatus.CREATED)
  @Roles(UserRole.SITE_MANAGER, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Generate invoice for an approved rental' })
  @ApiResponse({
    status: 201,
    description: 'Invoice successfully generated',
    type: InvoiceResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Bad request - Rental not approved or insufficient data',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Authentication required',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Insufficient permissions',
  })
  @ApiResponse({
    status: 404,
    description: 'Rental not found',
  })
  @ApiResponse({
    status: 409,
    description: 'Invoice already exists for this rental',
  })
  async generateRentalInvoice(
    @Body() dto: GenerateRentalInvoiceDto,
    @CurrentUser() user: CurrentUserPayload,
  ): Promise<InvoiceResponseDto> {
    const dueDate = dto.dueDate ? new Date(dto.dueDate) : undefined;
    const userSiteId = user.role === UserRole.SUPER_ADMIN ? undefined : user.siteId;
    return this.invoicesService.generateRentalInvoice(
      dto.rentalId,
      dueDate,
      user.userId,
      userSiteId,
    );
  }

  @Get()
  @Roles(UserRole.SITE_MANAGER, UserRole.SUPER_ADMIN, UserRole.CLIENT, UserRole.SUPPLIER)
  @ApiOperation({ summary: 'Get all invoices with optional filters' })
  @ApiResponse({
    status: 200,
    description: 'List of invoices',
    type: [InvoiceResponseDto],
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Authentication required',
  })
  async findAll(@Query() query: QueryInvoicesDto, @CurrentUser() user: CurrentUserPayload) {
    // Apply role-based scoping
    let siteId: string | undefined;
    let clientId: string | undefined;

    if (user.role === UserRole.SITE_MANAGER) {
      if (!user.siteId) {
        throw new BadRequestException('Site manager must have a valid site assignment');
      }
      siteId = user.siteId;
    } else if (user.role === UserRole.CLIENT) {
      // Clients can only see their own invoices
      clientId = user.userId;
    } else if (user.role === UserRole.SUPPLIER) {
      if (!user.siteId) {
        throw new BadRequestException('Supplier must have a valid site assignment');
      }
      siteId = user.siteId;
    }

    return this.invoicesService.findAll(query, siteId, clientId);
  }

  @Get(':id')
  @Roles(UserRole.SITE_MANAGER, UserRole.SUPER_ADMIN, UserRole.CLIENT, UserRole.SUPPLIER)
  @ApiOperation({ summary: 'Get invoice by ID' })
  @ApiParam({
    name: 'id',
    description: 'Invoice ID',
    type: 'string',
  })
  @ApiResponse({
    status: 200,
    description: 'Invoice found',
    type: InvoiceResponseDto,
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Authentication required',
  })
  @ApiResponse({
    status: 404,
    description: 'Invoice not found',
  })
  async findOne(
    @Param('id') id: string,
    @CurrentUser() user: CurrentUserPayload,
  ): Promise<InvoiceResponseDto> {
    let siteId: string | undefined;
    let clientId: string | undefined;

    if (user.role === UserRole.SITE_MANAGER) {
      if (!user.siteId) {
        throw new BadRequestException('Site manager must have a valid site assignment');
      }
      siteId = user.siteId;
    } else if (user.role === UserRole.CLIENT) {
      clientId = user.userId;
    } else if (user.role === UserRole.SUPPLIER) {
      if (!user.siteId) {
        throw new BadRequestException('Supplier must have a valid site assignment');
      }
      siteId = user.siteId;
    }

    return this.invoicesService.findOne(id, siteId, clientId);
  }

  @Get('number/:invoiceNumber')
  @Roles(UserRole.SITE_MANAGER, UserRole.SUPER_ADMIN, UserRole.CLIENT, UserRole.SUPPLIER)
  @ApiOperation({ summary: 'Get invoice by invoice number' })
  @ApiParam({
    name: 'invoiceNumber',
    description: 'Invoice number',
    type: 'string',
  })
  @ApiResponse({
    status: 200,
    description: 'Invoice found',
    type: InvoiceResponseDto,
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Authentication required',
  })
  @ApiResponse({
    status: 404,
    description: 'Invoice not found',
  })
  async findByInvoiceNumber(
    @Param('invoiceNumber') invoiceNumber: string,
    @CurrentUser() user: CurrentUserPayload,
  ): Promise<InvoiceResponseDto> {
    const siteId = user.role === UserRole.SITE_MANAGER ? user.siteId || undefined : undefined;
    return this.invoicesService.findByInvoiceNumber(invoiceNumber, siteId);
  }

  @Patch(':id/mark-paid')
  @HttpCode(HttpStatus.OK)
  @Roles(UserRole.SITE_MANAGER, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Mark invoice as paid (manual payment)' })
  @ApiParam({
    name: 'id',
    description: 'Invoice ID',
    type: 'string',
  })
  @ApiResponse({
    status: 200,
    description: 'Invoice payment recorded successfully',
    type: InvoiceResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Bad request - Cannot mark voided invoice as paid',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Authentication required',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Insufficient permissions',
  })
  @ApiResponse({
    status: 404,
    description: 'Invoice not found',
  })
  async markPaid(
    @Param('id') id: string,
    @Body() dto: MarkPaidDto,
    @CurrentUser() user: CurrentUserPayload,
  ): Promise<InvoiceResponseDto> {
    const userSiteId = user.role === UserRole.SUPER_ADMIN ? undefined : user.siteId;
    return this.invoicesService.markPaid(id, dto.paymentAmount, user.userId, userSiteId);
  }

  @Patch(':id/void')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Roles(UserRole.SITE_MANAGER, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Void an invoice' })
  @ApiParam({
    name: 'id',
    description: 'Invoice ID',
    type: 'string',
  })
  @ApiResponse({
    status: 204,
    description: 'Invoice voided successfully',
  })
  @ApiResponse({
    status: 400,
    description: 'Bad request - Cannot void paid invoice or already voided',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Authentication required',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Insufficient permissions',
  })
  @ApiResponse({
    status: 404,
    description: 'Invoice not found',
  })
  async voidInvoice(
    @Param('id') id: string,
    @Body() dto: VoidInvoiceDto,
    @CurrentUser() user: CurrentUserPayload,
  ): Promise<void> {
    const userSiteId = user.role === UserRole.SUPER_ADMIN ? undefined : user.siteId;
    return this.invoicesService.voidInvoice(id, dto.reason, user.userId, userSiteId);
  }
}
