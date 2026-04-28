/* eslint-disable @typescript-eslint/no-unsafe-call */
import { Test, TestingModule } from '@nestjs/testing';
import { StockMovementsService } from './stock-movements.service';
import { PrismaService } from '../../database/prisma.service';
import { UserRole, StockMovementType } from '@prisma/client';
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { ForbiddenException, NotFoundException, BadRequestException } from '@nestjs/common';

describe('StockMovementsService', () => {
  let service: StockMovementsService;
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  let prisma: PrismaService;

  const mockAdmin = { userId: 'admin-1', email: 'admin@test.com', role: UserRole.SUPER_ADMIN };
  const mockManager = {
    userId: 'mgr-1',
    email: 'manager@test.com',
    role: UserRole.SITE_MANAGER,
    siteId: 'site-alpha',
  };

  const mockProduct = {
    id: 'prod-1',
    name: 'Milk',
    siteId: 'site-alpha',
    quantityKg: 100,
  };

  const mockColdRoom = {
    id: 'room-1',
    siteId: 'site-alpha',
  };

  const mockPrismaService = {
    product: { findUnique: jest.fn(), update: jest.fn() },
    coldRoom: { findUnique: jest.fn() },
    stockMovement: {
      findUnique: jest.fn(),
      create: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
    },
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    $transaction: jest.fn((callback) => callback(mockPrismaService)),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      providers: [StockMovementsService, { provide: PrismaService, useValue: mockPrismaService }],
    }).compile();

    service = module.get<StockMovementsService>(StockMovementsService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  afterEach(() => jest.clearAllMocks());

  describe('recordMovement', () => {
    const dto = {
      productId: 'prod-1',
      coldRoomId: 'room-1',
      quantityKg: 10,
      movementType: StockMovementType.IN,
      reason: 'Fresh Delivery',
    };

    it('should allow manager to record movement in their OWN site', async () => {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      mockPrismaService.product.findUnique.mockResolvedValue(mockProduct);
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      mockPrismaService.coldRoom.findUnique.mockResolvedValue(mockColdRoom);

      await service.recordMovement(dto, mockManager);

      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      expect(mockPrismaService.stockMovement.create).toHaveBeenCalled();
    });

    it('should BLOCK manager from recording movement in ANOTHER site', async () => {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      mockPrismaService.product.findUnique.mockResolvedValue({
        ...mockProduct,
        siteId: 'site-beta',
      });
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      mockPrismaService.coldRoom.findUnique.mockResolvedValue(mockColdRoom);

      await expect(service.recordMovement(dto, mockManager)).rejects.toThrow(ForbiddenException);
    });

    it('should allow Admin to record movement anywhere', async () => {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      mockPrismaService.product.findUnique.mockResolvedValue({
        ...mockProduct,
        siteId: 'any-site',
      });
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      mockPrismaService.coldRoom.findUnique.mockResolvedValue({
        ...mockColdRoom,
        siteId: 'any-site',
      });

      await service.recordMovement(dto, mockAdmin);
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      expect(mockPrismaService.stockMovement.create).toHaveBeenCalled();
    });

    it('should throw BadRequest if stock goes negative during OUT movement', async () => {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      mockPrismaService.product.findUnique.mockResolvedValue({ ...mockProduct, quantityKg: 5 });
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      mockPrismaService.coldRoom.findUnique.mockResolvedValue(mockColdRoom);

      const outDto = { ...dto, movementType: StockMovementType.OUT, quantityKg: 10 };

      await expect(service.recordMovement(outDto, mockAdmin)).rejects.toThrow(BadRequestException);
    });
  });

  describe('revertMovement', () => {
    const mockMovement = {
      id: 'move-123',
      productId: 'prod-1',
      quantityKg: 20,
      movementType: StockMovementType.IN,
      product: mockProduct,
    };

    it('should allow manager to revert a movement from their own site', async () => {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      mockPrismaService.stockMovement.findUnique.mockResolvedValue(mockMovement);

      await service.revertMovement('move-123', mockManager);

      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      expect(mockPrismaService.product.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { quantityKg: { increment: -20 } },
        }),
      );
    });

    it('should BLOCK manager from reverting a movement from another site', async () => {
      const foreignMovement = {
        ...mockMovement,
        product: { ...mockProduct, siteId: 'other-site' },
      };
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      mockPrismaService.stockMovement.findUnique.mockResolvedValue(foreignMovement);

      await expect(service.revertMovement('move-123', mockManager)).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  describe('findAll', () => {
    it('should filter by siteId automatically for Site Managers', async () => {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      mockPrismaService.stockMovement.findMany.mockResolvedValue([]);
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      mockPrismaService.stockMovement.count.mockResolvedValue(0);

      await service.findAll({}, mockManager);

      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      expect(mockPrismaService.stockMovement.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
          where: expect.objectContaining({
            product: { siteId: 'site-alpha' },
          }),
        }),
      );
    });

    it('should NOT filter by siteId for Super Admins', async () => {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      mockPrismaService.stockMovement.findMany.mockResolvedValue([]);
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      mockPrismaService.stockMovement.count.mockResolvedValue(0);

      await service.findAll({}, mockAdmin);

      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
      const callArgs = mockPrismaService.stockMovement.findMany.mock.calls[0][0];
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      expect(callArgs.where.product).toBeUndefined();
    });
  });
});
