/* eslint-disable prettier/prettier */
import {
  BadRequestException,
  Injectable,
  NotFoundException,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
} from '@nestjs/common';
import {
  AssetStatus,
  AssetType,
  AuditAction,
  InvoiceStatus,
  Prisma,
  RentalStatus,
  UserRole,
} from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { paginate } from '../../common/utils/paginator';
import { CreateRentalDto } from './dto';
import { InvoicesService } from '../invoices/invoices.service';

type AssetRef = { assetType: AssetType; assetId: string };

@Injectable()
export class RentalsService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RentalsService.name);
  private activationInterval: NodeJS.Timeout;

  constructor(
    private readonly db: PrismaService,
    private readonly invoicesService: InvoicesService,
  ) { }

  private getRoleBasedFilter(
    siteId: string | undefined,
    userRole?: UserRole,
    userId?: string,
  ): Prisma.RentalWhereInput {
    if (userRole === UserRole.SUPER_ADMIN) return {};
    if (userRole === UserRole.SITE_MANAGER) {
      if (!siteId) throw new BadRequestException('Site manager must belong to a site');
      return { siteId };
    }
    if (userRole === UserRole.CLIENT) {
      if (!siteId) throw new BadRequestException('Client must belong to a site');
      return { siteId, clientId: userId };
    }

    // Public access or unauthenticated
    const filter: Prisma.RentalWhereInput = {};
    if (siteId) filter.siteId = siteId;
    if (userId) filter.clientId = userId;
    return filter;
  }

  private parseAndValidateDates(dto: CreateRentalDto) {
    const start = new Date(dto.rentalStartDate);
    const end = new Date(dto.rentalEndDate);

    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      throw new BadRequestException('Invalid rentalStartDate or rentalEndDate');
    }
    if (end <= start) {
      throw new BadRequestException('rentalEndDate must be after rentalStartDate');
    }
    return { start, end };
  }

  private resolveAsset(dto: CreateRentalDto): AssetRef {
    const { assetType, coldBoxId, coldPlateId, tricycleId, coldRoomId } = dto;

    const provided: AssetRef[] = [];
    if (coldBoxId) provided.push({ assetType: AssetType.COLD_BOX, assetId: coldBoxId });
    if (coldPlateId) provided.push({ assetType: AssetType.COLD_PLATE, assetId: coldPlateId });
    if (tricycleId) provided.push({ assetType: AssetType.TRICYCLE, assetId: tricycleId });

    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    if (coldRoomId) provided.push({ assetType: AssetType.COLD_ROOM, assetId: coldRoomId });

    // User must provide exactly one asset ID
    if (provided.length === 0) {
      throw new BadRequestException(`Please select a specific ${assetType} .`);
    }

    // If multiple IDs provided, throw error
    if (provided.length > 1) {
      throw new BadRequestException(
        'Provide exactly one asset id: coldBoxId OR coldPlateId OR tricycleId OR coldRoomId',
      );
    }

    // Validate that provided asset type matches the ID type
    const selected = provided[0];
    if (selected.assetType !== assetType) {
      throw new BadRequestException(
        `assetType is ${assetType} but provided id is for ${selected.assetType}`,
      );
    }

    return selected;
  }

  private getRentalAssetRef(rental: {
    assetType: AssetType;
    coldBoxId: string | null;
    coldPlateId: string | null;
    tricycleId: string | null;
    coldRoomId: string | null;
  }): AssetRef {
    const assetId =
      rental.coldBoxId ?? rental.coldPlateId ?? rental.tricycleId ?? rental.coldRoomId;
    if (!assetId) throw new BadRequestException('Rental has no associated asset');
    return { assetType: rental.assetType, assetId };
  }
  private mapAssetTypeToModel(
    assetType: AssetType,
  ): 'coldBox' | 'coldPlate' | 'tricycle' | 'coldRoom' {
    if (assetType === AssetType.COLD_BOX) return 'coldBox';
    if (assetType === AssetType.COLD_PLATE) return 'coldPlate';
    if (assetType === AssetType.TRICYCLE) return 'tricycle';
    return 'coldRoom';
  }

  /**
   * Check asset availability with pessimistic locking (SELECT FOR UPDATE)
   * to prevent race conditions in concurrent rental requests
   */
  private async checkAndLockAsset(
    assetType: AssetType,
    assetId: string,
    siteId: string,
    tx: Prisma.TransactionClient,
  ) {
    const tableName = this.getTableName(assetType);

    // Use raw query with SELECT FOR UPDATE for pessimistic locking

    const assets = await tx.$queryRawUnsafe<any[]>(
      `
      SELECT * FROM "${tableName}" 
      WHERE id = $1 AND "siteId" = $2 AND "deletedAt" IS NULL
      FOR UPDATE
    `,
      assetId,
      siteId,
    );

    if (!assets || assets.length === 0) {
      throw new NotFoundException(`${assetType} not found or has been deleted`);
    }

    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const asset = assets[0];
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    if (asset.status !== AssetStatus.AVAILABLE) {
      throw new BadRequestException(
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        `${assetType} is not available. Current status: ${asset.status}`,
      );
    }

    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    return asset;
  }

  /**
   * Legacy method for non-transactional checks (used in read operations)
   */
  private async checkAvailability(assetType: AssetType, assetId: string, siteId: string) {
    const modelKey = this.mapAssetTypeToModel(assetType);

    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
    const model = (this.db as any)[modelKey];
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    const asset = await model.findFirst({
      where: { id: assetId, siteId, deletedAt: null },
      select: { status: true },
    });

    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    return asset?.status === AssetStatus.AVAILABLE;
  }

  private getTableName(assetType: AssetType): string {
    if (assetType === AssetType.COLD_BOX) return 'cold_boxes';
    if (assetType === AssetType.COLD_PLATE) return 'cold_plates';
    if (assetType === AssetType.TRICYCLE) return 'tricycles';
    return 'cold_rooms';
  }

  private async markAsRented(assetType: AssetType, assetId: string, tx?: Prisma.TransactionClient) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const client = (tx ?? this.db) as any;
    const modelKey = this.mapAssetTypeToModel(assetType);

    // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    await client[modelKey].update({
      where: { id: assetId },
      data: { status: AssetStatus.RENTED },
    });
  }

  private async markAsAvailable(
    assetType: AssetType,
    assetId: string,
    tx?: Prisma.TransactionClient,
  ) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const client = (tx ?? this.db) as any;
    const modelKey = this.mapAssetTypeToModel(assetType);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    await client[modelKey].update({
      where: { id: assetId },
      data: { status: AssetStatus.AVAILABLE },
    });
  }

  /**
   * Check for date overlaps to prevent double booking
   * Checks if the requested rental period conflicts with existing ACTIVE or APPROVED rentals
   */
  private async checkDateOverlap(
    assetType: AssetType,
    assetId: string,
    startDate: Date,
    endDate: Date,
    tx: Prisma.TransactionClient,
  ) {
    const whereClause: Prisma.RentalWhereInput = {
      assetType,
      status: {
        in: [RentalStatus.REQUESTED, RentalStatus.APPROVED, RentalStatus.ACTIVE],
      },
      deletedAt: null,
      OR: [
        // New rental starts during existing rental
        {
          rentalStartDate: { lte: startDate },
          rentalEndDate: { gt: startDate },
        },
        // New rental ends during existing rental
        {
          rentalStartDate: { lt: endDate },
          rentalEndDate: { gte: endDate },
        },
        // New rental completely contains existing rental
        {
          rentalStartDate: { gte: startDate },
          rentalEndDate: { lte: endDate },
        },
      ],
    };

    // Add asset-specific filter
    if (assetType === AssetType.COLD_BOX) {
      whereClause.coldBoxId = assetId;
    } else if (assetType === AssetType.COLD_PLATE) {
      whereClause.coldPlateId = assetId;
    } else if (assetType === AssetType.TRICYCLE) {
      whereClause.tricycleId = assetId;
    } else if (assetType === AssetType.COLD_ROOM) {
      // Type assertion needed as coldRoomId might not be in type definition yet
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      (whereClause as any).coldRoomId = assetId;
    }

    const overlappingRentals = await tx.rental.findMany({
      where: whereClause,
      select: {
        id: true,
        rentalStartDate: true,
        rentalEndDate: true,
        status: true,
      },
    });

    if (overlappingRentals.length > 0) {
      const rental = overlappingRentals[0];
      throw new BadRequestException(
        `${assetType} is already booked from ${rental.rentalStartDate.toISOString()} to ${rental.rentalEndDate.toISOString()}. Status: ${rental.status}`,
      );
    }
  }

  async getAvailableAssetsByType(assetType: AssetType, siteId: string) {
    this.logger.log(`Fetching available ${assetType} assets for site: ${siteId}`);

    const modelKey = this.mapAssetTypeToModel(assetType);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
    const model = (this.db as any)[modelKey];
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    const assets = await model.findMany({
      where: {
        siteId,
        status: AssetStatus.AVAILABLE,
        deletedAt: null,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return {
      assetType,
      siteId,
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
      count: assets.length,
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      assets,
    };
  }

  async createRental(userId: string, siteId: string, dto: CreateRentalDto) {
    this.logger.log(`Creating rental request for client: ${userId}`);

    const { start, end } = this.parseAndValidateDates(dto);

    const { assetType, assetId } = this.resolveAsset(dto);

    // Validate capacity requirement for COLD_ROOM rentals
    if (assetType === AssetType.COLD_ROOM) {
      if (!dto.capacityNeededKg || dto.capacityNeededKg <= 0) {
        throw new BadRequestException(
          'capacityNeededKg is required and must be greater than 0 for COLD_ROOM rentals',
        );
      }

      const coldRoom = await this.db.coldRoom.findUnique({
        where: { id: assetId },
        select: { totalCapacityKg: true, usedCapacityKg: true },
      });

      if (!coldRoom) {
        throw new NotFoundException('Cold room not found');
      }

      const availableKg = coldRoom.totalCapacityKg - coldRoom.usedCapacityKg;
      if (dto.capacityNeededKg > availableKg) {
        throw new BadRequestException(
          `Insufficient cold room capacity. Available: ${availableKg}kg, Requested: ${dto.capacityNeededKg}kg`,
        );
      }
    }

    const available = await this.checkAvailability(assetType, assetId, siteId);
    if (!available) throw new BadRequestException(`${assetType} is not available`);

    // Map the resolved assetId to the correct field based on asset type
    const assetIdMapping = {
      coldBoxId: assetType === AssetType.COLD_BOX ? assetId : null,
      coldPlateId: assetType === AssetType.COLD_PLATE ? assetId : null,
      tricycleId: assetType === AssetType.TRICYCLE ? assetId : null,

      coldRoomId: assetType === AssetType.COLD_ROOM ? assetId : null,
    };

    return this.db.rental.create({
      data: {
        clientId: userId,
        siteId,

        assetType,

        ...assetIdMapping,
        rentalStartDate: start,
        rentalEndDate: end,
        estimatedFee: dto.estimatedFee,
        capacityNeededKg: dto.capacityNeededKg,
        status: RentalStatus.REQUESTED,
      },
      include: {
        client: { select: { id: true, firstName: true, lastName: true, email: true } },
        coldBox: true,
        coldPlate: true,
        tricycle: true,

        coldRoom: true,
      },
    });
  }

  async findAllRental(
    siteId: string | undefined,
    userRole?: UserRole,
    userId?: string,
    status?: RentalStatus,
    page?: number,
    limit?: number,
  ) {
    const whereClause: Prisma.RentalWhereInput = {
      deletedAt: null,
      ...this.getRoleBasedFilter(siteId, userRole, userId),
    };
    if (status) whereClause.status = status;

    return paginate(this.db.rental, {
      where: whereClause,
      orderBy: { createdAt: 'desc' },
      page,
      limit,
      include: {
        client: { select: { id: true, firstName: true, lastName: true, email: true } },
        coldBox: true,
        coldPlate: true,
        tricycle: true,
        coldRoom: true,
      },
    });
  }

  async findOneRental(
    rentalId: string,
    siteId: string | undefined,
    userRole?: UserRole,
    userId?: string,
  ) {
    const whereClause: Prisma.RentalWhereInput = {
      id: rentalId,
      deletedAt: null,

      ...this.getRoleBasedFilter(siteId, userRole, userId),
    };

    const rental = await this.db.rental.findFirst({
      where: whereClause,
      include: {
        client: { select: { id: true, firstName: true, lastName: true, email: true, phone: true } },
        coldBox: true,
        coldPlate: true,
        tricycle: true,
        coldRoom: true,
        invoice: true,
      },
    });

    if (!rental) throw new NotFoundException('Rental request not found');
    return rental;
  }

  /**
   * approve rental with pessimistic locking and transactional invoice generation
   * implements proper concurrency control to prevent race conditions
   */
  async approveRental(rentalId: string, siteId: string, userId: string) {
    this.logger.log(`Approving rental: ${rentalId}`);

    return this.db.$transaction(async (tx) => {
      // Fetch and validate rental

      const rental = await tx.rental.findFirst({
        where: { id: rentalId, siteId, deletedAt: null },
        select: {
          id: true,
          status: true,
          assetType: true,
          coldBoxId: true,
          coldPlateId: true,
          tricycleId: true,
          coldRoomId: true,
          capacityNeededKg: true,
          clientId: true,
          estimatedFee: true,
          rentalStartDate: true,
          rentalEndDate: true,
        },
      });

      if (!rental) throw new NotFoundException('Rental request not found');
      if (rental.status !== RentalStatus.REQUESTED) {
        throw new BadRequestException(`Rental must be REQUESTED. Current: ${rental.status}`);
      }

      const { assetType, assetId } = this.getRentalAssetRef(rental);

      // Lock asset and verify availability

      await this.checkAndLockAsset(assetType, assetId, siteId, tx);

      // Check for date overlaps with other rentals for the same asset

      await this.checkDateOverlap(
        assetType,
        assetId,
        rental.rentalStartDate,
        rental.rentalEndDate,
        tx,
      );

      // For COLD_ROOM rentals, verify capacity is still available

      if (assetType === AssetType.COLD_ROOM && rental.capacityNeededKg) {
        const coldRoom = await tx.coldRoom.findUnique({
          where: { id: assetId },
          select: { totalCapacityKg: true, usedCapacityKg: true },
        });

        if (!coldRoom) throw new NotFoundException('Cold room not found');

        const availableKg = coldRoom.totalCapacityKg - coldRoom.usedCapacityKg;

        if (rental.capacityNeededKg > availableKg) {
          throw new BadRequestException(
            `Insufficient cold room capacity. Available: ${availableKg}kg, Requested: ${rental.capacityNeededKg}kg`,
          );
        }
      }

      // Update rental status to APPROVED
      const updated = await tx.rental.updateMany({
        where: { id: rentalId, siteId, deletedAt: null, status: RentalStatus.REQUESTED },
        data: { status: RentalStatus.APPROVED, approvedAt: new Date() },
      });

      if (updated.count !== 1) {
        throw new BadRequestException('Rental was already processed by another user');
      }

      // Generate invoice using InvoicesService (no duplication!)
      await this.invoicesService.generateRentalInvoice(rentalId, undefined, userId, siteId);

      // Audit log
      await tx.auditLog.create({
        data: {
          entityType: 'RENTAL',
          entityId: rentalId,
          action: AuditAction.APPROVE,
          userId,

          details: { rentalId, assetType, assetId },
        },
      });

      // Return complete rental with invoice
      const approvedRental = await tx.rental.findUnique({
        where: { id: rentalId },
        include: {
          client: true,
          coldBox: true,
          coldPlate: true,
          tricycle: true,
          coldRoom: true,
          invoice: true,
        },
      });

      this.logger.log(`Rental ${rentalId} approved and invoice generated`);

      return approvedRental;
    });
  }

  /**
   * Activate rental after payment - marks asset as RENTED and reserves cold room capacity
   */
  async activateRental(rentalId: string, siteId: string, userId: string) {
    this.logger.log(`Activating rental: ${rentalId}`);
    return this.db.$transaction(async (tx) => {
      const rental = await tx.rental.findFirst({
        where: { id: rentalId, siteId, deletedAt: null },
        select: {
          id: true,
          status: true,
          assetType: true,
          coldBoxId: true,
          coldPlateId: true,
          tricycleId: true,
          coldRoomId: true,
          capacityNeededKg: true,
        },
      });

      if (!rental) throw new NotFoundException('Rental request not found');
      if (rental.status !== RentalStatus.APPROVED) {
        throw new BadRequestException(
          `Rental must be APPROVED to activate. Current: ${rental.status}`,
        );
      }

      const invoice = await tx.invoice.findUnique({
        where: { rentalId },
        select: { id: true, status: true },
      });

      if (!invoice) throw new BadRequestException('Cannot activate rental: invoice not found');
      if (invoice.status !== InvoiceStatus.PAID) {
        throw new BadRequestException('Cannot activate rental: invoice is not PAID');
      }

      const { assetType, assetId } = this.getRentalAssetRef(rental);

      // Use pessimistic locking to check asset availability

      await this.checkAndLockAsset(assetType, assetId, siteId, tx);

      // For COLD_ROOM rentals, reserve capacity

      if (assetType === AssetType.COLD_ROOM && rental.capacityNeededKg) {
        const coldRoom = await tx.coldRoom.findUnique({
          where: { id: assetId },
          select: { id: true, totalCapacityKg: true, usedCapacityKg: true },
        });

        if (!coldRoom) throw new NotFoundException('Cold room not found');

        const availableKg = coldRoom.totalCapacityKg - coldRoom.usedCapacityKg;

        if (rental.capacityNeededKg > availableKg) {
          throw new BadRequestException(
            `Insufficient cold room capacity. Available: ${availableKg}kg, Requested: ${rental.capacityNeededKg}kg`,
          );
        }

        // Reserve capacity

        await tx.coldRoom.update({
          where: { id: assetId },

          data: { usedCapacityKg: { increment: rental.capacityNeededKg } },
        });

        this.logger.log(`Reserved ${rental.capacityNeededKg}kg capacity in cold room ${assetId}`);
      }

      const updated = await tx.rental.updateMany({
        where: { id: rentalId, siteId, deletedAt: null, status: RentalStatus.APPROVED },
        data: { status: RentalStatus.ACTIVE },
      });

      if (updated.count !== 1) {
        throw new BadRequestException('Rental was already processed by another user');
      }

      await this.markAsRented(assetType, assetId, tx);

      // audit log
      await tx.auditLog.create({
        data: {
          entityType: 'RENTAL',
          entityId: rentalId,
          action: AuditAction.UPDATE,
          userId,
          details: { rentalId, status: RentalStatus.ACTIVE, invoiceId: invoice.id },
        },
      });

      return tx.rental.findUnique({
        where: { id: rentalId },
        include: {
          client: true,
          coldBox: true,
          coldPlate: true,
          tricycle: true,
          invoice: true,
          coldRoom: true,
        },
      });
    });
  }
  /**
   * complete rental - releases asset and cold room capacity if applicable
   */
  async complete(rentalId: string, siteId: string, userId: string) {
    this.logger.log(`Completing rental: ${rentalId}`);
    return this.db.$transaction(async (tx) => {
      const rental = await tx.rental.findFirst({
        where: { id: rentalId, siteId, deletedAt: null },
        select: {
          id: true,
          status: true,
          assetType: true,
          coldBoxId: true,
          coldPlateId: true,
          tricycleId: true,
          coldRoomId: true,
          capacityNeededKg: true,
        },
      });

      if (!rental) throw new NotFoundException('Rental request not found');

      if (rental.status !== RentalStatus.ACTIVE) {
        throw new BadRequestException(
          `Cannot complete rental with status: ${rental.status}. Only ACTIVE rentals can be completed`,
        );
      }

      const { assetType, assetId } = this.getRentalAssetRef(rental);

      // Release cold room capacity if applicable

      if (assetType === AssetType.COLD_ROOM && rental.capacityNeededKg) {
        await tx.coldRoom.update({
          where: { id: assetId },

          data: { usedCapacityKg: { decrement: rental.capacityNeededKg } },
        });

        this.logger.log(`Released ${rental.capacityNeededKg}kg capacity from cold room ${assetId}`);
      }

      const completedRental = await tx.rental.update({
        where: { id: rentalId },
        data: { status: RentalStatus.COMPLETED, completedAt: new Date() },
      });

      await this.markAsAvailable(assetType, assetId, tx);

      // audit log
      await tx.auditLog.create({
        data: {
          entityType: 'RENTAL',
          entityId: rentalId,
          action: AuditAction.UPDATE,
          userId,
          details: { rentalId, status: RentalStatus.COMPLETED },
        },
      });

      return completedRental;
    });
  }

  /**
   * Cancel a rental request
   */
  async cancelRental(rentalId: string, siteId: string, userId: string, userRole: UserRole) {
    this.logger.log(`Cancelling rental: ${rentalId}`);

    return this.db.$transaction(async (tx) => {
      const rental = await tx.rental.findFirst({
        where: { id: rentalId, siteId, deletedAt: null },
        select: {
          id: true,
          status: true,
          clientId: true,
          assetType: true,
        },
      });

      if (!rental) throw new NotFoundException('Rental request not found');

      if (userRole === UserRole.CLIENT && rental.clientId !== userId) {
        throw new BadRequestException('You can only cancel your own rentals');
      }

      // Can only cancel if not yet ACTIVE

      if (rental.status === RentalStatus.ACTIVE || rental.status === RentalStatus.COMPLETED) {
        throw new BadRequestException(`Cannot cancel rental with status: ${rental.status}`);
      }

      if (rental.status === RentalStatus.CANCELLED) {
        throw new BadRequestException('Rental is already cancelled');
      }

      const cancelled = await tx.rental.update({
        where: { id: rentalId },
        data: { status: RentalStatus.CANCELLED, deletedAt: new Date() },
      });

      // void invoice
      const invoice = await tx.invoice.findUnique({
        where: { rentalId },
      });

      if (invoice && invoice.status === InvoiceStatus.UNPAID) {
        await tx.invoice.update({
          where: { id: invoice.id },
          data: { status: InvoiceStatus.VOID },
        });
      }

      // audit log
      await tx.auditLog.create({
        data: {
          entityType: 'RENTAL',
          entityId: rentalId,
          action: AuditAction.UPDATE,
          userId,
          details: { rentalId, status: RentalStatus.CANCELLED, cancelledBy: userId },
        },
      });

      this.logger.log(`Rental ${rentalId} cancelled by user ${userId}`);
      return cancelled;
    });
  }

  /**
   * Initialize auto-activation polling for rentals
   * Automatically activates paid rentals every 60 seconds
   */
  onModuleInit() {
    this.logger.log('Starting auto-activation polling for rentals...');
    // Poll every 60 seconds
    this.activationInterval = setInterval(() => {
      void this.autoActivateRentals();
    }, 60000);
  }

  onModuleDestroy() {
    if (this.activationInterval) {
      clearInterval(this.activationInterval);
    }
  }

  /**
   * automatically activate rentals that have been paid
   * called from payment webhook
   */
  async autoActivateRentals() {
    try {
      this.logger.debug('Checking for paid rentals to activate...');

      // APPROVED rentals that have a PAID invoice
      const paidRentals = await this.db.rental.findMany({
        where: {
          status: RentalStatus.APPROVED,
          invoice: {
            status: InvoiceStatus.PAID,
          },
          deletedAt: null,
        },
        select: {
          id: true,
          siteId: true,
          clientId: true,
        },
      });

      if (paidRentals.length > 0) {
        this.logger.log(`Found ${paidRentals.length} paid rentals to activate`);
      }

      for (const rental of paidRentals) {
        try {
          await this.activateRental(rental.id, rental.siteId, 'SYSTEM');
          this.logger.log(`Auto-activated rental ${rental.id}`);
        } catch (error) {
          this.logger.error(`Failed to auto-activate rental ${rental.id}`, error);
          //  to next rental even if one fails
        }
      }
    } catch (error) {
      this.logger.error('Error in autoActivateRentals polling', error);
    }
  }
}
