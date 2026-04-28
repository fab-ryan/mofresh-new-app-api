import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { OrdersService } from './orders.service';
import { CreateOrderDto, RejectOrderDto } from './dto';
import { OrderStatus, UserRole } from '@prisma/client';
import { CurrentUser, CurrentUserPayload } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
@ApiTags('Orders')
@Controller('orders')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Post()
  @Roles(UserRole.CLIENT, UserRole.SITE_MANAGER, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Create a new order' })
  @ApiResponse({ status: 201, description: 'Order created successfully' })
  @ApiResponse({ status: 400, description: 'Invalid input or insufficient stock' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async create(@CurrentUser() user: CurrentUserPayload, @Body() createOrderDto: CreateOrderDto) {
    return await this.ordersService.createOrders(user.userId, user.siteId, createOrderDto);
  }

  @Get()
  @Roles(UserRole.CLIENT, UserRole.SITE_MANAGER, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Get all orders with pagination' })
  @ApiResponse({ status: 200, description: 'Orders retrieved successfully' })
  @ApiQuery({
    name: 'status',
    enum: OrderStatus,
    required: false,
    description: 'Filter by order status',
  })
  @ApiQuery({
    name: 'page',
    required: false,
    type: Number,
    description: 'Page number (default: 1)',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Items per page (default: 10, max: 100)',
  })
  async findAll(
    @CurrentUser() user: CurrentUserPayload,
    @Query('status') status?: OrderStatus,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return await this.ordersService.findAllOrders(
      user.siteId,
      user.role as UserRole,
      user.userId,
      status,
      page,
      limit,
    );
  }

  @Get(':id')
  @Roles(UserRole.CLIENT, UserRole.SITE_MANAGER, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Get order by ID' })
  @ApiResponse({ status: 200, description: 'Order retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Order not found' })
  async findOne(@Param('id') id: string, @CurrentUser() user: CurrentUserPayload) {
    return await this.ordersService.findOne(id, user.siteId, user.role as UserRole, user.userId);
  }

  @Patch(':id/approve')
  @Roles(UserRole.SITE_MANAGER, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Approving orders' })
  @ApiResponse({ status: 200, description: 'Order approved successfully' })
  @ApiResponse({ status: 400, description: 'Order cannot be approved' })
  @ApiResponse({ status: 403, description: 'Forbidden - insufficient permissions' })
  @ApiResponse({ status: 404, description: 'Order not found' })
  async approve(@Param('id') id: string, @CurrentUser() user: CurrentUserPayload) {
    return await this.ordersService.approveOrders(id, user.userId, user.siteId);
  }

  @Patch(':id/reject')
  @Roles(UserRole.SITE_MANAGER, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Rejecting orders ' })
  @ApiResponse({ status: 200, description: 'Order rejected successfully' })
  @ApiResponse({ status: 400, description: 'Order cannot be rejected' })
  @ApiResponse({ status: 403, description: 'Forbidden - insufficient permissions' })
  @ApiResponse({ status: 404, description: 'Order not found' })
  async reject(
    @Param('id') id: string,
    @CurrentUser() user: CurrentUserPayload,
    @Body() rejectOrderDto: RejectOrderDto,
  ) {
    return await this.ordersService.rejectOrders(id, user.siteId, user.userId, rejectOrderDto);
  }

  @Delete(':id')
  @Roles(UserRole.CLIENT, UserRole.SITE_MANAGER, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Delete an order (only REQUESTED orders)' })
  @ApiResponse({ status: 200, description: 'Order deleted successfully' })
  @ApiResponse({ status: 400, description: 'Order cannot be deleted' })
  @ApiResponse({ status: 403, description: 'Forbidden - insufficient permissions' })
  @ApiResponse({ status: 404, description: 'Order not found' })
  async delete(@Param('id') id: string, @CurrentUser() user: CurrentUserPayload) {
    return await this.ordersService.deleteOrder(
      id,
      user.userId,
      user.siteId,
      user.role as UserRole,
    );
  }

  @Get('status/:status')
  @Roles(UserRole.CLIENT, UserRole.SITE_MANAGER, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Get orders by status' })
  @ApiResponse({ status: 200, description: 'Orders retrieved successfully' })
  @ApiQuery({
    name: 'page',
    required: false,
    type: Number,
    description: 'Page number (default: 1)',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Items per page (default: 10, max: 100)',
  })
  async findByStatus(
    @Param('status') status: OrderStatus,
    @CurrentUser() user: CurrentUserPayload,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return await this.ordersService.findByStatus(
      user.siteId,
      user.role as UserRole,
      user.userId,
      status,
      page,
      limit,
    );
  }
}
