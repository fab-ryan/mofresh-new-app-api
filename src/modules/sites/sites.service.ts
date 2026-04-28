import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { CreateSiteDto } from './dto/create-site.dto';
import { UpdateSiteDto } from './dto/update-site.dto';
import { SiteEntity } from './dto/entities/site.entity';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { AuditAction } from '@prisma/client';

@Injectable()
export class SitesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogsService: AuditLogsService,
  ) {}

  async create(createSiteDto: CreateSiteDto, userId: string): Promise<SiteEntity> {
    const site = await this.prisma.site.create({
      data: createSiteDto,
    });

    await this.auditLogsService.createAuditLog(userId, AuditAction.CREATE, 'SITE', site.id, {
      name: site.name,
    });

    return site;
  }

  async findAll(siteId?: string): Promise<SiteEntity[]> {
    return this.prisma.site.findMany({
      where: {
        deletedAt: null,
        ...(siteId && { id: siteId }),
      },
    });
  }

  async findOne(id: string): Promise<SiteEntity | null> {
    return this.prisma.site.findUnique({
      where: { id },
    });
  }

  async update(id: string, updateSiteDto: UpdateSiteDto, userId: string): Promise<SiteEntity> {
    const updatedSite = await this.prisma.site.update({
      where: { id },
      data: updateSiteDto,
    });

    await this.auditLogsService.createAuditLog(userId, AuditAction.UPDATE, 'SITE', id, {
      updatedFields: Object.keys(updateSiteDto),
    });

    return updatedSite;
  }

  async remove(id: string, userId: string): Promise<SiteEntity> {
    const site = await this.findOne(id);
    if (!site) {
      throw new NotFoundException(`Site with ID ${id} not found`);
    }
    if (site.deletedAt) {
      throw new BadRequestException('Site is already deleted');
    }

    const updatedSite = await this.prisma.site.update({
      where: { id },
      data: {
        deletedAt: new Date(),
        // Also deactivate manager if exists
        manager: site.managerId
          ? {
              update: { isActive: false },
            }
          : undefined,
      },
    });

    await this.auditLogsService.createAuditLog(userId, AuditAction.DELETE, 'SITE', id, {
      reason: 'Soft deleted',
    });

    return updatedSite;
  }
}
