/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from './../../database/prisma.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { AdjustStockDto } from './dto/adjust-stock.dto';
import { ProductEntity } from './entities/product.entity';
import { ProductStatus, StockMovementType, UserRole, AuditAction, Prisma } from '@prisma/client';
import { CurrentUserPayload } from '@/common/decorators/current-user.decorator';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { CloudinaryService } from '../cloudinary/cloudinary.service';

@Injectable()
export class ProductsService {
  constructor(
    private prisma: PrismaService,
    private auditService: AuditLogsService,
    private cloudinaryService: CloudinaryService,
  ) {}

  async create(
    dto: CreateProductDto,
    user: CurrentUserPayload,
    image?: Express.Multer.File,
  ): Promise<ProductEntity> {
    if (user.role === UserRole.SITE_MANAGER) {
      dto.siteId = user.siteId;
    }

    return this.prisma.$transaction(async (tx) => {
      const room = await tx.coldRoom.findUnique({ where: { id: dto.coldRoomId } });

      if (!room) throw new NotFoundException('Cold room not found');

      // ensuring the cold room actually belongs to the site assigned to the product
      if (room.siteId !== dto.siteId) {
        throw new BadRequestException('Selected cold room does not belong to the product site');
      }

      if ((room as any).status !== 'AVAILABLE') {
        throw new BadRequestException(
          `Cannot add product: Cold room is currently ${(room as any).status}`,
        );
      }

      if (room.usedCapacityKg + dto.quantityKg > room.totalCapacityKg) {
        throw new BadRequestException('Not enough space in the selected cold room');
      }

      let imageUrl: string | undefined;
      if (image) {
        const upload = await this.cloudinaryService.uploadImage(image);
        imageUrl = upload.secure_url;
      }

      const product = await tx.product.create({
        data: {
          ...dto,
          ...(imageUrl && { imageUrl }),
          status: ProductStatus.IN_STOCK,
        },
      });

      await tx.stockMovement.create({
        data: {
          productId: product.id,
          coldRoomId: dto.coldRoomId,
          quantityKg: dto.quantityKg,
          movementType: StockMovementType.IN,
          reason: 'Initial Inventory Setup',
          createdBy: user.userId,
        },
      });

      await tx.coldRoom.update({
        where: { id: dto.coldRoomId },
        data: { usedCapacityKg: { increment: dto.quantityKg } },
      });

      await tx.auditLog.create({
        data: {
          action: AuditAction.CREATE,
          entityType: 'Product',
          entityId: product.id,
          userId: user.userId,
          details: {
            productName: product.name,
            siteId: product.siteId,
            quantityKg: dto.quantityKg,
          },
          timestamp: new Date(),
        },
      });

      return new ProductEntity(product);
    });
  }

