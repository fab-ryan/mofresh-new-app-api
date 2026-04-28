import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from './../../database/prisma.service';
import { Prisma, UserRole, AuditAction } from '@prisma/client';
import { ColdRoomStatusDto } from './dto/cold-room-status.dto';
import { CreateColdRoomDto } from './dto/create-cold-room.dto';
import { UpdateColdRoomDto } from './dto/update-cold-room.dto';
import { ColdRoomEntity } from './entities/cold-room.entity';
import { CurrentUserPayload } from '../../common/decorators/current-user.decorator';
import { AuditLogsService } from '../audit-logs/audit-logs.service';

@Injectable()
export class ColdRoomService {
  constructor(
    private prisma: PrismaService,
    private auditService: AuditLogsService,
  ) {}

  async create(dto: CreateColdRoomDto, user: CurrentUserPayload) {
    if (user.role === UserRole.SITE_MANAGER) {
      if (dto.siteId && dto.siteId !== user.siteId) {
        throw new ForbiddenException(
          'Unauthorized access: You cannot register a cold room for a site that is not yours.',
        );
      }

      if (!user.siteId) {
        throw new BadRequestException('Your manager account is not assigned to a site.');
      }

      dto.siteId = user.siteId;
    } else if (user.role === UserRole.SUPER_ADMIN && !dto.siteId) {
      throw new BadRequestException('As an Admin, you must specify a siteId in the request body.');
    }

    const site = await this.prisma.site.findUnique({
      where: { id: dto.siteId },
    });

    if (!site) {
      throw new NotFoundException(`Site with ID ${dto.siteId} does not exist.`);
    }

    const room = await this.prisma.coldRoom.create({
      data: dto,
    });

    await this.auditService.createAuditLog(user.userId, AuditAction.CREATE, 'ColdRoom', room.id, {
      coldRoomName: room.name,
      siteId: dto.siteId,
      capacityKg: dto.totalCapacityKg,
    });

    return new ColdRoomEntity(room);
  }

  async findAll(user?: CurrentUserPayload, siteId?: string): Promise<ColdRoomEntity[]> {
    const where: Prisma.ColdRoomWhereInput = { deletedAt: null };

    if (!user) {
      if (siteId) where.siteId = siteId;
    } else if (user.role === UserRole.SITE_MANAGER || user.role === UserRole.CLIENT) {
      where.siteId = user.siteId;
    } else if (user.role === UserRole.SUPER_ADMIN) {
      if (siteId) where.siteId = siteId;
    }
    const rooms = await this.prisma.coldRoom.findMany({
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      where,
    });

    return rooms.map((room) => new ColdRoomEntity(room));
  }

  async findOne(id: string, user: CurrentUserPayload): Promise<ColdRoomEntity> {
    const room = await this.prisma.coldRoom.findUnique({
      where: { id, deletedAt: null },
    });

    if (!room) throw new NotFoundException('Cold room not found');

    if (user.role === UserRole.SITE_MANAGER && room.siteId !== user.siteId) {
      throw new ForbiddenException('Access denied: This room belongs to another site');
    }

    return new ColdRoomEntity(room);
  }

  async getOccupancyDetails(id: string, user: CurrentUserPayload): Promise<ColdRoomStatusDto> {
    const room = await this.findOne(id, user);

    return {
      totalCapacityKg: room.totalCapacityKg,
      usedCapacityKg: room.usedCapacityKg,
      availableKg: room.totalCapacityKg - room.usedCapacityKg,
      occupancyPercentage: Number(((room.usedCapacityKg / room.totalCapacityKg) * 100).toFixed(2)),
      canAcceptMore: room.usedCapacityKg < room.totalCapacityKg,
    };
  }

  async update(
    id: string,
    dto: UpdateColdRoomDto,
    user: CurrentUserPayload,
  ): Promise<ColdRoomEntity> {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const room = await this.findOne(id, user);

    if (user.role === UserRole.SITE_MANAGER && dto.siteId && dto.siteId !== user.siteId) {
      throw new ForbiddenException('Only an admin can reassign a cold room to a different site.');
    }

    const updated = await this.prisma.coldRoom.update({
      where: { id },
      data: dto,
    });

    await this.auditService.createAuditLog(user.userId, AuditAction.UPDATE, 'ColdRoom', id, {
      coldRoomName: updated.name,
      status: (updated as any).status,
    });

    return new ColdRoomEntity(updated);
  }

  async remove(id: string, user: CurrentUserPayload): Promise<{ message: string }> {
    await this.findOne(id, user);

    await this.prisma.coldRoom.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    return { message: 'Cold room deleted successfully' };
  }

  async findAllPublic(): Promise<ColdRoomEntity[]> {
    const rooms = await this.prisma.coldRoom.findMany({
      where: { deletedAt: null },
      orderBy: { createdAt: 'desc' },
    });
    return rooms.map((room) => new ColdRoomEntity(room));
  }

  async findDiscovery(siteId?: string): Promise<ColdRoomEntity[]> {
    const where: any = { deletedAt: null };
    if (siteId) {
      where.siteId = siteId;
    }

    const rooms = await this.prisma.coldRoom.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });
    return rooms.map((room) => new ColdRoomEntity(room));
  }

  async findOneDiscovery(id: string): Promise<ColdRoomEntity> {
    const room = await this.prisma.coldRoom.findUnique({
      where: { id, deletedAt: null },
    });

    if (!room) throw new NotFoundException('Cold room not found');

    return new ColdRoomEntity(room);
  }
}
