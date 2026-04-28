/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-ignore
import { Test, TestingModule } from '@nestjs/testing';
import { SitesService } from './sites.service';
import { PrismaService } from '../../database/prisma.service';
import { NotFoundException } from '@nestjs/common';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { describe, beforeEach, it, expect, jest } from '@jest/globals';

describe('SitesService', () => {
  let service: SitesService;
  let prisma: PrismaService;

  const mockSite = {
    id: 'uuid',
    name: 'Test Site',
    location: 'Test Location',
    managerId: 'manager-uuid',
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SitesService,
        {
          provide: PrismaService,
          useValue: {
            site: {
              create: jest.fn().mockResolvedValue(mockSite as never),
              findMany: jest.fn().mockResolvedValue([mockSite] as never),
              findUnique: jest.fn().mockResolvedValue(mockSite as never),
              update: jest.fn().mockResolvedValue(mockSite as never),
              delete: jest.fn().mockResolvedValue(mockSite as never),
            },
          },
        },
        {
          provide: AuditLogsService,
          useValue: {
            createAuditLog: jest.fn().mockResolvedValue(null as never),
          },
        },
      ],
    }).compile();

    service = module.get<SitesService>(SitesService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should create a site', async () => {
    const createDto = { name: 'New Site', location: 'New Location' };
    const result = await service.create(createDto, 'user-uuid');
    expect(result).toEqual(mockSite);
    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(prisma.site.create).toHaveBeenCalledWith({ data: createDto });
  });

  it('should find all sites', async () => {
    const result = await service.findAll();
    expect(result).toEqual([mockSite]);
    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(prisma.site.findMany).toHaveBeenCalled();
  });

  it('should find one site by id', async () => {
    const result = await service.findOne('uuid');
    expect(result).toEqual(mockSite);
    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(prisma.site.findUnique).toHaveBeenCalledWith({ where: { id: 'uuid' } });
  });

  it('should throw NotFoundException if site not found by id', async () => {
    jest.spyOn(prisma.site, 'findUnique').mockResolvedValueOnce(null);
    try {
      await service.findOne('non-existing-id');
    } catch (error) {
      expect(error).toBeInstanceOf(NotFoundException);
      expect((error as Error).message).toBe('Site with ID non-existing-id not found.');
    }
  });

  it('should update a site', async () => {
    const updateDto = { name: 'Updated Site' };
    const result = await service.update('uuid', updateDto, 'user-uuid');
    expect(result).toEqual(mockSite);
    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(prisma.site.update).toHaveBeenCalledWith({ where: { id: 'uuid' }, data: updateDto });
  });

  it('should throw NotFoundException if site not found during update', async () => {
    jest.spyOn(prisma.site, 'findUnique').mockResolvedValueOnce(null); // Simulate no site found
    try {
      await service.update('non-existing-id', { name: 'Updated Site' }, 'user-uuid');
    } catch (error) {
      expect(error).toBeInstanceOf(NotFoundException);
      expect((error as Error).message).toBe('Site with ID non-existing-id not found');
    }
  });

  it('should delete a site', async () => {
    const result = await service.remove('uuid', 'user-uuid');
    expect(result).toEqual(mockSite);
    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(prisma.site.update).toHaveBeenCalledWith({
      where: { id: 'uuid' },
      data: expect.objectContaining({
        deletedAt: expect.any(Date) as unknown as Date,
      }),
    });
  });

  it('should throw NotFoundException if site not found during deletion', async () => {
    jest.spyOn(prisma.site, 'findUnique').mockResolvedValueOnce(null);
    try {
      await service.remove('non-existing-id', 'user-uuid');
    } catch (error) {
      expect(error).toBeInstanceOf(NotFoundException);
      expect((error as Error).message).toBe('Site with ID non-existing-id not found');
    }
  });
});
