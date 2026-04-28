/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-nocheck
import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { RentalsService } from './rentals.service';
import { PrismaService } from '../../database/prisma.service';
import { InvoicesService } from '../invoices/invoices.service';
import { AssetStatus, AssetType, RentalStatus, InvoiceStatus } from '@prisma/client';
import { CreateRentalDto } from './dto';
import { jest, describe, beforeEach } from '@jest/globals';

describe('RentalsService', () => {
  let service: RentalsService;

  const mockTransaction = jest.fn();
  const mockPrismaService = {
    $transaction: mockTransaction,
    rental: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    coldBox: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      updateMany: jest.fn(),
      update: jest.fn(),
    },
    coldPlate: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      updateMany: jest.fn(),
      update: jest.fn(),
    },
    tricycle: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      updateMany: jest.fn(),
      update: jest.fn(),
    },
    coldRoom: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      updateMany: jest.fn(),
      update: jest.fn(),
    },
    invoice: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
    },
    auditLog: {
      create: jest.fn(),
    },
  };

  const mockInvoicesService = {
    generateRentalInvoice: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RentalsService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: InvoicesService,
          useValue: mockInvoicesService,
        },
      ],
    }).compile();

    service = module.get<RentalsService>(RentalsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('createRental', () => {
    const mockDto = {
      assetType: AssetType.COLD_BOX,
      coldBoxId: 'box-1',
      rentalStartDate: '2026-02-15T10:00:00Z',
      rentalEndDate: '2026-02-20T10:00:00Z',
      estimatedFee: 50000,
    };

    const mockColdBox = {
      id: 'box-1',
      status: AssetStatus.AVAILABLE,
      siteId: 'site-1',
    };

    const mockRental = {
      id: 'rental-1',
      clientId: 'client-1',
      siteId: 'site-1',
      assetType: AssetType.COLD_BOX,
      coldBoxId: 'box-1',
      coldPlateId: null,
      tricycleId: null,
      coldRoomId: null,
      status: RentalStatus.REQUESTED,
      rentalStartDate: new Date('2026-02-15'),
      rentalEndDate: new Date('2026-02-20'),
      estimatedFee: 50000,
      createdAt: new Date(),
      client: {
        id: 'client-1',
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@example.com',
      },
      coldBox: mockColdBox,
      coldPlate: null,
      tricycle: null,
      coldRoom: null,
    };

    it('should create rental with specific asset ID', async () => {
      mockPrismaService.coldBox.findFirst.mockResolvedValue(mockColdBox);
      mockPrismaService.rental.create.mockResolvedValue(mockRental);

      const result = await service.createRental('client-1', 'site-1', mockDto as CreateRentalDto);

      expect(result).toBeDefined();
      expect(result.id).toBe('rental-1');
      expect(result.status).toBe(RentalStatus.REQUESTED);
      expect(mockPrismaService.coldBox.findFirst).toHaveBeenCalledWith({
        where: { id: 'box-1', siteId: 'site-1', deletedAt: null },
        select: { status: true },
      });
    });

    it('should throw BadRequestException when no ID provided (auto-selection disabled)', async () => {
      const autoSelectDto = {
        assetType: AssetType.COLD_BOX,
        rentalStartDate: '2026-02-15T10:00:00Z',
        rentalEndDate: '2026-02-20T10:00:00Z',
        estimatedFee: 50000,
      };

      await expect(
        service.createRental('client-1', 'site-1', autoSelectDto as CreateRentalDto),
      ).rejects.toThrow(BadRequestException);
    });

    it('should create rental with cold room', async () => {
      const coldRoomDto = {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        assetType: AssetType.COLD_ROOM,
        coldRoomId: 'room-1',
        rentalStartDate: '2026-02-15T10:00:00Z',
        rentalEndDate: '2026-02-20T10:00:00Z',
        estimatedFee: 100000,
        capacityNeededKg: 50, // Required for COLD_ROOM
      };

      mockPrismaService.coldRoom.findFirst.mockResolvedValue({
        id: 'room-1',
        status: AssetStatus.AVAILABLE,
      });
      mockPrismaService.coldRoom.findUnique.mockResolvedValue({
        id: 'room-1',
        totalCapacityKg: 1000,
        usedCapacityKg: 100,
      });
      mockPrismaService.rental.create.mockResolvedValue({
        ...mockRental,
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        assetType: AssetType.COLD_ROOM,
        coldRoomId: 'room-1',
        coldBoxId: null,
        capacityNeededKg: 50,
      });

      const result = await service.createRental(
        'client-1',
        'site-1',
        coldRoomDto as CreateRentalDto,
      );

      expect(result).toBeDefined();
      expect(mockPrismaService.coldRoom.findUnique).toHaveBeenCalled();
    });

    it('should throw BadRequestException if asset not available', async () => {
      mockPrismaService.coldBox.findFirst.mockResolvedValue(null);

      await expect(
        service.createRental('client-1', 'site-1', mockDto as CreateRentalDto),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException for invalid date range', async () => {
      const invalidDto = {
        ...mockDto,
        rentalStartDate: '2026-02-20T10:00:00Z',
        rentalEndDate: '2026-02-15T10:00:00Z',
      };

      await expect(
        service.createRental('client-1', 'site-1', invalidDto as CreateRentalDto),
      ).rejects.toThrow('rentalEndDate must be after rentalStartDate');
    });

    it('should throw BadRequestException if multiple asset IDs provided', async () => {
      const multipleAssetsDto = {
        ...mockDto,
        coldPlateId: 'plate-1',
      };

      await expect(
        service.createRental('client-1', 'site-1', multipleAssetsDto as CreateRentalDto),
      ).rejects.toThrow('Provide exactly one asset id');
    });
  });

  describe('getAvailableAssetsByType', () => {
    it('should return available cold boxes', async () => {
      const mockBoxes = [
        { id: 'box-1', identificationNumber: 'CB-001', status: AssetStatus.AVAILABLE },
        { id: 'box-2', identificationNumber: 'CB-002', status: AssetStatus.AVAILABLE },
      ];

      mockPrismaService.coldBox.findMany.mockResolvedValue(mockBoxes);

      const result = await service.getAvailableAssetsByType(AssetType.COLD_BOX, 'site-1');

      expect(result.assetType).toBe(AssetType.COLD_BOX);
      expect(result.count).toBe(2);
      expect(result.assets).toEqual(mockBoxes);
      expect(mockPrismaService.coldBox.findMany).toHaveBeenCalledWith({
        where: {
          siteId: 'site-1',
          status: AssetStatus.AVAILABLE,
          deletedAt: null,
        },
        orderBy: {
          createdAt: 'desc',
        },
      });
    });

    it('should return available cold rooms', async () => {
      const mockRooms = [{ id: 'room-1', name: 'Room 1', status: AssetStatus.AVAILABLE }];

      mockPrismaService.coldRoom.findMany.mockResolvedValue(mockRooms);

      // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
      const result = await service.getAvailableAssetsByType(AssetType.COLD_ROOM, 'site-1');

      expect(result.assetType).toBe(AssetType.COLD_ROOM);
      expect(result.count).toBe(1);
      expect(result.assets).toEqual(mockRooms);
    });

    it('should return empty array when no assets available', async () => {
      mockPrismaService.tricycle.findMany.mockResolvedValue([]);

      const result = await service.getAvailableAssetsByType(AssetType.TRICYCLE, 'site-1');

      expect(result.count).toBe(0);
      expect(result.assets).toEqual([]);
    });
  });

  describe('approveRental', () => {
    const mockRental = {
      id: 'rental-1',
      status: RentalStatus.REQUESTED,
      assetType: AssetType.COLD_BOX,
      coldBoxId: 'box-1',
      coldPlateId: null,
      tricycleId: null,
      coldRoomId: null,
    };

    it('should approve rental and generate invoice', async () => {
      const mockTx = {
        rental: {
          findFirst: jest.fn().mockResolvedValue({
            ...mockRental,
            rentalStartDate: new Date(),
            rentalEndDate: new Date(Date.now() + 86400000),
          }),
          updateMany: jest.fn().mockResolvedValue({ count: 1 }),
          findUnique: jest.fn().mockResolvedValue({
            ...mockRental,
            status: RentalStatus.APPROVED,
            invoice: { id: 'invoice-1' },
          }),
          findMany: jest.fn().mockResolvedValue([]), // For date overlap check
        },
        $queryRawUnsafe: jest
          .fn()
          .mockResolvedValue([{ id: 'box-1', status: AssetStatus.AVAILABLE }]),
        auditLog: {
          create: jest.fn(),
        },
      };

      // eslint-disable-next-line @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-call
      mockTransaction.mockImplementation(async (callback) => await callback(mockTx));
      mockInvoicesService.generateRentalInvoice.mockResolvedValue({
        id: 'invoice-1',
        invoiceNumber: 'INV-001',
      });

      const result = await service.approveRental('rental-1', 'site-1', 'manager-1');

      expect(result).toBeDefined();
      expect(result.invoice).toBeDefined();
      expect(mockTx.rental.updateMany).toHaveBeenCalled();
      expect(mockInvoicesService.generateRentalInvoice).toHaveBeenCalled();
    });

    it('should throw error if rental not found', async () => {
      const mockTx = {
        rental: {
          findFirst: jest.fn().mockResolvedValue(null),
        },
      };

      // eslint-disable-next-line @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-call
      mockTransaction.mockImplementation(async (callback) => await callback(mockTx));

      await expect(service.approveRental('rental-1', 'site-1', 'manager-1')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw error if rental already approved', async () => {
      const mockTx = {
        rental: {
          findFirst: jest.fn().mockResolvedValue({
            ...mockRental,
            status: RentalStatus.APPROVED,
          }),
        },
      };

      // eslint-disable-next-line @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-call
      mockTransaction.mockImplementation(async (callback) => await callback(mockTx));

      await expect(service.approveRental('rental-1', 'site-1', 'manager-1')).rejects.toThrow(
        'Rental must be REQUESTED',
      );
    });
  });

  describe('activateRental', () => {
    const mockRental = {
      id: 'rental-1',
      status: RentalStatus.APPROVED,
      assetType: AssetType.COLD_BOX,
      coldBoxId: 'box-1',
      coldPlateId: null,
      tricycleId: null,
      coldRoomId: null,
    };

    it('should activate rental when invoice is paid', async () => {
      const mockTx = {
        rental: {
          findFirst: jest.fn().mockResolvedValue({
            ...mockRental,
            rentalStartDate: new Date(),
            rentalEndDate: new Date(Date.now() + 86400000),
          }),
          updateMany: jest.fn().mockResolvedValue({ count: 1 }),
          findUnique: jest.fn().mockResolvedValue({
            ...mockRental,
            status: RentalStatus.ACTIVE,
          }),
        },
        invoice: {
          findUnique: jest.fn().mockResolvedValue({
            id: 'invoice-1',
            status: InvoiceStatus.PAID,
          }),
        },
        coldBox: {
          update: jest.fn(),
        },
        auditLog: {
          create: jest.fn(),
        },
        $queryRawUnsafe: jest
          .fn()
          .mockResolvedValue([{ id: 'box-1', status: AssetStatus.AVAILABLE }]),
      };

      // eslint-disable-next-line @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-call
      mockTransaction.mockImplementation(async (callback) => await callback(mockTx));

      const result = await service.activateRental('rental-1', 'site-1', 'manager-1');

      expect(result).toBeDefined();
      expect(mockTx.rental.updateMany).toHaveBeenCalled();
      expect(mockTx.coldBox.update).toHaveBeenCalledWith({
        where: { id: 'box-1' },
        data: { status: AssetStatus.RENTED },
      });
    });

    it('should throw error if invoice not paid', async () => {
      const mockTx = {
        rental: {
          findFirst: jest.fn().mockResolvedValue(mockRental),
        },
        invoice: {
          findUnique: jest.fn().mockResolvedValue({
            id: 'invoice-1',
            status: InvoiceStatus.UNPAID,
          }),
        },
      };

      // eslint-disable-next-line @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-call
      mockTransaction.mockImplementation(async (callback) => await callback(mockTx));

      await expect(service.activateRental('rental-1', 'site-1', 'manager-1')).rejects.toThrow(
        'invoice is not PAID',
      );
    });
  });

  describe('complete', () => {
    const mockRental = {
      id: 'rental-1',
      status: RentalStatus.ACTIVE,
      assetType: AssetType.COLD_BOX,
      coldBoxId: 'box-1',
      coldPlateId: null,
      tricycleId: null,
      coldRoomId: null,
    };

    it('should complete rental and mark asset as available', async () => {
      const mockTx = {
        rental: {
          findFirst: jest.fn().mockResolvedValue(mockRental),
          update: jest.fn().mockResolvedValue({
            ...mockRental,
            status: RentalStatus.COMPLETED,
          }),
        },
        coldBox: {
          update: jest.fn(),
        },
        auditLog: {
          create: jest.fn(),
        },
      };

      // eslint-disable-next-line @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-call
      mockTransaction.mockImplementation(async (callback) => await callback(mockTx));

      const result = await service.complete('rental-1', 'site-1', 'manager-1');

      expect(result).toBeDefined();
      expect(mockTx.coldBox.update).toHaveBeenCalledWith({
        where: { id: 'box-1' },
        data: { status: AssetStatus.AVAILABLE },
      });
    });

    it('should throw error if rental not active', async () => {
      const mockTx = {
        rental: {
          findFirst: jest.fn().mockResolvedValue({
            ...mockRental,
            status: RentalStatus.REQUESTED,
          }),
        },
      };

      // eslint-disable-next-line @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-call
      mockTransaction.mockImplementation(async (callback) => await callback(mockTx));

      await expect(service.complete('rental-1', 'site-1', 'manager-1')).rejects.toThrow(
        'Cannot complete rental with status',
      );
    });
  });
  describe('autoActivateRentals', () => {
    it('should find paid rentals and activate them', async () => {
      const mockPaidRentals = [
        { id: 'rental-1', siteId: 'site-1', clientId: 'client-1' },
        { id: 'rental-2', siteId: 'site-1', clientId: 'client-2' },
      ];

      mockPrismaService.rental.findMany.mockResolvedValue(mockPaidRentals);

      // Spy on activateRental to ensure it's called
      // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
      const activateSpy = jest.spyOn(service, 'activateRental').mockResolvedValue({} as any);

      await service.autoActivateRentals();

      expect(mockPrismaService.rental.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            status: RentalStatus.APPROVED,
            invoice: {
              status: InvoiceStatus.PAID,
            },
            deletedAt: null,
          },
        }),
      );

      expect(activateSpy).toHaveBeenCalledTimes(2);
      expect(activateSpy).toHaveBeenCalledWith('rental-1', 'site-1', 'SYSTEM');
      expect(activateSpy).toHaveBeenCalledWith('rental-2', 'site-1', 'SYSTEM');
    });

    it('should handle errors gracefully during activation', async () => {
      const mockPaidRentals = [
        { id: 'rental-1', siteId: 'site-1', clientId: 'client-1' },
        { id: 'rental-2', siteId: 'site-1', clientId: 'client-2' },
      ];

      mockPrismaService.rental.findMany.mockResolvedValue(mockPaidRentals);

      const activateSpy = jest
        .spyOn(service, 'activateRental')
        .mockRejectedValueOnce(new Error('Activation failed'))
        // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
        .mockResolvedValueOnce({} as any);

      await service.autoActivateRentals();

      expect(activateSpy).toHaveBeenCalledTimes(2);
      // verify execution continued to second rental despite first failure
      expect(activateSpy).toHaveBeenCalledWith('rental-2', 'site-1', 'SYSTEM');
    });
  });
});
