import { Test, TestingModule } from '@nestjs/testing';
import { OrdersService } from './orders.service';
import { PrismaService } from '../../database/prisma.service';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { OrderStatus, UserRole } from '@prisma/client';
import { StockMovementsService } from '../stock-movements/stock-movements.service';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { InvoicesService } from '../invoices/invoices.service';

/* eslint-disable @typescript-eslint/no-unsafe-assignment */

describe('OrdersService', () => {
  let service: OrdersService;

  const mockPrismaService = {
    product: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    order: {
      create: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
      count: jest.fn().mockResolvedValue(0),
    },
    orderItem: {
      deleteMany: jest.fn(),
      createMany: jest.fn(),
    },
    stockMovement: {
      create: jest.fn(),
    },
    coldRoom: {
      update: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  const mockStockMovementsService = {
    recordMovement: jest.fn(),
  };

  const mockAuditLogsService = {
    createAuditLog: jest.fn(),
  };

  const mockInvoicesService = {
    generateOrderInvoice: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrdersService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: StockMovementsService,
          useValue: mockStockMovementsService,
        },
        {
          provide: AuditLogsService,
          useValue: mockAuditLogsService,
        },
        {
          provide: InvoicesService,
          useValue: mockInvoicesService,
        },
      ],
    }).compile();

    service = module.get<OrdersService>(OrdersService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('createOrders', () => {
    const clientId = 'client-123';
    const siteId = 'site-123';
    const createOrderDto = {
      deliveryAddress: '123 Main St',
      notes: 'Deliver before 10 AM',
      items: [
        { productId: 'product-1', quantityKg: 10 },
        { productId: 'product-2', quantityKg: 5 },
      ],
    };

    const mockProducts = [
      {
        id: 'product-1',
        name: 'Milk',
        sellingPricePerUnit: 1000,
        quantityKg: 100,
        status: 'IN_STOCK',
      },
      {
        id: 'product-2',
        name: 'Cheese',
        sellingPricePerUnit: 5000,
        quantityKg: 50,
        status: 'IN_STOCK',
      },
    ];

    it('should create an order successfully', async () => {
      mockPrismaService.product.findMany.mockResolvedValue(mockProducts);
      mockPrismaService.order.create.mockResolvedValue({
        id: 'order-123',
        clientId,
        siteId,
        status: OrderStatus.REQUESTED,
        totalAmount: 35000,
      });

      const result = await service.createOrders(clientId, siteId, createOrderDto);

      expect(result).toBeDefined();
      expect(mockPrismaService.product.findMany).toHaveBeenCalledWith({
        where: {
          id: { in: ['product-1', 'product-2'] },
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
    });

    it('should throw error if products not found', async () => {
      mockPrismaService.product.findMany.mockResolvedValue([mockProducts[0]]);

      await expect(service.createOrders(clientId, siteId, createOrderDto)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw error if insufficient stock', async () => {
      const lowStockProducts = [{ ...mockProducts[0], quantityKg: 5 }, mockProducts[1]];
      mockPrismaService.product.findMany.mockResolvedValue(lowStockProducts);

      await expect(service.createOrders(clientId, siteId, createOrderDto)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw error if product not found during mapping', async () => {
      mockPrismaService.product.findMany.mockResolvedValue([
        {
          id: 'product-1',
          name: 'Milk',
          sellingPricePerUnit: 1000,
          quantityKg: 100,
          status: 'IN_STOCK',
        },
      ]);

      const dtoWithDuplicateButDifferentIds = {
        deliveryAddress: '123 Main St',
        notes: 'Test order',
        items: [
          { productId: 'product-1', quantityKg: 10 },
          { productId: 'product-1-typo', quantityKg: 5 },
        ],
      };

      await expect(
        service.createOrders(clientId, siteId, dtoWithDuplicateButDifferentIds),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('approveOrders', () => {
    const orderId = 'order-123';
    const approverId = 'manager-123';
    const siteId = 'site-123';

    const mockOrder = {
      id: orderId,
      siteId,
      status: OrderStatus.REQUESTED,
      items: [
        {
          productId: 'product-1',
          quantityKg: 10,
        },
      ],
    };

    it('should throw error if order not found', async () => {
      // eslint-disable-next-line @typescript-eslint/require-await
      mockPrismaService.$transaction.mockImplementation(async (callback) => {
        const tx = {
          ...mockPrismaService,
          order: {
            ...mockPrismaService.order,
            findFirst: jest.fn().mockResolvedValue(null),
          },
        };
        // eslint-disable-next-line @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-call
        return callback(tx);
      });

      await expect(service.approveOrders(orderId, approverId, siteId)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw error if order not in REQUESTED status', async () => {
      // eslint-disable-next-line @typescript-eslint/require-await
      mockPrismaService.$transaction.mockImplementation(async (callback) => {
        const tx = {
          ...mockPrismaService,
          order: {
            ...mockPrismaService.order,
            findFirst: jest.fn().mockResolvedValue({
              ...mockOrder,
              status: OrderStatus.APPROVED,
            }),
          },
        };
        // eslint-disable-next-line @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-call
        return callback(tx);
      });

      await expect(service.approveOrders(orderId, approverId, siteId)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('rejectOrders', () => {
    const orderId = 'order-123';
    const siteId = 'site-123';
    const userId = 'manager-123';
    const rejectDto = { rejectionReason: 'Insufficient stock' };

    it('should reject order successfully', async () => {
      const mockOrder = {
        id: orderId,
        status: OrderStatus.REQUESTED,
      };

      mockPrismaService.order.findFirst.mockResolvedValue(mockOrder);
      mockPrismaService.order.update.mockResolvedValue({
        ...mockOrder,
        status: OrderStatus.REJECTED,
        rejectionReason: rejectDto.rejectionReason,
      });

      const result = await service.rejectOrders(orderId, siteId, userId, rejectDto);

      expect(result.status).toBe(OrderStatus.REJECTED);
      expect(mockPrismaService.order.update).toHaveBeenCalled();
    });

    it('should throw error if order not found', async () => {
      mockPrismaService.order.findFirst.mockResolvedValue(null);

      await expect(service.rejectOrders(orderId, siteId, userId, rejectDto)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw error if order not in REQUESTED status', async () => {
      mockPrismaService.order.findFirst.mockResolvedValue({
        id: orderId,
        status: OrderStatus.APPROVED,
      });

      await expect(service.rejectOrders(orderId, siteId, userId, rejectDto)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('findAllOrders', () => {
    const siteId = 'site-123';

    it('should return all orders for site', async () => {
      const mockOrders = [
        { id: 'order-1', status: OrderStatus.REQUESTED },
        { id: 'order-2', status: OrderStatus.APPROVED },
      ];

      mockPrismaService.order.findMany.mockResolvedValue(mockOrders);

      const result = await service.findAllOrders(siteId, UserRole.SITE_MANAGER, 'manager-123');

      expect(result.data).toHaveLength(2);
      expect(mockPrismaService.order.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ siteId }),
        }),
      );
    });

    it('should filter by status', async () => {
      const mockOrders = [{ id: 'order-1', status: OrderStatus.REQUESTED }];

      mockPrismaService.order.findMany.mockResolvedValue(mockOrders);

      await service.findAllOrders(
        siteId,
        UserRole.SITE_MANAGER,
        'manager-123',
        OrderStatus.REQUESTED,
      );

      expect(mockPrismaService.order.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            siteId,
            status: OrderStatus.REQUESTED,
          }),
        }),
      );
    });
  });

  describe('findOne', () => {
    const orderId = 'order-123';
    const siteId = 'site-123';

    it('should return order by id', async () => {
      const mockOrder = { id: orderId, siteId };
      mockPrismaService.order.findFirst.mockResolvedValue(mockOrder);

      const result = await service.findOne(orderId, siteId, UserRole.SITE_MANAGER, 'manager-123');

      expect(result).toEqual(mockOrder);
    });

    it('should throw error if order not found', async () => {
      mockPrismaService.order.findFirst.mockResolvedValue(null);

      await expect(service.findOne(orderId, siteId, UserRole.CLIENT, 'client-123')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('updateStatus', () => {
    const orderId = 'order-123';
    const siteId = 'site-123';

    it('should update status with valid transition', async () => {
      const mockOrder = {
        id: orderId,
        status: OrderStatus.APPROVED,
      };

      mockPrismaService.order.findFirst.mockResolvedValue(mockOrder);
      mockPrismaService.order.update.mockResolvedValue({
        ...mockOrder,
        status: OrderStatus.INVOICED,
      });

      const result = await service.updateStatus(orderId, siteId, OrderStatus.INVOICED);

      expect(result.status).toBe(OrderStatus.INVOICED);
    });

    it('should throw error for invalid transition', async () => {
      const mockOrder = {
        id: orderId,
        status: OrderStatus.COMPLETED,
      };

      mockPrismaService.order.findFirst.mockResolvedValue(mockOrder);

      await expect(service.updateStatus(orderId, siteId, OrderStatus.REQUESTED)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should allow REQUESTED to APPROVED transition', async () => {
      const mockOrder = { id: orderId, status: OrderStatus.REQUESTED };
      mockPrismaService.order.findFirst.mockResolvedValue(mockOrder);
      mockPrismaService.order.update.mockResolvedValue({
        ...mockOrder,
        status: OrderStatus.APPROVED,
      });

      const result = await service.updateStatus(orderId, siteId, OrderStatus.APPROVED);
      expect(result.status).toBe(OrderStatus.APPROVED);
    });

    it('should allow REQUESTED to REJECTED transition', async () => {
      const mockOrder = { id: orderId, status: OrderStatus.REQUESTED };
      mockPrismaService.order.findFirst.mockResolvedValue(mockOrder);
      mockPrismaService.order.update.mockResolvedValue({
        ...mockOrder,
        status: OrderStatus.REJECTED,
      });

      const result = await service.updateStatus(orderId, siteId, OrderStatus.REJECTED);
      expect(result.status).toBe(OrderStatus.REJECTED);
    });

    it('should allow APPROVED to COMPLETED transition', async () => {
      const mockOrder = { id: orderId, status: OrderStatus.APPROVED };
      mockPrismaService.order.findFirst.mockResolvedValue(mockOrder);
      mockPrismaService.order.update.mockResolvedValue({
        ...mockOrder,
        status: OrderStatus.COMPLETED,
      });

      const result = await service.updateStatus(orderId, siteId, OrderStatus.COMPLETED);
      expect(result.status).toBe(OrderStatus.COMPLETED);
    });

    it('should allow INVOICED to COMPLETED transition', async () => {
      const mockOrder = { id: orderId, status: OrderStatus.INVOICED };
      mockPrismaService.order.findFirst.mockResolvedValue(mockOrder);
      mockPrismaService.order.update.mockResolvedValue({
        ...mockOrder,
        status: OrderStatus.COMPLETED,
      });

      const result = await service.updateStatus(orderId, siteId, OrderStatus.COMPLETED);
      expect(result.status).toBe(OrderStatus.COMPLETED);
    });

    it('should not allow transitions from COMPLETED', async () => {
      const mockOrder = { id: orderId, status: OrderStatus.COMPLETED };
      mockPrismaService.order.findFirst.mockResolvedValue(mockOrder);

      await expect(service.updateStatus(orderId, siteId, OrderStatus.REQUESTED)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should not allow transitions from REJECTED', async () => {
      const mockOrder = { id: orderId, status: OrderStatus.REJECTED };
      mockPrismaService.order.findFirst.mockResolvedValue(mockOrder);

      await expect(service.updateStatus(orderId, siteId, OrderStatus.APPROVED)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw error if order not found', async () => {
      mockPrismaService.order.findFirst.mockResolvedValue(null);

      await expect(service.updateStatus(orderId, siteId, OrderStatus.APPROVED)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('findByStatus', () => {
    const siteId = 'site-123';

    it('should call findAllOrders with status', async () => {
      const mockOrders = [{ id: 'order-1', status: OrderStatus.REQUESTED }];
      mockPrismaService.order.findMany.mockResolvedValue(mockOrders);

      const findAllSpy = jest.spyOn(service, 'findAllOrders');

      await service.findByStatus(
        siteId,
        UserRole.SITE_MANAGER,
        'manager-123',
        OrderStatus.REQUESTED,
        1,
        10,
      );

      expect(findAllSpy).toHaveBeenCalledWith(
        siteId,
        UserRole.SITE_MANAGER,
        'manager-123',
        OrderStatus.REQUESTED,
        1,
        10,
      );
    });
  });

  describe('findAllOrders - role-based filtering', () => {
    const siteId = 'site-123';
    const clientId = 'client-123';
    const managerId = 'manager-123';

    it('should filter orders for CLIENT role', async () => {
      const mockOrders = [{ id: 'order-1', clientId, status: OrderStatus.REQUESTED }];
      mockPrismaService.order.findMany.mockResolvedValue(mockOrders);

      await service.findAllOrders(siteId, UserRole.CLIENT, clientId);

      expect(mockPrismaService.order.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            clientId,
            siteId,
          }),
        }),
      );
    });

    it('should show all site orders for SITE_MANAGER role', async () => {
      const mockOrders = [
        { id: 'order-1', clientId: 'client-1' },
        { id: 'order-2', clientId: 'client-2' },
      ];
      mockPrismaService.order.findMany.mockResolvedValue(mockOrders);

      await service.findAllOrders(siteId, UserRole.SITE_MANAGER, managerId);

      expect(mockPrismaService.order.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            siteId,
          }),
        }),
      );
    });

    it('should show all orders for SUPER_ADMIN role', async () => {
      const mockOrders = [
        { id: 'order-1', siteId: 'site-1' },
        { id: 'order-2', siteId: 'site-2' },
      ];
      mockPrismaService.order.findMany.mockResolvedValue(mockOrders);

      await service.findAllOrders(siteId, UserRole.SUPER_ADMIN, 'admin-123');

      expect(mockPrismaService.order.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.not.objectContaining({
            siteId,
          }),
        }),
      );
    });
  });

  describe('findOne - role-based authorization', () => {
    const orderId = 'order-123';
    const siteId = 'site-123';
    const clientId = 'client-123';
    const otherClientId = 'other-client-123';

    it('should allow CLIENT to view their own order', async () => {
      const mockOrder = { id: orderId, clientId, siteId };
      mockPrismaService.order.findFirst.mockResolvedValue(mockOrder);

      const result = await service.findOne(orderId, siteId, UserRole.CLIENT, clientId);

      expect(result).toEqual(mockOrder);
      expect(mockPrismaService.order.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            id: orderId,
            clientId,
            siteId,
          }),
        }),
      );
    });

    it('should prevent CLIENT from viewing another client order', async () => {
      mockPrismaService.order.findFirst.mockResolvedValue(null);

      await expect(
        service.findOne(orderId, siteId, UserRole.CLIENT, otherClientId),
      ).rejects.toThrow(NotFoundException);
    });

    it('should allow SITE_MANAGER to view any order at their site', async () => {
      const mockOrder = { id: orderId, clientId, siteId };
      mockPrismaService.order.findFirst.mockResolvedValue(mockOrder);

      const result = await service.findOne(orderId, siteId, UserRole.SITE_MANAGER, 'manager-123');

      expect(result).toEqual(mockOrder);
      expect(mockPrismaService.order.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            id: orderId,
            siteId,
          }),
        }),
      );
    });

    it('should allow SUPER_ADMIN to view any order', async () => {
      const mockOrder = { id: orderId, clientId, siteId };
      mockPrismaService.order.findFirst.mockResolvedValue(mockOrder);

      const result = await service.findOne(orderId, siteId, UserRole.SUPER_ADMIN, 'admin-123');

      expect(result).toEqual(mockOrder);
      expect(mockPrismaService.order.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            id: orderId,
          }),
        }),
      );
    });
  });

  describe('approveOrders - StockMovementsService integration', () => {
    const orderId = 'order-123';
    const approverId = 'manager-123';
    const siteId = 'site-123';

    it('should execute full approval with stock reservation', async () => {
      const mockOrder = {
        id: orderId,
        siteId,
        status: OrderStatus.REQUESTED,
        totalAmount: 10000,
        items: [
          {
            productId: 'product-1',
            quantityKg: 10,
            product: {
              id: 'product-1',
              name: 'Milk',
              quantityKg: 100,
              coldRoomId: 'coldroom-1',
            },
          },
        ],
      };

      const updatedOrder = {
        ...mockOrder,
        status: OrderStatus.APPROVED,
        approvedBy: approverId,
        approvedAt: new Date(),
      };

      // eslint-disable-next-line @typescript-eslint/require-await
      mockPrismaService.$transaction.mockImplementation(async (callback) => {
        const tx = {
          ...mockPrismaService,
          order: {
            ...mockPrismaService.order,
            findFirst: jest.fn().mockResolvedValue(mockOrder),
            update: jest.fn().mockResolvedValue(updatedOrder),
          },
        };
        // eslint-disable-next-line @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-call
        return callback(tx);
      });

      mockStockMovementsService.recordMovement.mockResolvedValue({});
      mockInvoicesService.generateOrderInvoice.mockResolvedValue({});
      mockAuditLogsService.createAuditLog.mockResolvedValue({});

      const result = await service.approveOrders(orderId, approverId, siteId);

      expect(result.status).toBe(OrderStatus.APPROVED);
      expect(mockStockMovementsService.recordMovement).toHaveBeenCalledWith(
        expect.objectContaining({
          productId: 'product-1',
          quantityKg: 10,
          movementType: 'OUT',
        }),
        expect.any(Object),
      );
      expect(mockInvoicesService.generateOrderInvoice).toHaveBeenCalledWith(
        orderId,
        undefined,
        approverId,
        siteId,
      );
      expect(mockAuditLogsService.createAuditLog).toHaveBeenCalled();
    });

    it('should throw error if stock reservation fails', async () => {
      const mockOrder = {
        id: orderId,
        siteId,
        status: OrderStatus.REQUESTED,
        items: [
          {
            productId: 'product-1',
            quantityKg: 100,
            product: {
              id: 'product-1',
              coldRoomId: 'coldroom-1',
            },
          },
        ],
      };

      // eslint-disable-next-line @typescript-eslint/require-await
      mockPrismaService.$transaction.mockImplementation(async (callback) => {
        const tx = {
          ...mockPrismaService,
          order: {
            ...mockPrismaService.order,
            findFirst: jest.fn().mockResolvedValue(mockOrder),
          },
        };
        // eslint-disable-next-line @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-call
        return callback(tx);
      });

      mockStockMovementsService.recordMovement.mockRejectedValue(
        new BadRequestException('Insufficient stock balance'),
      );

      await expect(service.approveOrders(orderId, approverId, siteId)).rejects.toThrow(
        BadRequestException,
      );
    });
  });
});
