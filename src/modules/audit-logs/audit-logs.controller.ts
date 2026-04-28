import { Controller, Get, Post, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { AuditLogsService } from './audit-logs.service';
import { AuditLogEntity } from './dto/entities/audit-log.entity';
import { CreateAuditLogDto } from './dto/create-audit-log.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '@prisma/client';
import { CurrentUser, CurrentUserPayload } from '../../common/decorators/current-user.decorator';

@ApiTags('audit-logs')
@Controller('audit-logs')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class AuditLogsController {
  constructor(private readonly auditLogsService: AuditLogsService) {}

  @Post()
  @Roles(UserRole.SUPER_ADMIN)
  @ApiResponse({ status: 201, description: 'Audit log created', type: AuditLogEntity })
  async createAuditLog(
    @Body() createAuditLogDto: CreateAuditLogDto,
    @CurrentUser() user: CurrentUserPayload,
  ): Promise<AuditLogEntity> {
    return this.auditLogsService.createAuditLog(
      user.userId,
      createAuditLogDto.action,
      createAuditLogDto.entityType,
      createAuditLogDto.entityId,
      createAuditLogDto.details,
    );
  }

  @Get()
  @Roles(UserRole.SUPER_ADMIN, UserRole.SITE_MANAGER)
  @ApiResponse({ status: 200, description: 'Get all audit logs', type: [AuditLogEntity] })
  async getAuditLogs(@CurrentUser() user: CurrentUserPayload): Promise<AuditLogEntity[]> {
    const siteFilter = user.role === UserRole.SITE_MANAGER ? user.siteId : undefined;
    return this.auditLogsService.getAuditLogs(siteFilter);
  }
}
