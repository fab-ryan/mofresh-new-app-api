import { Test, TestingModule } from '@nestjs/testing';
import { AuditLogsController } from './audit-logs.controller';
import { AuditLogsService } from './audit-logs.service';
import { PrismaService } from '@/database/prisma.service';
import { BadRequestException } from '@nestjs/common';
import { AuditAction, UserRole } from '@prisma/client';
import { CreateAuditLogDto } from './dto/create-audit-log.dto';
import { AuditLogEntity } from './dto/entities/audit-log.entity';

import { CurrentUserPayload } from '../../common/decorators/current-user.decorator';

describe('AuditLogsController', () => {
  let auditLogsController: AuditLogsController;
  let auditLogsService: AuditLogsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuditLogsController],
      providers: [
        AuditLogsService,
        {
          provide: PrismaService,
          useValue: {
            user: {
              findUnique: jest.fn(),
            },
            auditLog: {
              create: jest.fn(),
              findMany: jest.fn(),
            },
          },
        },
        {
          provide: AuditLogsService,
          useValue: {
            createAuditLog: jest.fn(),
            getAuditLogs: jest.fn(),
          },
        },
      ],
    }).compile();

    auditLogsController = module.get<AuditLogsController>(AuditLogsController);
    auditLogsService = module.get<AuditLogsService>(AuditLogsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('createAuditLog', () => {
    it('should throw BadRequestException if user is not found', async () => {
      const createAuditLogDto: CreateAuditLogDto = {
        entityType: 'Product',
        entityId: '123',
        action: AuditAction.CREATE,
        userId: 'userId',
        details: { name: 'Product1' },
      };

      (auditLogsService.createAuditLog as jest.Mock).mockRejectedValue(
        new BadRequestException('User not found'),
      );

      const mockUser: CurrentUserPayload = {
        userId: 'userId',
        email: 'test@example.com',
        role: UserRole.SUPER_ADMIN,
        siteId: 'siteId1',
      };
      await expect(auditLogsController.createAuditLog(createAuditLogDto, mockUser)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should create an audit log if user exists', async () => {
      const createAuditLogDto: CreateAuditLogDto = {
        entityType: 'Product',
        entityId: '123',
        action: AuditAction.CREATE,
        userId: 'userId',
        details: { name: 'Product1' },
      };

      // Mock the user
      const user = {
        id: 'userId',
        email: 'test@example.com',
        firstName: 'John',
        lastName: 'Doe',
        phone: '123-456-7890',
        role: 'ADMIN',
        siteId: 'siteId1',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const createdAuditLog = {
        id: 'auditLogId',
        ...createAuditLogDto,
        timestamp: new Date(),
        user,
      };

      (auditLogsService.createAuditLog as jest.Mock).mockResolvedValue(createdAuditLog);

      const mockUser: CurrentUserPayload = {
        userId: 'userId',
        email: 'test@example.com',
        role: UserRole.SUPER_ADMIN,
        siteId: 'siteId1',
      };
      const result = await auditLogsController.createAuditLog(createAuditLogDto, mockUser);

      expect(result).toEqual(createdAuditLog);
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(auditLogsService.createAuditLog).toHaveBeenCalledWith(
        'userId',
        AuditAction.CREATE,
        'Product',
        '123',
        { name: 'Product1' },
      );
    });
  });

  describe('getAuditLogs', () => {
    it('should return an array of audit logs', async () => {
      const auditLogs: AuditLogEntity[] = [
        {
          id: 'auditLogId',
          entityType: 'Product',
          entityId: '123',
          action: AuditAction.CREATE,
          userId: 'userId',
          details: { name: 'Product1' },
          timestamp: new Date(),
          user: {
            id: 'userId',
            email: 'test@example.com',
            firstName: 'John',
            lastName: 'Doe',
            phone: '123-456-7890',
            role: 'ADMIN',
            siteId: 'siteId1',
            isActive: true,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        },
      ];

      (auditLogsService.getAuditLogs as jest.Mock).mockResolvedValue(auditLogs);

      const mockUser: CurrentUserPayload = {
        userId: 'adminId',
        email: 'admin@example.com',
        role: UserRole.SUPER_ADMIN,
        siteId: null,
      };
      const result = await auditLogsController.getAuditLogs(mockUser);

      expect(result).toEqual(auditLogs);
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(auditLogsService.getAuditLogs).toHaveBeenCalled();
    });
  });
});
