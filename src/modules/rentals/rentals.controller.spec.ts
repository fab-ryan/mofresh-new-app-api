/* eslint-disable prettier/prettier */
/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/require-await */
import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { RentalsController } from './rentals.controller';
import { RentalsService } from './rentals.service';
import { CreateRentalDto } from './dto/create-rental.dto';
import { AssetType, RentalStatus, UserRole, AssetStatus } from '@prisma/client';
import { CurrentUserPayload } from '../../common/decorators/current-user.decorator';

describe('RentalsController', () => {
  let controller: RentalsController;

  const mockRentalsService = {
    createRental: jest.fn(),
    findAllRental: jest.fn(),
    findOneRental: jest.fn(),
    approveRental: jest.fn(),
    activateRental: jest.fn(),
    complete: jest.fn(),
    getAvailableAssetsByType: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [RentalsController],
      providers: [
        {
          provide: RentalsService,
          useValue: mockRentalsService,
        },
      ],
    }).compile();

    controller = module.get<RentalsController>(RentalsController);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    const mockDto: CreateRentalDto = {
      assetType: AssetType.COLD_BOX,
      coldBoxId: 'box-1',
      rentalStartDate: '2026-02-15',
      rentalEndDate: '2026-02-20',
      estimatedFee: 50000,
    };

    const mockUser: CurrentUserPayload = {
      userId: 'client-1',
      email: 'client@test.com',
      role: UserRole.CLIENT,
      siteId: 'site-1',
    };

    const mockRental = {
      id: 'rental-1',
      clientId: 'client-1',
      siteId: 'site-1',
      status: RentalStatus.REQUESTED,
    };

    it('should create rental successfully', async () => {
      mockRentalsService.createRental.mockResolvedValue(mockRental);

      const result = await controller.create(mockDto, mockUser);

      expect(result).toBeDefined();
      expect(result.id).toBe('rental-1');
      expect(mockRentalsService.createRental).toHaveBeenCalledWith('client-1', 'site-1', mockDto);
    });

    it('should throw BadRequestException if client has no siteId', async () => {
      const userWithoutSite = { ...mockUser, siteId: undefined };

      await expect(controller.create(mockDto, userWithoutSite)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should create rental successfully for public request (no user)', async () => {
      const publicDto: CreateRentalDto = {
        ...mockDto,
        clientId: 'public-client',
        siteId: 'public-site',
      };
      mockRentalsService.createRental.mockResolvedValue(mockRental);

      const result = await controller.create(publicDto, undefined);

      expect(result).toBeDefined();
      expect(mockRentalsService.createRental).toHaveBeenCalledWith(
        'public-client',
        'public-site',
        publicDto,
      );
    });
  });

  describe('getAvailableAssets', () => {
    const mockQuery = { assetType: AssetType.COLD_BOX };
    const mockAssets = [
      { id: 'box-1', status: AssetStatus.AVAILABLE },
      { id: 'box-2', status: AssetStatus.AVAILABLE },
    ];

    it('should return available assets', async () => {
      const mockUser: CurrentUserPayload = {
        userId: 'client-1',
        email: 'client@test.com',
        role: UserRole.CLIENT,
        siteId: 'site-1',
      };

      it('should throw BadRequestException if user has no siteId', async () => {
        const mockUser: CurrentUserPayload = {
          userId: 'admin-1',
          email: 'admin@test.com',
          role: UserRole.SUPER_ADMIN,
          siteId: undefined,
        };

        await expect(controller.getAvailableAssets(mockQuery, mockUser)).rejects.toThrow(
          BadRequestException,
        );
      });

      it('should return available assets for public request (no user)', async () => {
        const publicQuery = { ...mockQuery, siteId: 'public-site' };
        mockRentalsService.getAvailableAssetsByType.mockResolvedValue(mockAssets);

        const result = await controller.getAvailableAssets(publicQuery, undefined);

        expect(result).toEqual(mockAssets);
        expect(mockRentalsService.getAvailableAssetsByType).toHaveBeenCalledWith(
          AssetType.COLD_BOX,
          'public-site',
        );
      });
    });

    describe('findAll', () => {
      const mockRentals = {
        data: [
          {
            id: 'rental-1',
            status: RentalStatus.REQUESTED,
          },
        ],
        meta: {
          total: 1,
          page: 1,
          limit: 10,
        },
      };

      it('should return rentals for CLIENT', async () => {
        const mockUser: CurrentUserPayload = {
          userId: 'client-1',
          email: 'client@test.com',
          role: UserRole.CLIENT,
          siteId: 'site-1',
        };

        mockRentalsService.findAllRental.mockResolvedValue(mockRentals);

        const result = await controller.findAll(mockUser, undefined, '1', '10');

        expect(result).toBeDefined();
        expect(result.data).toHaveLength(1);
        expect(mockRentalsService.findAllRental).toHaveBeenCalledWith(
          'site-1',
          UserRole.CLIENT,
          'client-1',
          undefined,
          1,
          10,
        );
      });

      it('should return rentals for SITE_MANAGER', async () => {
        const mockUser: CurrentUserPayload = {
          userId: 'manager-1',
          email: 'manager@test.com',
          role: UserRole.SITE_MANAGER,
          siteId: 'site-1',
        };

        mockRentalsService.findAllRental.mockResolvedValue(mockRentals);

        const result = await controller.findAll(mockUser, undefined, '1', '10');

        expect(result).toBeDefined();
        expect(mockRentalsService.findAllRental).toHaveBeenCalledWith(
          'site-1',
          UserRole.SITE_MANAGER,
          'manager-1',
          undefined,
          1,
          10,
        );
      });

      it('should return all rentals for SUPER_ADMIN', async () => {
        const mockUser: CurrentUserPayload = {
          userId: 'admin-1',
          email: 'admin@test.com',
          role: UserRole.SUPER_ADMIN,
          siteId: undefined,
        };

        mockRentalsService.findAllRental.mockResolvedValue(mockRentals);

        const result = await controller.findAll(mockUser, undefined, '1', '10');

        expect(result).toBeDefined();
        expect(mockRentalsService.findAllRental).toHaveBeenCalledWith(
          undefined,
          UserRole.SUPER_ADMIN,
          'admin-1',
          undefined,
          1,
          10,
        );
      });

      it('should filter by status', async () => {
        const mockUser: CurrentUserPayload = {
          userId: 'manager-1',
          email: 'manager@test.com',
          role: UserRole.SITE_MANAGER,
          siteId: 'site-1',
        };

        mockRentalsService.findAllRental.mockResolvedValue(mockRentals);

        await controller.findAll(mockUser, RentalStatus.APPROVED, '1', '10');

        expect(mockRentalsService.findAllRental).toHaveBeenCalledWith(
          'site-1',
          UserRole.SITE_MANAGER,
          'manager-1',
          RentalStatus.APPROVED,
          1,
          10,
        );
      });
    });

    describe('findOne', () => {
      const mockRental = {
        id: 'rental-1',
        status: RentalStatus.REQUESTED,
      };

      it('should return rental for SUPER_ADMIN', async () => {
        const mockUser: CurrentUserPayload = {
          userId: 'admin-1',
          email: 'admin@test.com',
          role: UserRole.SUPER_ADMIN,
          siteId: undefined,
        };

        mockRentalsService.findOneRental.mockResolvedValue(mockRental);

        const result = await controller.findOne('rental-1', mockUser);

        expect(result).toBeDefined();
        expect(mockRentalsService.findOneRental).toHaveBeenCalledWith(
          'rental-1',
          undefined,
          UserRole.SUPER_ADMIN,
          'admin-1',
        );
      });

      it('should return rental for SITE_MANAGER', async () => {
        const mockUser: CurrentUserPayload = {
          userId: 'manager-1',
          email: 'manager@test.com',
          role: UserRole.SITE_MANAGER,
          siteId: 'site-1',
        };

        mockRentalsService.findOneRental.mockResolvedValue(mockRental);

        const result = await controller.findOne('rental-1', mockUser);

        expect(result).toBeDefined();
        expect(mockRentalsService.findOneRental).toHaveBeenCalledWith(
          'rental-1',
          'site-1',
          UserRole.SITE_MANAGER,
          'manager-1',
        );
      });

      it('should return rental for CLIENT', async () => {
        const mockUser: CurrentUserPayload = {
          userId: 'client-1',
          email: 'client@test.com',
          role: UserRole.CLIENT,
          siteId: 'site-1',
        };

        mockRentalsService.findOneRental.mockResolvedValue(mockRental);

        const result = await controller.findOne('rental-1', mockUser);

        expect(result).toBeDefined();
        expect(mockRentalsService.findOneRental).toHaveBeenCalledWith(
          'rental-1',
          'site-1',
          UserRole.CLIENT,
          'client-1',
        );
      });
    });

    describe('approve', () => {
      const mockResult = {
        id: 'rental-1',
        status: RentalStatus.APPROVED,
        invoice: {
          id: 'invoice-1',
          invoiceNumber: 'INV-KIGALI-2026-00001',
        },
      };

      it('should approve rental for SITE_MANAGER', async () => {
        const mockUser: CurrentUserPayload = {
          userId: 'manager-1',
          email: 'manager@test.com',
          role: UserRole.SITE_MANAGER,
          siteId: 'site-1',
        };

        mockRentalsService.approveRental.mockResolvedValue(mockResult);

        const result = await controller.approve('rental-1', mockUser);

        expect(result).toBeDefined();

        expect(result.status).toBe(RentalStatus.APPROVED);
        expect(result.invoice).toBeDefined();
        expect(mockRentalsService.approveRental).toHaveBeenCalledWith(
          'rental-1',
          'site-1',
          'manager-1',
        );
      });

      it('should throw BadRequestException if SUPER_ADMIN has no siteId', async () => {
        const mockUser: CurrentUserPayload = {
          userId: 'admin-1',
          email: 'admin@test.com',
          role: UserRole.SUPER_ADMIN,
          siteId: undefined,
        };

        await expect(controller.approve('rental-1', mockUser)).rejects.toThrow(BadRequestException);
      });

      it('should throw BadRequestException if SITE_MANAGER has no siteId', async () => {
        const mockUser: CurrentUserPayload = {
          userId: 'manager-1',
          email: 'manager@test.com',
          role: UserRole.SITE_MANAGER,
          siteId: undefined,
        };

        await expect(controller.approve('rental-1', mockUser)).rejects.toThrow(BadRequestException);
      });
    });

    describe('activate', () => {
      const mockRental = {
        id: 'rental-1',
        status: RentalStatus.ACTIVE,
      };

      it('should activate rental for SITE_MANAGER', async () => {
        const mockUser: CurrentUserPayload = {
          userId: 'manager-1',
          email: 'manager@test.com',
          role: UserRole.SITE_MANAGER,
          siteId: 'site-1',
        };

        mockRentalsService.activateRental.mockResolvedValue(mockRental);

        const result = await controller.activate('rental-1', mockUser);

        expect(result).toBeDefined();
        expect(result.status).toBe(RentalStatus.ACTIVE);
        expect(mockRentalsService.activateRental).toHaveBeenCalledWith(
          'rental-1',
          'site-1',
          'manager-1',
        );
      });

      it('should throw BadRequestException if SUPER_ADMIN has no siteId', async () => {
        const mockUser: CurrentUserPayload = {
          userId: 'admin-1',
          email: 'admin@test.com',
          role: UserRole.SUPER_ADMIN,
          siteId: undefined,
        };

        await expect(controller.activate('rental-1', mockUser)).rejects.toThrow(BadRequestException);
      });

      it('should throw BadRequestException if SITE_MANAGER has no siteId', async () => {
        const mockUser: CurrentUserPayload = {
          userId: 'manager-1',
          email: 'manager@test.com',
          role: UserRole.SITE_MANAGER,
          siteId: undefined,
        };

        await expect(controller.activate('rental-1', mockUser)).rejects.toThrow(BadRequestException);
      });
    });

    describe('complete', () => {
      const mockRental = {
        id: 'rental-1',
        status: RentalStatus.COMPLETED,
      };

      it('should complete rental for SITE_MANAGER', async () => {
        const mockUser: CurrentUserPayload = {
          userId: 'manager-1',
          email: 'manager@test.com',
          role: UserRole.SITE_MANAGER,
          siteId: 'site-1',
        };

        mockRentalsService.complete.mockResolvedValue(mockRental);

        const result = await controller.complete('rental-1', mockUser);

        expect(result).toBeDefined();
        expect(result.status).toBe(RentalStatus.COMPLETED);
        expect(mockRentalsService.complete).toHaveBeenCalledWith('rental-1', 'site-1', 'manager-1');
      });

      it('should throw BadRequestException if SUPER_ADMIN has no siteId', async () => {
        const mockUser: CurrentUserPayload = {
          userId: 'admin-1',
          email: 'admin@test.com',
          role: UserRole.SUPER_ADMIN,
          siteId: undefined,
        };

        await expect(controller.complete('rental-1', mockUser)).rejects.toThrow(BadRequestException);
      });

      it('should throw BadRequestException if SITE_MANAGER has no siteId', async () => {
        const mockUser: CurrentUserPayload = {
          userId: 'manager-1',
          email: 'manager@test.com',
          role: UserRole.SITE_MANAGER,
          siteId: undefined,
        };

        await expect(controller.complete('rental-1', mockUser)).rejects.toThrow(BadRequestException);
      });
    });
  });
});
