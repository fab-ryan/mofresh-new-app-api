import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  Param,
  ParseUUIDPipe,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { StockMovementsService } from './stock-movements.service';
import { CreateStockMovementDto } from './dto/create-stock-movement.dto';
import { StockMovementQueryDto } from './dto/stock-movement-query.dto';
import { RolesGuard } from '@/common/guards';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';
import { Roles, CurrentUser } from '@/common/decorators';
import { UserRole } from '@prisma/client';
import { CurrentUserPayload } from '@/common/decorators/current-user.decorator';

@ApiTags('Stock Management')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('stock-movements')
export class StockMovementsController {
  constructor(private readonly service: StockMovementsService) {}

  @Post()
  @Roles(UserRole.SITE_MANAGER, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Record a new stock movement' })
  async record(@Body() dto: CreateStockMovementDto, @CurrentUser() user: CurrentUserPayload) {
    return this.service.recordMovement(dto, user);
  }

  @Get()
  @Roles(UserRole.SUPER_ADMIN, UserRole.SITE_MANAGER)
  @ApiOperation({ summary: 'View movement history (Audit Trail)' })
  async getHistory(
    @Query() filters: StockMovementQueryDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.service.findAll(filters, user);
  }

  @Post(':id/revert')
  @Roles(UserRole.SUPER_ADMIN, UserRole.SITE_MANAGER)
  @ApiOperation({ summary: 'Revert an erroneous stock entry' })
  async revert(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: CurrentUserPayload) {
    return this.service.revertMovement(id, user);
  }
}
