import { Test, TestingModule } from '@nestjs/testing';
import { AuditLogsService } from './audit-logs.service';
import { PrismaService } from '@/database/prisma.service';
import { BadRequestException } from '@nestjs/common';
import { AuditAction, Prisma } from '@prisma/client';
import { AuditLogEntity } from './dto/entities/audit-log.entity';
import { plainToInstance } from 'class-transformer';

describe('AuditLogsService', () => {
  let auditLogsService: AuditLogsService;
  let prismaService: PrismaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
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
      ],
    }).compile();

    auditLogsService = module.get<AuditLogsService>(AuditLogsService);
    prismaService = module.get<PrismaService>(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('createAuditLog', () => {
    it('should throw BadRequestException if user is not found', async () => {
      const prismaError = new Prisma.PrismaClientKnownRequestError(
        'Foreign key constraint failed',
        {
          code: 'P2003',
          clientVersion: '6.19.2',
        },
      );
      (prismaService.auditLog.create as jest.Mock).mockRejectedValue(prismaError);

      await expect(
        auditLogsService.createAuditLog('userId', AuditAction.CREATE, 'Product', '123'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should create an audit log if user exists', async () => {
      const user = { id: 'userId', email: 'test@example.com' };

      const auditLogData = {
        entityType: 'Product',
        entityId: '123',
        action: AuditAction.CREATE,
        userId: 'userId',
        details: { name: 'Product1' },
      };

      const createdAuditLog = {
        ...auditLogData,
        timestamp: new Date(),
        user,
      };

      (prismaService.auditLog.create as jest.Mock).mockResolvedValue(createdAuditLog);

      const result = await auditLogsService.createAuditLog(
        'userId',
        AuditAction.CREATE,
        'Product',
        '123',
        { name: 'Product1' },
      );

      expect(result).toEqual(plainToInstance(AuditLogEntity, createdAuditLog));
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(prismaService.auditLog.create).toHaveBeenCalledWith({
        data: {
          entityType: 'Product',
          entityId: '123',
          action: AuditAction.CREATE,
          userId: 'userId',
          details: { name: 'Product1' },
          timestamp: expect.any(Date) as unknown as Date,
        },
        include: { user: true },
      });
    });
  });

  describe('getAuditLogs', () => {
    it('should return an array of audit logs', async () => {
      const auditLogs = [
        {
          entityType: 'Product',
          entityId: '123',
          action: AuditAction.CREATE,
          userId: 'userId',
          details: { name: 'Product1' },
          timestamp: new Date(),
          user: { id: 'userId', email: 'test@example.com' },
        },
      ];

      (prismaService.auditLog.findMany as jest.Mock).mockResolvedValue(auditLogs);

      const result = await auditLogsService.getAuditLogs();

      expect(result).toEqual(plainToInstance(AuditLogEntity, auditLogs));
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(prismaService.auditLog.findMany).toHaveBeenCalledWith({
        where: {},
        include: { user: true },
      });
    });
  });
});
