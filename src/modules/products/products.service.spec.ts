/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-return */
import { Test, TestingModule } from '@nestjs/testing';
import { ProductsService } from './products.service';
import { PrismaService } from '../../database/prisma.service';
import { ForbiddenException, BadRequestException } from '@nestjs/common';
import { UserRole, ProductStatus, StockMovementType } from '@prisma/client';
import { CreateProductDto } from './dto/create-product.dto';
import { AdjustStockDto } from './dto/adjust-stock.dto';

describe('ProductsService', () => {
  let service: ProductsService;
  let prisma: PrismaService;

  const mockManager = {
    userId: 'mgr-1',
    role: UserRole.SITE_MANAGER,
    siteId: 'site-a',
  };

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const mockAdmin = {
    userId: 'admin-1',
    role: UserRole.SUPER_ADMIN,
  };

  const createDto: CreateProductDto = {
    name: 'Fresh Tomatoes',
    category: 'Vegetables',
    quantityKg: 50,
    unit: 'KG',
    supplierId: 'supp-uuid-123',
    coldRoomId: 'room-uuid-456',
    siteId: 'site-a',
    sellingPricePerUnit: 1200.5,
    imageUrl: 'https://example.com/tomato.jpg',
    description: 'Locally sourced',
  };

  const mockProduct = {
    id: 'prod-uuid-999',
    ...createDto,
    status: ProductStatus.IN_STOCK,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
  };

  const mockColdRoom = {
    id: 'room-uuid-456',
    siteId: 'site-a',
    usedCapacityKg: 100,
    totalCapacityKg: 1000,
  };

  const mockPrismaService = {
    product: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    coldRoom: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    site: {
      findUnique: jest.fn(),
    },
    stockMovement: {
      create: jest.fn(),
    },
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call
    $transaction: jest.fn((callback) => callback(mockPrismaService)),
    $queryRaw: jest.fn().mockResolvedValue([mockProduct]),
  };

  const mockCloudinaryService = {
    uploadImage: jest.fn().mockResolvedValue({ secure_url: 'https://example.com/new-image.jpg' }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ProductsService, { provide: PrismaService, useValue: mockPrismaService }],
    }).compile();

    service = module.get<ProductsService>(ProductsService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('should allow manager to create product in their own site', async () => {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
      mockPrismaService.coldRoom.findUnique.mockResolvedValue(mockColdRoom);
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
      mockPrismaService.product.create.mockResolvedValue(mockProduct);

      // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
      await service.create(createDto, mockManager as any);

      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(prisma.product.create).toHaveBeenCalled();
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(prisma.coldRoom.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { usedCapacityKg: { increment: createDto.quantityKg } },
        }),
      );
    });

    it('should throw BadRequest if the cold room site does not match product site', async () => {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
      mockPrismaService.coldRoom.findUnique.mockResolvedValue({
        ...mockColdRoom,
        siteId: 'site-different',
      });

      // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
      await expect(service.create(createDto, mockManager as any)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('findOne', () => {
    it('should throw ForbiddenException if manager tries to access product from another site', async () => {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
      mockPrismaService.product.findFirst.mockResolvedValue({
        ...mockProduct,
        siteId: 'site-b',
      });

      // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
      await expect(service.findOne('prod-uuid-999', mockManager as any)).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  describe('update', () => {
    it('should block manager from changing the siteId of a product', async () => {
      jest.spyOn(service, 'findOne').mockResolvedValue(mockProduct as any);

      const updateDto = { siteId: 'site-b' };

      // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
      await expect(service.update('prod-uuid-999', updateDto, mockManager as any)).rejects.toThrow(
        'Only an admin can replace the product site',
      );
    });
  });
  describe('adjustStock', () => {
    it('should update product quantity and log movement', async () => {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
      jest.spyOn(service, 'findOne').mockResolvedValue(mockProduct as any);
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
      mockPrismaService.coldRoom.findUnique.mockResolvedValue(mockColdRoom);

      const adjustDto: AdjustStockDto = {
        quantityKg: 20,
        movementType: StockMovementType.IN,
        reason: 'Restock',
      };

      // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
      await service.adjustStock('prod-uuid-999', adjustDto, mockManager as any);

      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(prisma.product.update).toHaveBeenCalled();
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(prisma.stockMovement.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ quantityKg: 20 }),
        }),
      );
    });
  });

  describe('remove (Soft Delete)', () => {
    it('should return the success message and decrement capacity', async () => {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
      mockPrismaService.product.findUnique.mockResolvedValue(mockProduct);

      // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
      const result = await service.remove('prod-uuid-999', mockManager as any);

      expect(result.message).toBe('Product deleted successfully');
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(prisma.coldRoom.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { usedCapacityKg: { decrement: mockProduct.quantityKg } },
        }),
      );
    });

    it('should throw Unauthorized message if manager tries to delete from another site', async () => {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
      mockPrismaService.product.findUnique.mockResolvedValue({
        ...mockProduct,
        siteId: 'site-b',
      });

      // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
      await expect(service.remove('prod-uuid-999', mockManager as any)).rejects.toThrow(
        'Unauthorized access: You can only delete products belonging to your site',
      );
    });
  });
});
