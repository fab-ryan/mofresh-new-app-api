import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { OrderStatus, UserRole, Prisma, AuditAction, StockMovementType } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { CreateOrderDto, RejectOrderDto } from './dto';
import { paginate } from '../../common/utils/paginator';
import { StockMovementsService } from '../stock-movements/stock-movements.service';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { InvoicesService } from '../invoices/invoices.service';

@Injectable()
export class OrdersService {
  constructor(
    private readonly db: PrismaService,
    private readonly invoiceService: InvoicesService,
    private readonly stockMovementsService: StockMovementsService,
    private readonly auditLogsService: AuditLogsService,
  ) {}

  private getRoleBasedFilter(
    siteId: string,
    userRole: UserRole,
    userId: string,
  ): Prisma.OrderWhereInput {
    if (userRole === UserRole.SUPER_ADMIN) {
      return {};
    }

    if (userRole === UserRole.SITE_MANAGER) {
      return { siteId };
    }

    return {
      clientId: userId,
      siteId,
    };
  }

  async createOrders(clientId: string, siteId: string, createOrderDto: CreateOrderDto) {
    const { deliveryAddress, notes, items } = createOrderDto;
    const productIds = [...new Set(items.map((item) => item.productId))];

    const products = await this.db.product.findMany({
      where: {
        id: { in: productIds },
        siteId,
        deletedAt: null,
      },
      select: {
        id: true,
        name: true,
        sellingPricePerUnit: true,
        quantityKg: true,
        status: true,
      },
    });

    if (products.length !== productIds.length) {
      const foundProductIds = products.map((p) => p.id);
      const missingProductIds = productIds.filter((id) => !foundProductIds.includes(id));
      throw new BadRequestException(
        `The following products are not available at this site: ${missingProductIds.join(', ')}`,
      );
    }

    let totalAmount = 0;
    const orderItems = items.map((item) => {
      const product = products.find((p) => p.id === item.productId);

      if (!product) {
        throw new BadRequestException(`Product ${item.productId} not found`);
      }

      if (product.quantityKg < item.quantityKg) {
        throw new BadRequestException(
          `Insufficient stock for "${product.name}". Available: ${product.quantityKg}kg, Requested: ${item.quantityKg}kg`,
        );
      }

      const subtotal = product.sellingPricePerUnit * item.quantityKg;
      totalAmount += subtotal;

      return {
        productId: item.productId,
        quantityKg: item.quantityKg,
        unitPrice: product.sellingPricePerUnit,
        subtotal,
      };
    });

    const order = await this.db.order.create({
      data: {
        clientId,
        siteId,
        deliveryAddress,
        notes,
        totalAmount,
        status: OrderStatus.REQUESTED,
        items: {
          create: orderItems,
        },
      },
      include: {
        items: {
          include: {
            product: {
              select: {
                id: true,
                name: true,
                unit: true,
              },
            },
          },
        },
        client: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
    });

    // Audit log
    await this.auditLogsService.createAuditLog(clientId, AuditAction.CREATE, 'ORDER', order.id, {
      totalAmount: order.totalAmount,
      itemCount: items.length,
      siteId,
    });

    return order;
  }

  async approveOrders(orderId: string, approverId: string, siteId: string) {
    return await this.db.$transaction(async (tx) => {
      const order = await tx.order.findFirst({
        where: {
          id: orderId,
          siteId,
          deletedAt: null,
        },
        include: {
          items: {
            include: {
              product: true,
            },
          },
        },
      });

      if (!order) {
        throw new NotFoundException('Order not found');
      }

      if (order.status !== OrderStatus.REQUESTED) {
        throw new BadRequestException(
          `Cannot approve order with status: ${order.status}. Only REQUESTED orders can be approved`,
        );
      }

      if (!order.items || order.items.length === 0) {
        throw new BadRequestException('Order has no items');
      }

      // Reserve stock for each item
      for (const item of order.items) {
        await this.stockMovementsService.recordMovement(
          {
            productId: item.productId,
            coldRoomId: item.product.coldRoomId,
            quantityKg: item.quantityKg,
            movementType: StockMovementType.OUT,
            reason: `Order ${orderId} approved - stock reserved`,
          },
          // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
          {
            userId: approverId,
            role: UserRole.SITE_MANAGER,
            siteId,
          } as any,
        );
      }

      // Update order status to APPROVED
      const updatedOrder = await tx.order.update({
        where: { id: orderId },
        data: {
          status: OrderStatus.APPROVED,
          approvedBy: approverId,
          approvedAt: new Date(),
        },
        include: {
          items: {
            include: {
              product: true,
            },
          },
          client: true,
        },
      });

      // Generate invoice
      await this.invoiceService.generateOrderInvoice(orderId, undefined, approverId, siteId);

      // Audit log
      await this.auditLogsService.createAuditLog(approverId, AuditAction.UPDATE, 'ORDER', orderId, {
        action: 'APPROVE',
        previousStatus: 'REQUESTED',
        newStatus: 'APPROVED',
        totalAmount: order.totalAmount,
      });

      return updatedOrder;
    });
  }

  async rejectOrders(
    orderId: string,
    siteId: string,
    userId: string,
    rejectOrderDto: RejectOrderDto,
  ) {
    const order = await this.db.order.findFirst({
      where: {
        id: orderId,
        siteId,
        deletedAt: null,
      },
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    if (order.status !== OrderStatus.REQUESTED) {
      throw new BadRequestException(
        `Cannot reject order with status: ${order.status}. Only REQUESTED orders can be rejected`,
      );
    }

    const rejectedOrder = await this.db.order.update({
      where: { id: orderId },
      data: {
        status: OrderStatus.REJECTED,
        rejectedAt: new Date(),
        rejectionReason: rejectOrderDto.rejectionReason,
      },
      include: {
        items: {
          include: {
            product: true,
          },
        },
        client: true,
      },
    });

    // Audit log
    await this.auditLogsService.createAuditLog(userId, AuditAction.UPDATE, 'ORDER', orderId, {
      action: 'REJECT',
      previousStatus: 'REQUESTED',
      newStatus: 'REJECTED',
      reason: rejectOrderDto.rejectionReason,
    });

    return rejectedOrder;
  }

  async deleteOrder(orderId: string, userId: string, siteId: string, userRole: UserRole) {
    const order = await this.db.order.findUnique({
      where: { id: orderId, deletedAt: null },
    });

    if (!order) {
      throw new NotFoundException(`Order with ID ${orderId} not found`);
    }

    // Authorization: Only order owner can delete, or site manager/super admin
    if (userRole === UserRole.CLIENT && order.clientId !== userId) {
      throw new BadRequestException('You can only delete your own orders');
    }

    // Site managers can only delete orders from their site
    if (userRole === UserRole.SITE_MANAGER && order.siteId !== siteId) {
      throw new BadRequestException('You can only delete orders from your site');
    }

    // Can only delete orders that are in REQUESTED status
    if (order.status !== OrderStatus.REQUESTED) {
      throw new BadRequestException(
        `Cannot delete order with status ${order.status}. Only REQUESTED orders can be deleted.`,
      );
    }

    // Soft delete the order
    const deletedOrder = await this.db.order.update({
      where: { id: orderId },
      data: { deletedAt: new Date() },
    });

    // Audit log
    await this.auditLogsService.createAuditLog(userId, AuditAction.DELETE, 'ORDER', orderId, {
      action: 'DELETE',
      previousStatus: order.status,
      deletedBy: userRole,
    });

    return deletedOrder;
  }

  async findAllOrders(
    siteId: string,
    userRole: UserRole,
    userId: string,
    status?: OrderStatus,
    page?: number,
    limit?: number,
  ) {
    const whereClause: Prisma.OrderWhereInput = {
      deletedAt: null,
      ...this.getRoleBasedFilter(siteId, userRole, userId),
    };

    if (status) {
      whereClause.status = status;
    }

    return await paginate(this.db.order, {
      where: whereClause,
      orderBy: { createdAt: 'desc' },
      page,
      limit,
      include: {
        items: {
          include: {
            product: {
              select: {
                id: true,
                name: true,
                unit: true,
              },
            },
          },
        },
        client: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        approver: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });
  }

  async findOne(orderId: string, siteId: string, userRole: UserRole, userId: string) {
    const whereClause: Prisma.OrderWhereInput = {
      id: orderId,
      deletedAt: null,
      ...this.getRoleBasedFilter(siteId, userRole, userId),
    };

    const order = await this.db.order.findFirst({
      where: whereClause,
      include: {
        items: {
          include: {
            product: {
              select: {
                id: true,
                name: true,
                unit: true,
                sellingPricePerUnit: true,
              },
            },
          },
        },
        client: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            phone: true,
          },
        },
        approver: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
        invoice: true,
      },
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    return order;
  }

  async updateStatus(orderId: string, siteId: string, newStatus: OrderStatus) {
    const order = await this.db.order.findFirst({
      where: {
        id: orderId,
        siteId,
        deletedAt: null,
      },
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    const validTransitions: Record<OrderStatus, OrderStatus[]> = {
      REQUESTED: [OrderStatus.APPROVED, OrderStatus.REJECTED],
      APPROVED: [OrderStatus.INVOICED, OrderStatus.COMPLETED],
      INVOICED: [OrderStatus.COMPLETED],
      COMPLETED: [],
      REJECTED: [],
    };

    const allowedStatuses = validTransitions[order.status];
    if (!allowedStatuses.includes(newStatus)) {
      throw new BadRequestException(
        `Cannot transition from ${order.status} to ${newStatus}. Allowed transitions: ${allowedStatuses.join(', ') || 'none'}`,
      );
    }

    return await this.db.order.update({
      where: { id: orderId },
      data: { status: newStatus },
      include: {
        items: {
          include: {
            product: true,
          },
        },
        client: true,
        approver: true,
      },
    });
  }

  async findByStatus(
    siteId: string,
    userRole: UserRole,
    userId: string,
    status: OrderStatus,
    page?: number,
    limit?: number,
  ) {
    return await this.findAllOrders(siteId, userRole, userId, status, page, limit);
  }
}
