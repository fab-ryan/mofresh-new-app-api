import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { StockMovementType, UserRole, AuditAction, Prisma } from '@prisma/client';
import { CreateStockMovementDto } from './dto/create-stock-movement.dto';
import { StockMovementQueryDto } from './dto/stock-movement-query.dto';
import { CurrentUserPayload } from '@/common/decorators/current-user.decorator';
import { AuditLogsService } from '../audit-logs/audit-logs.service';

@Injectable()
export class StockMovementsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditLogsService,
  ) {}

  async recordMovement(dto: CreateStockMovementDto, user: CurrentUserPayload) {
    const { productId, coldRoomId, quantityKg, movementType, reason, supplierId } = dto;

    const product = await this.prisma.product.findUnique({ where: { id: productId } });
    if (!product) throw new NotFoundException('Product not found');

    const coldRoom = await this.prisma.coldRoom.findUnique({ where: { id: coldRoomId } });
    if (!coldRoom) throw new NotFoundException('Cold room not found');

    if (user.role === UserRole.SITE_MANAGER) {
      if (product.siteId !== user.siteId || coldRoom.siteId !== user.siteId) {
        throw new ForbiddenException('You can only record movements for your own site.');
      }
    }

    let finalReason = reason;
    if (movementType === StockMovementType.IN && supplierId) {
      finalReason = `SUPPLIER_ID:${supplierId} | ${reason || 'Supply delivery'}`;
    }

    return this.prisma.$transaction(async (tx) => {
      let newQuantity = product.quantityKg;
      if (movementType === StockMovementType.IN) {
        newQuantity += quantityKg;
      } else {
        if (product.quantityKg < quantityKg) {
          throw new BadRequestException('Insufficient stock balance');
        }
        newQuantity -= quantityKg;
      }

      await tx.product.update({
        where: { id: productId },
        data: { quantityKg: newQuantity },
      });

      // Update Cold Room used capacity
      const capacityAdjustment = movementType === StockMovementType.IN ? quantityKg : -quantityKg;
      await tx.coldRoom.update({
        where: { id: coldRoomId },
        data: { usedCapacityKg: { increment: capacityAdjustment } },
      });

      const movement = await tx.stockMovement.create({
        data: {
          productId,
          coldRoomId,
          quantityKg,
          movementType,
          reason,
          createdBy: user.userId,
        },
        include: { product: true },
      });

      await tx.auditLog.create({
        data: {
          action: AuditAction.CREATE,
          entityType: 'StockMovement',
          entityId: movement.id,
          userId: user.userId,
          details: {
            productId,
            movementType,
            quantityKg,
            reason: finalReason,
            newQuantity,
          },
          timestamp: new Date(),
        },
      });

      return movement;
    });
  }

  async findSupplierHistory(user: CurrentUserPayload, filters: StockMovementQueryDto) {
    const { page = 1, limit = 20 } = filters;
    const skip = (page - 1) * limit;

    const where: Prisma.StockMovementWhereInput = {
      movementType: StockMovementType.IN,
      reason: {
        contains: `SUPPLIER_ID:${user.userId}`,
      },
    };

    const [data, total] = await Promise.all([
      this.prisma.stockMovement.findMany({
        where,
        include: {
          product: { select: { name: true, unit: true } },
          coldRoom: {
            select: {
              name: true,
              site: { select: { name: true } },
            },
          },
        },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.stockMovement.count({ where }),
    ]);

    return {
      data,
      pagination: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async revertMovement(movementId: string, user: CurrentUserPayload) {
    return this.prisma.$transaction(async (tx) => {
      const originalMovement = await tx.stockMovement.findUnique({
        where: { id: movementId },
        include: { product: true },
      });

      if (!originalMovement) throw new NotFoundException('Movement record not found');

      if (user.role === UserRole.SITE_MANAGER && originalMovement.product.siteId !== user.siteId) {
        throw new ForbiddenException('You cannot revert movements for other sites.');
      }

      const isRevertingAddition = originalMovement.movementType === StockMovementType.IN;
      const adjustment = isRevertingAddition
        ? -originalMovement.quantityKg
        : originalMovement.quantityKg;

      if (
        isRevertingAddition &&
        originalMovement.product.quantityKg < originalMovement.quantityKg
      ) {
        throw new BadRequestException('Cannot revert: resulting stock would be negative');
      }

      await tx.product.update({
        where: { id: originalMovement.productId },
        data: { quantityKg: { increment: adjustment } },
      });

      await tx.coldRoom.update({
        where: { id: originalMovement.coldRoomId },
        data: { usedCapacityKg: { increment: adjustment } },
      });

      const reversalMovement = await tx.stockMovement.create({
        data: {
          productId: originalMovement.productId,
          coldRoomId: originalMovement.coldRoomId,
          quantityKg: originalMovement.quantityKg,
          movementType: isRevertingAddition ? StockMovementType.OUT : StockMovementType.IN,
          reason: `REVERSAL of movement ID: ${movementId}`,
          createdBy: user.userId,
        },
      });

      await tx.auditLog.create({
        data: {
          action: AuditAction.UPDATE,
          entityType: 'StockMovement',
          entityId: reversalMovement.id,
          userId: user.userId,
          details: {
            action: 'REVERSAL',
            originalMovementId: movementId,
            originalMovementType: originalMovement.movementType,
            quantityKg: originalMovement.quantityKg,
            revertedBy: user.userId,
          },
          timestamp: new Date(),
        },
      });

      return reversalMovement;
    });
  }

  async findAll(filters: StockMovementQueryDto, user: CurrentUserPayload) {
    const { productId, coldRoomId, movementType, dateFrom, dateTo, page = 1, limit = 20 } = filters;
    const skip = (page - 1) * limit;
    const where: Prisma.StockMovementWhereInput = {};

    if (user.role === UserRole.SITE_MANAGER) {
      where.product = { siteId: user.siteId };
    }

    if (productId) where.productId = productId;
    if (coldRoomId) where.coldRoomId = coldRoomId;
    if (movementType) where.movementType = movementType;

    if (dateFrom || dateTo) {
      where.createdAt = {};
      if (dateFrom) where.createdAt.gte = new Date(dateFrom);
      if (dateTo) where.createdAt.lte = new Date(dateTo);
    }

    const [data, total] = await Promise.all([
      this.prisma.stockMovement.findMany({
        where,
        include: {
          product: { select: { name: true, unit: true, siteId: true } },
          coldRoom: { select: { name: true } },
          user: { select: { firstName: true, lastName: true } },
        },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.stockMovement.count({ where }),
    ]);

    return {
      data,
      pagination: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }
}
