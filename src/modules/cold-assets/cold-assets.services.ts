/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unused-vars */
import {
  Injectable,
  NotFoundException,
  ConflictException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { AssetStatus, UserRole, AuditAction } from '@prisma/client';
import {
  CreateTricycleDto,
  CreateColdBoxDto,
  CreateColdPlateDto,
  UpdateTricycleDto,
  UpdateColdBoxDto,
  UpdateColdPlateDto,
} from './dto/cold-assets.dto';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { CloudinaryService } from '../cloudinary/cloudinary.service';
import { TricycleEntity } from './entities/tricycle.entity';
import { ColdBoxEntity } from './entities/cold-box.entity';
import { ColdPlateEntity } from './entities/cold-plate.entity';
import { CurrentUserPayload } from '../../common/decorators/current-user.decorator';

@Injectable()
export class ColdAssetsService {
  constructor(
    private prisma: PrismaService,
    private auditService: AuditLogsService,
    private cloudinaryService: CloudinaryService,
  ) {}

  private applyRoleFilters(user: CurrentUserPayload, requestedSiteId?: string): any {
    const where: any = { deletedAt: null };
    if (!user) {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      where.status = AssetStatus.AVAILABLE;
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      if (requestedSiteId) where.siteId = requestedSiteId;
      return where;
    }

    if (user.role === UserRole.SITE_MANAGER || user.role === UserRole.CLIENT) {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      where.siteId = user.siteId;
      if (user.role === UserRole.CLIENT) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        where.status = AssetStatus.AVAILABLE;
      }
    } else if (user.role === UserRole.SUPER_ADMIN) {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      if (requestedSiteId) where.siteId = requestedSiteId;
    } else {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      where.id = 'none';
    }

    return where;
  }

  private validateSiteAccess(user: CurrentUserPayload, targetSiteId?: string) {
    if (user.role === UserRole.SITE_MANAGER) {
      if (!user.siteId) {
        throw new BadRequestException('Site Manager is not assigned to any site.');
      }
      if (targetSiteId && targetSiteId !== user.siteId) {
        throw new ForbiddenException('Access denied: This asset belongs to another site.');
      }
    }
  }

  // --- TRICYCLES ---

  async createTricycle(dto: CreateTricycleDto, user: CurrentUserPayload) {
    if (user.role === UserRole.SITE_MANAGER) {
      this.validateSiteAccess(user, dto.siteId);
      dto.siteId = user.siteId!;
    } else if (user.role === UserRole.SUPER_ADMIN && !dto.siteId) {
      throw new BadRequestException('Admin must specify a siteId');
    }

    const existing = await this.prisma.tricycle.findUnique({
      where: { plateNumber: dto.plateNumber },
    });
    if (existing) throw new ConflictException('Tricycle with this plate number already exists');

    const asset = await this.prisma.tricycle.create({ data: dto });
    return new TricycleEntity(asset);
  }

  async findTricycles(user?: CurrentUserPayload, siteId?: string) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const where = this.applyRoleFilters(user, siteId);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const data = await this.prisma.tricycle.findMany({ where, include: { site: true } });
    return data.map((item) => new TricycleEntity(item));
  }

  // --- COLD BOXES ---

  async createColdBox(dto: CreateColdBoxDto, user: CurrentUserPayload) {
    if (user.role === UserRole.SITE_MANAGER) {
      this.validateSiteAccess(user, dto.siteId);
      dto.siteId = user.siteId!;
    } else if (user.role === UserRole.SUPER_ADMIN && !dto.siteId) {
      throw new BadRequestException('Admin must specify a siteId');
    }

    const existing = await this.prisma.coldBox.findUnique({
      where: { identificationNumber: dto.identificationNumber },
    });
    if (existing) throw new ConflictException('Cold Box with this ID already exists');

    const asset = await this.prisma.coldBox.create({ data: dto });
    return new ColdBoxEntity(asset);
  }

  async findColdBoxes(user?: CurrentUserPayload, siteId?: string) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const where = this.applyRoleFilters(user, siteId);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const data = await this.prisma.coldBox.findMany({ where, include: { site: true } });
    return data.map((item) => new ColdBoxEntity(item));
  }

  // --- COLD PLATES ---

  async createColdPlate(dto: CreateColdPlateDto, user: CurrentUserPayload) {
    if (user.role === UserRole.SITE_MANAGER) {
      this.validateSiteAccess(user, dto.siteId);
      dto.siteId = user.siteId!;
    } else if (user.role === UserRole.SUPER_ADMIN && !dto.siteId) {
      throw new BadRequestException('Admin must specify a siteId');
    }

    const existing = await this.prisma.coldPlate.findUnique({
      where: { identificationNumber: dto.identificationNumber },
    });
    if (existing) throw new ConflictException('Cold Plate with this ID already exists');

    const asset = await this.prisma.coldPlate.create({ data: dto });
    return new ColdPlateEntity(asset);
  }

  async findColdPlates(user?: CurrentUserPayload, siteId?: string) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const where = this.applyRoleFilters(user, siteId);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const data = await this.prisma.coldPlate.findMany({ where, include: { site: true } });
    return data.map((item) => new ColdPlateEntity(item));
  }

  // --- UPDATE OPERATIONS ---

  async updateTricycle(
    id: string,
    dto: UpdateTricycleDto,
    user: CurrentUserPayload,
    image?: Express.Multer.File,
  ) {
    const tricycle = await this.prisma.tricycle.findUnique({ where: { id } });
    if (!tricycle) throw new NotFoundException('Tricycle not found');

    this.validateSiteAccess(user, tricycle.siteId);

    let imageUrl: string | undefined;
    if (image) {
      const uploadResult = await this.cloudinaryService.uploadFile(image, 'mofresh-tricycles');
      imageUrl = uploadResult.secure_url as string;
    }

    const updated = await this.prisma.tricycle.update({
      where: { id },
      data: {
        ...dto,
        ...(imageUrl && { imageUrl }),
      },
    });
    await this.auditService.createAuditLog(user.userId, AuditAction.UPDATE, 'TRICYCLE', id);
    return new TricycleEntity(updated);
  }

  async updateColdBox(
    id: string,
    dto: UpdateColdBoxDto,
    user: CurrentUserPayload,
    image?: Express.Multer.File,
  ) {
    const box = await this.prisma.coldBox.findUnique({ where: { id } });
    if (!box) throw new NotFoundException('Cold Box not found');

    this.validateSiteAccess(user, box.siteId);

    let imageUrl: string | undefined;
    if (image) {
      const uploadResult = await this.cloudinaryService.uploadFile(image, 'mofresh-cold-boxes');
      imageUrl = uploadResult.secure_url as string;
    }

    const updated = await this.prisma.coldBox.update({
      where: { id },
      data: {
        ...dto,
        ...(imageUrl && { imageUrl }),
      },
    });
    await this.auditService.createAuditLog(user.userId, AuditAction.UPDATE, 'COLDBOX', id);
    return new ColdBoxEntity(updated);
  }

  async updateColdPlate(
    id: string,
    dto: UpdateColdPlateDto,
    user: CurrentUserPayload,
    image?: Express.Multer.File,
  ) {
    const plate = await this.prisma.coldPlate.findUnique({ where: { id } });
    if (!plate) throw new NotFoundException('Cold Plate not found');

    this.validateSiteAccess(user, plate.siteId);

    let imageUrl: string | undefined;
    if (image) {
      const uploadResult = await this.cloudinaryService.uploadFile(image, 'mofresh-cold-plates');
      imageUrl = uploadResult.secure_url as string;
    }

    const updated = await this.prisma.coldPlate.update({
      where: { id },
      data: {
        ...dto,
        ...(imageUrl && { imageUrl }),
      },
    });
    await this.auditService.createAuditLog(user.userId, AuditAction.UPDATE, 'COLDPLATE', id);
    return new ColdPlateEntity(updated);
  }

  async updateStatus(
    type: 'tricycle' | 'coldBox' | 'coldPlate',
    id: string,
    status: AssetStatus,
    user: CurrentUserPayload,
  ) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const model = this.prisma[type] as any;

    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    const asset = await model.findUnique({ where: { id } });
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    if (!asset || asset.deletedAt) throw new NotFoundException(`${type} not found`);

    // Enforcement of the site-manager-only rule
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-member-access
    this.validateSiteAccess(user, asset.siteId);

    // eslint-disable-next-line @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    return model.update({
      where: { id },
      data: { status },
    });
  }

  async remove(type: 'tricycle' | 'coldBox' | 'coldPlate', id: string, user: CurrentUserPayload) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const model = this.prisma[type] as any;

    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    const asset = await model.findUnique({ where: { id } });
    if (!asset) throw new NotFoundException(`${type} not found`);

    // Enforcement of the site-manager-only rule
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-member-access
    this.validateSiteAccess(user, asset.siteId);

    // eslint-disable-next-line @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    return model.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }
}
