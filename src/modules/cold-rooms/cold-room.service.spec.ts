/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/unbound-method */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { Test, TestingModule } from '@nestjs/testing';
import { ColdRoomService } from './cold-rooms.service';
import { PrismaService } from '../../database/prisma.service';
import { UserRole } from '@prisma/client';
import { ForbiddenException, NotFoundException, BadRequestException } from '@nestjs/common';

describe('ColdRoomService', () => {
  let service: ColdRoomService;
  let prisma: PrismaService;

  const mockAdmin = {
    userId: 'admin-1',
    role: UserRole.SUPER_ADMIN,
  };

  const mockManager = {
    userId: 'mgr-1',
    role: UserRole.SITE_MANAGER,
    siteId: 'site-a',
  };

  const mockRoom = {
    id: 'room-123',
    name: 'Main Freezer',
    siteId: 'site-a',
    totalCapacityKg: 1000,
    usedCapacityKg: 0,
    deletedAt: null,
  };

  const mockPrismaService = {
    site: {
      findUnique: jest.fn(),
    },
    coldRoom: {
      create: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ColdRoomService, { provide: PrismaService, useValue: mockPrismaService }],
    }).compile();

    service = module.get<ColdRoomService>(ColdRoomService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  afterEach(() => jest.clearAllMocks());

  // create
  describe('create', () => {
    const createDto = {
      name: 'New Room',
      siteId: 'site-a',
      totalCapacityKg: 500,
      temperatureMin: 2,
      temperatureMax: 8,
      powerType: 'ELECTRICITY' as any,
    };

    it('should allow manager to create in their own site', async () => {
      mockPrismaService.site.findUnique.mockResolvedValue({ id: 'site-a' });
      mockPrismaService.coldRoom.create.mockResolvedValue(mockRoom);

      await service.create(createDto, mockManager as any);
      expect(prisma.coldRoom.create).toHaveBeenCalled();
    });

    it('should throw ForbiddenException if manager tries to create for another site', async () => {
      const wrongDto = { ...createDto, siteId: 'site-b' };

      await expect(service.create(wrongDto, mockManager as any)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should throw BadRequest if Admin forgets siteId in DTO', async () => {
      const noSiteDto = { ...createDto, siteId: undefined };

      await expect(service.create(noSiteDto as any, mockAdmin as any)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  //findall
  describe('findAll', () => {
    it('should allow manager to see rooms in their own site', async () => {
      mockPrismaService.coldRoom.findMany.mockResolvedValue([mockRoom]);

      const result = await service.findAll(mockManager as any);

      expect(result).toHaveLength(1);

      expect(prisma.coldRoom.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ siteId: 'site-a' }),
        }),
      );
    });

    it('should block manager from seeing rooms in another site via query param', async () => {
      const targetSiteId = 'site-b';

      await expect(service.findAll(mockManager as any, targetSiteId)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should allow admin to filter by any siteId', async () => {
      mockPrismaService.coldRoom.findMany.mockResolvedValue([mockRoom]);

      await service.findAll(mockAdmin as any, 'site-c');

      expect(prisma.coldRoom.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ siteId: 'site-c' }),
        }),
      );
    });
  });

  //findone
  describe('findOne', () => {
    it('should allow manager to find a room in their site', async () => {
      mockPrismaService.coldRoom.findUnique.mockResolvedValue(mockRoom);
      const result = await service.findOne('room-123', mockManager as any);
      expect(result.id).toBe('room-123');
    });

    it('should block manager from accessing a room in another site', async () => {
      mockPrismaService.coldRoom.findUnique.mockResolvedValue({
        ...mockRoom,
        siteId: 'site-other',
      });

      await expect(service.findOne('room-123', mockManager as any)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should throw NotFoundException if the cold room does not exist', async () => {
      mockPrismaService.coldRoom.findUnique.mockResolvedValue(null);

      await expect(service.findOne('wrong-id', mockAdmin as any)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  //update
  describe('update', () => {
    const updateDto = { name: 'Updated Room Name' };

    it('should allow manager to update a room in their site', async () => {
      mockPrismaService.coldRoom.findUnique.mockResolvedValue(mockRoom);
      mockPrismaService.coldRoom.update.mockResolvedValue({ ...mockRoom, ...updateDto });

      const result = await service.update('room-123', updateDto, mockManager as any);
      expect(result.name).toBe(updateDto.name);
    });

    it('should block manager from reassigning room to another site', async () => {
      const siteChangeDto = { siteId: 'site-other' };

      await expect(service.update('room-123', siteChangeDto, mockManager as any)).rejects.toThrow(
        ForbiddenException,
      );
    });

    //remove
    describe('remove', () => {
      it('should perform a soft delete if manager owns the site', async () => {
        mockPrismaService.coldRoom.findUnique.mockResolvedValue(mockRoom);

        const result = await service.remove('room-123', mockManager as any);

        expect(result.message).toBe('Cold room deleted successfully');
        expect(prisma.coldRoom.update).toHaveBeenCalledWith(
          expect.objectContaining({
            where: { id: 'room-123' },
            data: expect.objectContaining({ deletedAt: expect.any(Date) }),
          }),
        );
      });

      it('should allow Admin to delete any room regardless of site', async () => {
        mockPrismaService.coldRoom.findUnique.mockResolvedValue({
          ...mockRoom,
          siteId: 'any-site',
        });

        await service.remove('room-123', mockAdmin as any);
        expect(prisma.coldRoom.update).toHaveBeenCalled();
      });
    });

    //occupancy
    describe('getOccupancyDetails', () => {
      it('should calculate occupancy stats correctly', async () => {
        mockPrismaService.coldRoom.findUnique.mockResolvedValue({
          ...mockRoom,
          totalCapacityKg: 1000,
          usedCapacityKg: 500,
        });

        const details = await service.getOccupancyDetails('room-123', mockAdmin as any);

        expect(details.occupancyPercentage).toBe(50);
        expect(details.availableKg).toBe(500);
      });
    });
  });
});
