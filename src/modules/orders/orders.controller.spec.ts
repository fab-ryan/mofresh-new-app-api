import { Test, TestingModule } from '@nestjs/testing';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';
import { OrderStatus, UserRole } from '@prisma/client';
import { CurrentUserPayload } from '../../common/decorators/current-user.decorator';

/* eslint-disable @typescript-eslint/unbound-method */

describe('OrdersController', () => {
  let controller: OrdersController;
  let service: OrdersService;

  const mockOrdersService = {
    createOrders: jest.fn(),
    findAllOrders: jest.fn(),
    findOne: jest.fn(),
    approveOrders: jest.fn(),
    rejectOrders: jest.fn(),
    updateStatus: jest.fn(),
    findByStatus: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [OrdersController],
      providers: [
        {
          provide: OrdersService,
          useValue: mockOrdersService,
        },
      ],
    }).compile();

    controller = module.get<OrdersController>(OrdersController);
    service = module.get<OrdersService>(OrdersService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('should create an order', async () => {
      const createOrderDto = {
        deliveryAddress: '123 Main St',
        notes: 'Test order',
        items: [{ productId: 'product-1', quantityKg: 10 }],
      };

      const mockUser: CurrentUserPayload = {
        userId: 'client-123',
        email: 'client@example.com',
        role: UserRole.CLIENT,
        siteId: 'site-123',
      };

      const mockOrder = {
        id: 'order-123',
        ...createOrderDto,
        status: OrderStatus.REQUESTED,
      };

      mockOrdersService.createOrders.mockResolvedValue(mockOrder);

      const result = await controller.create(mockUser, createOrderDto);

      expect(result).toEqual(mockOrder);
      expect(service.createOrders).toHaveBeenCalledWith('client-123', 'site-123', createOrderDto);
    });
  });

  describe('findAll', () => {
    it('should return all orders for site manager', async () => {
      const mockUser: CurrentUserPayload = {
        userId: 'manager-123',
        email: 'manager@example.com',
        role: UserRole.SITE_MANAGER,
        siteId: 'site-123',
      };

      const mockOrders = [
        { id: 'order-1', status: OrderStatus.REQUESTED },
        { id: 'order-2', status: OrderStatus.APPROVED },
      ];

      mockOrdersService.findAllOrders.mockResolvedValue(mockOrders);

      const result = await controller.findAll(mockUser, undefined, 1, 10);

      expect(result).toEqual(mockOrders);
      expect(service.findAllOrders).toHaveBeenCalledWith(
        'site-123',
        UserRole.SITE_MANAGER,
        'manager-123',
        undefined,
        1,
        10,
      );
    });

    it('should filter by client for CLIENT role', async () => {
      const mockUser: CurrentUserPayload = {
        userId: 'client-123',
        email: 'client@example.com',
        role: UserRole.CLIENT,
        siteId: 'site-123',
      };

      mockOrdersService.findAllOrders.mockResolvedValue([]);

      await controller.findAll(mockUser, undefined, 1, 10);

      expect(service.findAllOrders).toHaveBeenCalledWith(
        'site-123',
        UserRole.CLIENT,
        'client-123',
        undefined,
        1,
        10,
      );
    });

    it('should pass status parameter when provided', async () => {
      const mockUser: CurrentUserPayload = {
        userId: 'manager-123',
        email: 'manager@example.com',
        role: UserRole.SITE_MANAGER,
        siteId: 'site-123',
      };

      const mockOrders = [{ id: 'order-1', status: OrderStatus.APPROVED }];

      mockOrdersService.findAllOrders.mockResolvedValue(mockOrders);

      const result = await controller.findAll(mockUser, OrderStatus.APPROVED);

      expect(result).toEqual(mockOrders);
      expect(service.findAllOrders).toHaveBeenCalledWith(
        'site-123',
        UserRole.SITE_MANAGER,
        'manager-123',
        OrderStatus.APPROVED,
        undefined,
        undefined,
      );
    });
  });

  describe('findOne', () => {
    it('should return order by id', async () => {
      const mockUser: CurrentUserPayload = {
        userId: 'manager-123',
        email: 'manager@example.com',
        role: UserRole.SITE_MANAGER,
        siteId: 'site-123',
      };

      const mockOrder = { id: 'order-123', status: OrderStatus.REQUESTED };

      mockOrdersService.findOne.mockResolvedValue(mockOrder);

      const result = await controller.findOne('order-123', mockUser);

      expect(result).toEqual(mockOrder);
      expect(service.findOne).toHaveBeenCalledWith(
        'order-123',
        'site-123',
        UserRole.SITE_MANAGER,
        'manager-123',
      );
    });
  });

  describe('approve', () => {
    it('should approve an order', async () => {
      const mockUser: CurrentUserPayload = {
        userId: 'manager-123',
        email: 'manager@example.com',
        role: UserRole.SITE_MANAGER,
        siteId: 'site-123',
      };

      const mockOrder = {
        id: 'order-123',
        status: OrderStatus.APPROVED,
      };

      mockOrdersService.approveOrders.mockResolvedValue(mockOrder);

      const result = await controller.approve('order-123', mockUser);

      expect(result).toEqual(mockOrder);
      expect(service.approveOrders).toHaveBeenCalledWith('order-123', 'manager-123', 'site-123');
    });
  });

  describe('reject', () => {
    it('should reject an order', async () => {
      const mockUser: CurrentUserPayload = {
        userId: 'manager-123',
        email: 'manager@example.com',
        role: UserRole.SITE_MANAGER,
        siteId: 'site-123',
      };

      const rejectDto = { rejectionReason: 'Insufficient stock' };

      const mockOrder = {
        id: 'order-123',
        status: OrderStatus.REJECTED,
        rejectionReason: rejectDto.rejectionReason,
      };

      mockOrdersService.rejectOrders.mockResolvedValue(mockOrder);

      const result = await controller.reject('order-123', mockUser, rejectDto);

      expect(result).toEqual(mockOrder);
      expect(service.rejectOrders).toHaveBeenCalledWith(
        'order-123',
        'site-123',
        'manager-123',
        rejectDto,
      );
    });
  });

  describe('findByStatus', () => {
    it('should return orders by status', async () => {
      const mockUser: CurrentUserPayload = {
        userId: 'manager-123',
        email: 'manager@example.com',
        role: UserRole.SITE_MANAGER,
        siteId: 'site-123',
      };

      const mockOrders = [{ id: 'order-1', status: OrderStatus.REQUESTED }];

      mockOrdersService.findByStatus.mockResolvedValue(mockOrders);

      const result = await controller.findByStatus(OrderStatus.REQUESTED, mockUser, 1, 10);

      expect(result).toEqual(mockOrders);
      expect(service.findByStatus).toHaveBeenCalledWith(
        'site-123',
        UserRole.SITE_MANAGER,
        'manager-123',
        OrderStatus.REQUESTED,
        1,
        10,
      );
    });
  });
});
