import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { AuditAction, Prisma } from '@prisma/client';
import { AuditLogEntity } from './dto/entities/audit-log.entity';
import { plainToInstance } from 'class-transformer';

@Injectable()
export class AuditLogsService {
  constructor(private readonly prisma: PrismaService) {}

  async createAuditLog(
    userId: string,
    action: AuditAction,
    entityType: string,
    entityId: string,
    details?: Prisma.InputJsonValue,
  ): Promise<AuditLogEntity> {
    try {
      const createdAuditLog = await this.prisma.auditLog.create({
        data: {
          userId,
          action,
          entityType,
          entityId,
          details: details ?? Prisma.JsonNull,
          timestamp: new Date(),
        },
        include: {
          user: true,
        },
      });

      return plainToInstance(AuditLogEntity, createdAuditLog);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2003') {
        throw new BadRequestException('Invalid userId');
      }
      throw error;
    }
  }

  async getAuditLogs(siteId?: string): Promise<AuditLogEntity[]> {
    const where: Prisma.AuditLogWhereInput = {};
    if (siteId) {
      where.user = { siteId };
    }

    const auditLogs = await this.prisma.auditLog.findMany({
      where,
      include: {
        user: true,
      },
    });

    return plainToInstance(AuditLogEntity, auditLogs);
  }
}