  async findAll(
    user: CurrentUserPayload,
    siteId?: string,
    category?: string,
  ): Promise<ProductEntity[]> {
    const where: any = { deletedAt: null };

    if (category) where.category = category;

    if (!user) {
      where.status = ProductStatus.IN_STOCK;
      if (siteId) where.siteId = siteId;
    } else {
      if (user.role === UserRole.SUPER_ADMIN) {
        if (siteId) where.siteId = siteId;
      } else {
        where.siteId = user.siteId;
      }
    }
    console.log('Product query where clause:', user);

    const products = await this.prisma.product.findMany({
      where,
      include: {
        site: { select: { name: true } },
        coldRoom: { select: { name: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    return products.map((p) => new ProductEntity(p));
  }

  async findOne(id: string, user?: CurrentUserPayload): Promise<ProductEntity> {
    const product = await this.prisma.product.findFirst({
      where: { id, deletedAt: null },
      include: {
        supplier: { select: { firstName: true, lastName: true, email: true } },
        coldRoom: { select: { name: true, powerType: true } },
        site: { select: { name: true, location: true } },
      },
    });

    if (!product) throw new NotFoundException(`Product with ID ${id} not found`);

    if (!user) {
      if (product.status !== ProductStatus.IN_STOCK) {
        throw new ForbiddenException('This product is currently not available');
      }
    } else if (user.role !== UserRole.SUPER_ADMIN && product.siteId !== user.siteId) {
      throw new ForbiddenException(
        'You do not have permission to access products outside your site',
      );
    }

    return new ProductEntity(product);
  }

  async update(
    id: string,
    dto: UpdateProductDto,
    user: CurrentUserPayload,
    image?: Express.Multer.File,
  ): Promise<ProductEntity> {
    const existingProduct = await this.findOne(id, user);

    if (image) {
      const upload = await this.cloudinaryService.uploadImage(image);
      dto.imageUrl = upload.secure_url;
    }

    // Fix: Only block site manager if they try to CHANGE the site
    if (
      user.role === UserRole.SITE_MANAGER &&
      dto.siteId &&
      dto.siteId !== existingProduct.siteId
    ) {
      throw new ForbiddenException('Only an admin can replace the product site');
    }

    if (dto.coldRoomId || dto.siteId) {
      const targetSiteId = dto.siteId || existingProduct.siteId;
      const targetColdRoomId = dto.coldRoomId || existingProduct.coldRoomId;

      if (targetColdRoomId) {
        const room = await this.prisma.coldRoom.findUnique({
          where: { id: targetColdRoomId },
        });

        if (!room || room.siteId !== targetSiteId) {
          throw new BadRequestException(
            'The selected cold room does not belong to the target site',
          );
        }
      }
    }

    return this.prisma.$transaction(async (tx) => {
      if (dto.coldRoomId && dto.coldRoomId !== existingProduct.coldRoomId) {
        const targetRoom = await tx.coldRoom.findUnique({ where: { id: dto.coldRoomId } });
        const targetSiteId = dto.siteId || existingProduct.siteId;

        if (!targetRoom || targetRoom.siteId !== targetSiteId) {
          throw new BadRequestException('Target cold room does not belong to the correct site');
        }

        if ((targetRoom as any).status !== 'AVAILABLE') {
          throw new BadRequestException(`Target room is ${(targetRoom as any).status}`);
        }

        if (targetRoom.usedCapacityKg + existingProduct.quantityKg > targetRoom.totalCapacityKg) {
          throw new BadRequestException('Target cold room does not have enough space');
        }

        await tx.coldRoom.update({
          where: { id: existingProduct.coldRoomId },
          data: { usedCapacityKg: { decrement: existingProduct.quantityKg } },
        });

        await tx.coldRoom.update({
          where: { id: dto.coldRoomId },
          data: { usedCapacityKg: { increment: existingProduct.quantityKg } },
        });
      }

      const updated = await tx.product.update({
        where: { id },
        data: {
          ...dto,
        },
        include: {
          site: { select: { name: true } },
          coldRoom: { select: { name: true } },
        },
      });

      await this.auditService.createAuditLog(user.userId, AuditAction.UPDATE, 'Product', id, {
        productName: updated.name,
      } as Prisma.InputJsonValue);

      return new ProductEntity({
        ...updated,
        status: updated.status,
      });
    });
  }

  async adjustStock(
    id: string,
    dto: AdjustStockDto,
    user: CurrentUserPayload,
  ): Promise<ProductEntity> {
    await this.findOne(id, user);

    return this.prisma.$transaction(async (tx) => {
      const product = await tx.product.findUnique({
        where: { id },
      });

      if (!product) throw new NotFoundException('Product not found');

      const isIncrement = dto.movementType === StockMovementType.IN;
      const weightChange = isIncrement ? dto.quantityKg : -dto.quantityKg;
      const newQuantity = product.quantityKg + weightChange;

      if (newQuantity < 0) throw new BadRequestException('Insufficient stock for this operation');

      if (isIncrement) {
        const coldRoom = await tx.coldRoom.findUnique({ where: { id: product.coldRoomId } });

        if (!coldRoom) {
          throw new NotFoundException('Associated cold room not found');
        }

        if ((coldRoom as any).status !== 'AVAILABLE') {
          throw new BadRequestException(
            `Cannot add stock: Cold room is currently ${String((coldRoom as any).status || 'unavailable')}`,
          );
        }

        if (coldRoom.usedCapacityKg + dto.quantityKg > coldRoom.totalCapacityKg) {
          throw new BadRequestException(
            `Storage capacity exceeded. Available: ${coldRoom.totalCapacityKg - coldRoom.usedCapacityKg}kg, Requested: ${dto.quantityKg}kg`,
          );
        }
      }

      const updated = await tx.product.update({
        where: { id },
        data: {
          quantityKg: newQuantity,
          status: newQuantity > 0 ? ProductStatus.IN_STOCK : ProductStatus.OUT_OF_STOCK,
        },
      });

      await tx.coldRoom.update({
        where: { id: product.coldRoomId },
        data: { usedCapacityKg: { increment: weightChange } },
      });

      await tx.stockMovement.create({
        data: {
          productId: id,
          coldRoomId: product.coldRoomId,
          quantityKg: dto.quantityKg,
          movementType: dto.movementType,
          reason: dto.reason,
          createdBy: user.userId,
        },
      });

      await tx.auditLog.create({
        data: {
          action: AuditAction.UPDATE,
          entityType: 'StockMovement',
          entityId: id,
          userId: user.userId,
          details: {
            movementType: dto.movementType,
            quantityKg: dto.quantityKg,
            reason: dto.reason,
            newQuantity,
          },
          timestamp: new Date(),
        },
      });

      return new ProductEntity(updated);
    });
  }

  async remove(id: string, user: CurrentUserPayload): Promise<{ message: string }> {
    const product = await this.prisma.product.findUnique({
      where: { id, deletedAt: null },
    });

    if (!product) {
      throw new NotFoundException(`Product with ID ${id} not found`);
    }
    if (user.role === UserRole.SITE_MANAGER && product.siteId !== user.siteId) {
      throw new ForbiddenException(
        'Unauthorized access: You can only delete products belonging to your site',
      );
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.product.update({
        where: { id },
        data: {
          deletedAt: new Date(),
          status: ProductStatus.OUT_OF_STOCK,
        },
      });

      await tx.coldRoom.update({
        where: { id: product.coldRoomId },
        data: { usedCapacityKg: { decrement: product.quantityKg } },
      });

      await tx.auditLog.create({
        data: {
          action: AuditAction.DELETE,
          entityType: 'Product',
          entityId: id,
          userId: user.userId,
          details: { productName: product.name, quantityKg: product.quantityKg },
          timestamp: new Date(),
        },
      });
    });

    return { message: 'Product deleted successfully' };
  }

  async findAllPublic(): Promise<ProductEntity[]> {
    const products = await this.prisma.product.findMany({
      where: { deletedAt: null, status: ProductStatus.IN_STOCK },
      include: {
        site: { select: { name: true, location: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    return products.map((p) => new ProductEntity(p));
  }

  async findDiscovery(siteId?: string): Promise<ProductEntity[]> {
    const where: any = { deletedAt: null, status: ProductStatus.IN_STOCK };
    if (siteId) {
      where.siteId = siteId;
    }

    const products = await this.prisma.product.findMany({
      where,
      include: {
        site: { select: { name: true, location: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    return products.map((p) => new ProductEntity(p));
  }

  async findOneDiscovery(id: string): Promise<ProductEntity> {
    const product = await this.prisma.product.findFirst({
      where: { id, deletedAt: null },
      include: {
        supplier: { select: { firstName: true, lastName: true } },
        site: { select: { name: true, location: true } },
      },
    });

    if (!product) throw new NotFoundException(`Product with ID ${id} not found`);

    return new ProductEntity(product);
  }
}
