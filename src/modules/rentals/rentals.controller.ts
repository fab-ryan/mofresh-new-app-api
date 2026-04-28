/* eslint-disable prettier/prettier */
import {
  BadRequestException,
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Query,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { RentalsService } from './rentals.service';
import { CreateRentalDto, GetAvailableAssetsDto } from './dto';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
  ApiParam,
} from '@nestjs/swagger';
import { CurrentUser, CurrentUserPayload } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { AssetType, RentalStatus, UserRole } from '@prisma/client';
import { RolesGuard } from '../../common/guards';
import { Public } from '../../common/decorators/public.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

@ApiTags('Rentals')
@Controller('rentals')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class RentalsController {
  constructor(private readonly rentalsService: RentalsService) { }

  @Public()
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @Roles(UserRole.CLIENT)
  @ApiOperation({ summary: 'Request a rental' })
  @ApiResponse({ status: 201, description: 'Rental requested successfully' })
  @ApiResponse({ status: 400, description: 'Bad request Invalid data or asset not available' })
  @ApiResponse({ status: 401, description: 'Unauthorized  Authentication required' })
  @ApiResponse({ status: 403, description: 'Forbidden  Insufficient permissions' })
  async create(@Body() dto: CreateRentalDto, @CurrentUser() user?: CurrentUserPayload) {
    const userId = user?.userId || dto.clientId;
    const siteId = user?.siteId || dto.siteId;

    if (!userId) {
      throw new BadRequestException('clientId is required for public rental requests');
    }
    if (!siteId) {
      throw new BadRequestException('siteId is required for public rental requests');
    }

    return this.rentalsService.createRental(userId, siteId, dto);
  }

  @Public()
  @Get('available-assets')
  @Roles(UserRole.CLIENT, UserRole.SITE_MANAGER, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Get available assets by type for rental' })
  @ApiResponse({ status: 200, description: 'List of available assets' })
  @ApiResponse({ status: 400, description: 'Bad request - Invalid asset type or missing siteId' })
  @ApiResponse({ status: 401, description: 'Unauthorized - Authentication required' })
  @ApiQuery({
    name: 'assetType',
    required: true,
    enum: AssetType,
    description: 'Type of asset to fetch (COLD_BOX, COLD_PLATE, TRICYCLE, COLD_ROOM)',
  })
  getAvailableAssets(
    @Query() query: GetAvailableAssetsDto,
    @CurrentUser() user?: CurrentUserPayload,
  ) {
    const siteId = user?.siteId || query.siteId;
    if (!siteId) {
      throw new BadRequestException('siteId is required to fetch available assets');
    }
    return this.rentalsService.getAvailableAssetsByType(query.assetType, siteId);
  }

  @Public()
  @Get()
  @Roles(UserRole.CLIENT, UserRole.SITE_MANAGER, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Get all rentals ' })
  @ApiResponse({ status: 200, description: 'List of rentals' })
  @ApiResponse({ status: 401, description: 'Unauthorized - Authentication required' })
  @ApiQuery({ name: 'status', required: false, enum: RentalStatus })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 10 })
  @ApiQuery({ name: 'siteId', required: false, type: String })
  findAll(
    @CurrentUser() user?: CurrentUserPayload,
    @Query('status') status?: RentalStatus,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('siteId') querySiteId?: string,
  ) {
    const siteId = user?.role === UserRole.SUPER_ADMIN ? undefined : (user?.siteId || querySiteId);
    const parsedPage = page ? Number(page) : undefined;
    const parsedLimit = limit ? Number(limit) : undefined;

    return this.rentalsService.findAllRental(
      siteId,
      user?.role as UserRole,
      user?.userId,
      status,
      parsedPage,
      parsedLimit,
    );
  }

  @Public()
  @Get(':id')
  @Roles(UserRole.CLIENT, UserRole.SITE_MANAGER, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Get rental by ID ' })
  @ApiParam({ name: 'id', description: 'Rental ID', type: 'string' })
  @ApiResponse({ status: 200, description: 'Rental found' })
  @ApiResponse({ status: 401, description: 'Unauthorized - Authentication required' })
  @ApiResponse({ status: 404, description: 'Rental not found' })
  findOne(@Param('id') id: string, @CurrentUser() user?: CurrentUserPayload) {
    const siteId = user?.role === UserRole.SUPER_ADMIN ? undefined : user?.siteId;
    return this.rentalsService.findOneRental(id, siteId, user?.role as UserRole, user?.userId);
  }

  @Patch(':id/approve')
  @HttpCode(HttpStatus.OK)
  @Roles(UserRole.SITE_MANAGER, UserRole.SUPER_ADMIN)
  @ApiOperation({
    summary: 'Approve a rental request ',
  })
  @ApiParam({ name: 'id', description: 'Rental ID', type: 'string' })
  @ApiResponse({ status: 200, description: 'Rental approved and invoice generated' })
  @ApiResponse({
    status: 400,
    description: 'Bad request - Rental not in REQUESTED status or asset unavailable',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized - Authentication required' })
  @ApiResponse({ status: 403, description: 'Forbidden - Insufficient permissions' })
  @ApiResponse({ status: 404, description: 'Rental not found' })
  async approve(@Param('id') id: string, @CurrentUser() user: CurrentUserPayload) {
    // Managers must have siteId; Super admin can operate globally but still needs a target site context.
    if (user.role !== UserRole.SUPER_ADMIN && !user.siteId) {
      throw new BadRequestException('Site Manager must belong to a site');
    }

    const siteId = user.siteId;
    if (!siteId) {
      throw new BadRequestException('siteId is required to approve a rental');
    }

    return this.rentalsService.approveRental(id, siteId, user.userId);
  }

  @Patch(':id/activate')
  @HttpCode(HttpStatus.OK)
  @Roles(UserRole.SITE_MANAGER, UserRole.SUPER_ADMIN)
  @ApiOperation({
    summary: 'Activate a rental requires invoice To PAID',
  })
  @ApiParam({ name: 'id', description: 'Rental ID', type: 'string' })
  @ApiResponse({ status: 200, description: 'Rental activated and asset marked as RENTED' })
  @ApiResponse({
    status: 400,
    description: 'Bad request - Rental not APPROVED or invoice not PAID',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized - Authentication required' })
  @ApiResponse({ status: 403, description: 'Forbidden - Insufficient permissions' })
  @ApiResponse({ status: 404, description: 'Rental not found' })
  async activate(@Param('id') id: string, @CurrentUser() user: CurrentUserPayload) {
    if (user.role !== UserRole.SUPER_ADMIN && !user.siteId) {
      throw new BadRequestException('Site Manager must belong to a site');
    }

    const siteId = user.siteId;
    if (!siteId) {
      throw new BadRequestException('siteId is required to activate a rental');
    }

    return this.rentalsService.activateRental(id, siteId, user.userId);
  }

  @Patch(':id/complete')
  @HttpCode(HttpStatus.OK)
  @Roles(UserRole.SITE_MANAGER, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Complete a rental (ACTIVE → COMPLETED, asset AVAILABLE)' })
  @ApiParam({ name: 'id', description: 'Rental ID', type: 'string' })
  @ApiResponse({ status: 200, description: 'Rental completed and asset marked as AVAILABLE' })
  @ApiResponse({ status: 400, description: 'Bad request - Rental not ACTIVE' })
  @ApiResponse({ status: 401, description: 'Unauthorized - Authentication required' })
  @ApiResponse({ status: 403, description: 'Forbidden - Insufficient permissions' })
  @ApiResponse({ status: 404, description: 'Rental not found' })
  async complete(@Param('id') id: string, @CurrentUser() user: CurrentUserPayload) {
    if (user.role !== UserRole.SUPER_ADMIN && !user.siteId) {
      throw new BadRequestException('Site Manager must belong to a site');
    }

    const siteId = user.siteId;
    if (!siteId) {
      throw new BadRequestException('siteId is required to complete a rental');
    }

    return this.rentalsService.complete(id, siteId, user.userId);
  }

  @Patch(':id/cancel')
  @HttpCode(HttpStatus.OK)
  @Roles(UserRole.CLIENT, UserRole.SITE_MANAGER, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Cancel a rental request (REQUESTED or APPROVED → CANCELLED)' })
  @ApiParam({ name: 'id', description: 'Rental ID', type: 'string' })
  @ApiResponse({ status: 200, description: 'Rental cancelled successfully' })
  @ApiResponse({
    status: 400,
    description: 'Bad request - Cannot cancel ACTIVE or COMPLETED rental',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized - Authentication required' })
  @ApiResponse({ status: 403, description: 'Forbidden - Can only cancel own rentals' })
  @ApiResponse({ status: 404, description: 'Rental not found' })
  async cancel(@Param('id') id: string, @CurrentUser() user: CurrentUserPayload) {
    if (user.role !== UserRole.SUPER_ADMIN && !user.siteId) {
      throw new BadRequestException('User must belong to a site');
    }

    const siteId = user.siteId || ''; // Super admin can use empty, will be filtered in service
    return this.rentalsService.cancelRental(id, siteId, user.userId, user.role as UserRole);
  }
}
