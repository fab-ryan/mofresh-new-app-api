import { Test, TestingModule } from '@nestjs/testing';
import { StockMovementsService } from './stock-movements.service';
import { StockMovementsController } from './stock-movement.controller';
import { UserRole, StockMovementType } from '@prisma/client';
import { CurrentUserPayload } from '@/common/decorators/current-user.decorator';

describe('StockMovementsController', () => {
  let controller: StockMovementsController;
  let service: StockMovementsService;

  const mockUser: CurrentUserPayload = {
    userId: 'user-123',
    email: 'aimee@mofresh.rw',
    role: UserRole.SITE_MANAGER,
    siteId: 'site-alpha',
  };

  const mockStockMovement = {
    id: 'move-1',
    productId: 'prod-1',
    quantityKg: 50,
    movementType: StockMovementType.IN,
  };

  const mockService = {
    recordMovement: jest.fn().mockResolvedValue(mockStockMovement),
    findAll: jest.fn().mockResolvedValue({ data: [], pagination: {} }),
    revertMovement: jest.fn().mockResolvedValue({ ...mockStockMovement, reason: 'REVERSAL' }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [StockMovementsController],
      providers: [
        {
          provide: StockMovementsService,
          useValue: mockService,
        },
      ],
    }).compile();

    controller = module.get<StockMovementsController>(StockMovementsController);
    service = module.get<StockMovementsService>(StockMovementsService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('record', () => {
    it('should call service.recordMovement with DTO and user context', async () => {
      const dto = {
        productId: 'prod-1',
        coldRoomId: 'room-1',
        quantityKg: 50,
        movementType: StockMovementType.IN,
        reason: 'Restock',
      };

      const result = await controller.record(dto, mockUser);

      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(service.recordMovement).toHaveBeenCalledWith(dto, mockUser);
      expect(result).toEqual(mockStockMovement);
    });
  });

  describe('getHistory', () => {
    it('should call service.findAll with filters and user context', async () => {
      const filters = { productId: 'prod-1', page: 1 };

      await controller.getHistory(filters, mockUser);

      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(service.findAll).toHaveBeenCalledWith(filters, mockUser);
    });
  });

  describe('revert', () => {
    it('should call service.revertMovement with ID and user context', async () => {
      const movementId = 'move-123';

      await controller.revert(movementId, mockUser);

      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(service.revertMovement).toHaveBeenCalledWith(movementId, mockUser);
    });
  });
});
