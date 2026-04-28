import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { InvoiceStatus, AuditAction } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { InsufficientDataException, InvoiceAlreadyExistsException } from './exceptions';
import { InvoiceResponseDto, QueryInvoicesDto } from './dto';
import { INVOICE_CONFIG } from './constants/invoice.constants';

@Injectable()
export class InvoicesService {
  private readonly logger = new Logger(InvoicesService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * generate invoice for an approved order
   * uses database transaction to ensure data consistency
   */
  async generateOrderInvoice(
    orderId: string,
    dueDate?: Date,
    userId?: string,
    userSiteId?: string,
  ): Promise<InvoiceResponseDto> {
    this.logger.log(`Generating invoice for order: ${orderId}`);

    return await this.prisma.$transaction(async (tx) => {
      const existingInvoice = await tx.invoice.findFirst({
        where: { orderId },
      });

      if (existingInvoice) {
        throw new InvoiceAlreadyExistsException('order', orderId);
      }

      const order = await tx.order.findUnique({
        where: { id: orderId },
        include: {
          items: {
            include: {
              product: true,
            },
          },
          client: true,
          site: true,
        },
      });

      if (!order) {
        throw new NotFoundException(`Order with ID ${orderId} not found`);
      }

      // Enforce site scoping for non-SUPER_ADMIN users
      if (userSiteId && order.siteId !== userSiteId) {
        throw new NotFoundException(`Order with ID ${orderId} not found`);
      }

      if (order.deletedAt) {
        throw new InsufficientDataException(
          `Order ${orderId} has been deleted and cannot generate invoice`,
        );
      }

      if (order.status !== 'APPROVED') {
        throw new InsufficientDataException(
          `Order must be APPROVED before generating invoice. Current status: ${order.status}`,
        );
      }

      if (!order.items || order.items.length === 0) {
        throw new InsufficientDataException(
          `Order ${orderId} has no items. Cannot generate invoice.`,
        );
      }

      const invoiceNumber = await this.generateInvoiceNumberSafe(order.siteId, tx);

      const invoiceDueDate =
        dueDate || new Date(Date.now() + INVOICE_CONFIG.DEFAULT_DUE_DAYS * 24 * 60 * 60 * 1000);

      const invoiceItems = order.items.map((item) => ({
        description: item.product.name,
        quantity: item.quantityKg,
        unit: item.product.unit,
        unitPrice: item.unitPrice,
        subtotal: item.subtotal,
      }));

      const subtotal = order.totalAmount;
      const taxAmount = this.calculateTax(subtotal);
      const totalAmount = subtotal + taxAmount;

      const invoice = await tx.invoice.create({
        data: {
          invoiceNumber,
          orderId: order.id,
          clientId: order.clientId,
          siteId: order.siteId,
          subtotal,
          taxAmount,
          totalAmount,
          paidAmount: 0,
          status: InvoiceStatus.UNPAID,
          dueDate: invoiceDueDate,
          items: {
            create: invoiceItems,
          },
        },
        include: {
          items: true,
        },
      });

      if (userId) {
        await tx.auditLog.create({
          data: {
            entityType: 'INVOICE',
            entityId: invoice.id,
            action: AuditAction.CREATE,
            userId,
            details: {
              invoiceNumber: invoice.invoiceNumber,
              orderId: order.id,
              totalAmount: invoice.totalAmount,
              generatedFrom: 'ORDER',
            },
          },
        });
      }

      this.logger.log(`Invoice ${invoice.invoiceNumber} generated for order ${orderId}`);

      return this.mapToResponseDto(invoice);
    });
  }

  /**
   * generate invoice for an approved rental use database transaction
   */
  async generateRentalInvoice(
    rentalId: string,
    dueDate?: Date,
    userId?: string,
    userSiteId?: string,
  ): Promise<InvoiceResponseDto> {
    this.logger.log(`Generating invoice for rental: ${rentalId}`);

    return await this.prisma.$transaction(async (tx) => {
      const existingInvoice = await tx.invoice.findFirst({
        where: { rentalId },
      });

      if (existingInvoice) {
        throw new InvoiceAlreadyExistsException('rental', rentalId);
      }

      const rental = await tx.rental.findUnique({
        where: { id: rentalId },
        include: {
          client: true,
          site: true,
          coldBox: true,
          coldPlate: true,
          tricycle: true,
        },
      });

      if (!rental) {
        throw new NotFoundException(`Rental with ID ${rentalId} not found`);
      }

      // Enforce site scoping for non-SUPER_ADMIN users
      if (userSiteId && rental.siteId !== userSiteId) {
        throw new NotFoundException(`Rental with ID ${rentalId} not found`);
      }

      if (rental.deletedAt) {
        throw new InsufficientDataException(
          `Rental ${rentalId} has been deleted and cannot generate invoice`,
        );
      }

      if (rental.status !== 'APPROVED' && rental.status !== 'ACTIVE') {
        throw new InsufficientDataException(
          `Rental must be APPROVED or ACTIVE before generating invoice. Current status: ${rental.status}`,
        );
      }

      const invoiceNumber = await this.generateInvoiceNumberSafe(rental.siteId, tx);

      const invoiceDueDate =
        dueDate || new Date(Date.now() + INVOICE_CONFIG.DEFAULT_DUE_DAYS * 24 * 60 * 60 * 1000);

      // asset details
      let assetDescription = '';
      if (rental.coldBoxId) {
        assetDescription = `Cold Box Rental - ${rental.coldBox?.identificationNumber || 'N/A'}`;
      } else if (rental.coldPlateId) {
        assetDescription = `Cold Plate Rental - ${rental.coldPlate?.identificationNumber || 'N/A'}`;
      } else if (rental.tricycleId) {
        assetDescription = `Tricycle Rental - ${rental.tricycle?.plateNumber || 'N/A'}`;
      } else {
        throw new InsufficientDataException(`Rental ${rentalId} has no associated asset`);
      }

      const startDate = new Date(rental.rentalStartDate);
      const endDate = new Date(rental.rentalEndDate);
      const durationDays = Math.ceil(
        (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24),
      );

      if (durationDays <= 0) {
        throw new InsufficientDataException(
          `Invalid rental duration: End date must be after start date`,
        );
      }

      const rentalFee = rental.actualFee || rental.estimatedFee;

      // invoice items
      const invoiceItems = [
        {
          description: assetDescription,
          quantity: durationDays,
          unit: 'days',
          unitPrice: rentalFee / durationDays,
          subtotal: rentalFee,
        },
      ];

      // totals
      const subtotal = rentalFee;
      const taxAmount = this.calculateTax(subtotal);
      const totalAmount = subtotal + taxAmount;

      const invoice = await tx.invoice.create({
        data: {
          invoiceNumber,
          rentalId: rental.id,
          clientId: rental.clientId,
          siteId: rental.siteId,
          subtotal,
          taxAmount,
          totalAmount,
          paidAmount: 0,
          status: InvoiceStatus.UNPAID,
          dueDate: invoiceDueDate,
          items: {
            create: invoiceItems,
          },
        },
        include: {
          items: true,
        },
      });

      //  audit log
      if (userId) {
        await tx.auditLog.create({
          data: {
            entityType: 'INVOICE',
            entityId: invoice.id,
            action: AuditAction.CREATE,
            userId,
            details: {
              invoiceNumber: invoice.invoiceNumber,
              rentalId: rental.id,
              totalAmount: invoice.totalAmount,
              generatedFrom: 'RENTAL',
              assetType: rental.assetType,
              durationDays,
            },
          },
        });
      }

      this.logger.log(`Invoice ${invoice.invoiceNumber} generated for rental ${rentalId}`);

      return this.mapToResponseDto(invoice);
    });
  }

  /**
   * get invoice by ID with site scoping
   */
  async findOne(
    id: string,
    userSiteId?: string,
    userClientId?: string,
  ): Promise<InvoiceResponseDto> {
    interface WhereClause {
      id: string;
      deletedAt: null;
      siteId?: string;
      clientId?: string;
    }

    const where: WhereClause = { id, deletedAt: null };

    if (userSiteId) {
      where.siteId = userSiteId;
    }

    if (userClientId) {
      where.clientId = userClientId;
    }

    const invoice = await this.prisma.invoice.findFirst({
      where,
      include: {
        items: true,
      },
    });

    if (!invoice) {
      throw new NotFoundException(`Invoice with ID ${id} not found`);
    }

    return this.mapToResponseDto(invoice);
  }

  /**
   * get invoice by invoice number with site scoping
   */
  async findByInvoiceNumber(
    invoiceNumber: string,
    userSiteId?: string,
  ): Promise<InvoiceResponseDto> {
    const invoice = await this.prisma.invoice.findUnique({
      where: { invoiceNumber },
      include: {
        items: true,
      },
    });

    if (!invoice || invoice.deletedAt) {
      throw new NotFoundException(`Invoice with number ${invoiceNumber} not found`);
    }

    // site scop check
    if (userSiteId && invoice.siteId !== userSiteId) {
      throw new NotFoundException(`Invoice with number ${invoiceNumber} not found`);
    }

    return this.mapToResponseDto(invoice);
  }

  /**
   * query invoices with filters and pagination
   */
  async findAll(query: QueryInvoicesDto, siteId?: string, clientId?: string) {
    const {
      status,
      clientId: queryClientId,
      siteId: querySiteId,
      startDate,
      endDate,
      page = 1,
      limit = INVOICE_CONFIG.DEFAULT_PAGE_LIMIT,
    } = query;

    interface WhereClause {
      status?: InvoiceStatus;
      clientId?: string;
      siteId?: string;
      deletedAt: null;
      createdAt?: {
        gte?: Date;
        lte?: Date;
      };
    }

    const where: WhereClause = {
      deletedAt: null,
    };

    if (status) {
      where.status = status;
    }

    // Role-based client scoping - override query params if user is a CLIENT
    if (clientId) {
      where.clientId = clientId;
    } else if (queryClientId) {
      where.clientId = queryClientId;
    }

    if (siteId) {
      where.siteId = siteId;
    } else if (querySiteId) {
      where.siteId = querySiteId;
    }

    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) {
        where.createdAt.gte = new Date(startDate);
      }
      if (endDate) {
        where.createdAt.lte = new Date(endDate);
      }
    }

    // limit doesn't exceed max
    const safeLimit = Math.min(limit, INVOICE_CONFIG.MAX_PAGE_LIMIT);
    const skip = (page - 1) * safeLimit;

    const [invoices, total] = await Promise.all([
      this.prisma.invoice.findMany({
        where,
        include: {
          items: true,
        },
        skip,
        take: safeLimit,
        orderBy: {
          createdAt: 'desc',
        },
      }),
      this.prisma.invoice.count({ where }),
    ]);

    return {
      data: invoices.map((invoice) => this.mapToResponseDto(invoice)),
      meta: {
        total,
        page,
        limit: safeLimit,
        totalPages: Math.ceil(total / safeLimit),
      },
    };
  }

  /**
   * generate unique invoice number
   * transaction-safe version with row locking to prevent race conditions
   */
  private async generateInvoiceNumberSafe(
    siteId: string,

    tx?: any,
  ): Promise<string> {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const prismaClient = tx || this.prisma;

    // lock site row to prevent concurrent invoice number generation
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    const [site] = await prismaClient.$queryRaw`
      SELECT * FROM sites WHERE id = ${siteId}::uuid FOR UPDATE
    `;

    if (!site) {
      throw new NotFoundException(`Site with ID ${siteId} not found`);
    }

    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    const siteName = site.name.toUpperCase().replace(/\s+/g, '_');

    const year = new Date().getFullYear();

    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    const lastInvoice = await prismaClient.invoice.findFirst({
      where: {
        siteId,
        invoiceNumber: {
          startsWith: `INV-${siteName}-${year}-`,
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    let sequence = 1;

    if (lastInvoice) {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
      const parts = lastInvoice.invoiceNumber.split('-');
      // eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-member-access
      const lastSequence = parseInt(parts[parts.length - 1], 10);
      sequence = lastSequence + 1;
    }

    const sequenceStr = sequence.toString().padStart(INVOICE_CONFIG.INVOICE_NUMBER_LENGTH, '0');

    return `INV-${siteName}-${year}-${sequenceStr}`;
  }

  /**
   * mark invoice as paid
   * updates paidAmount and status atomically
   */
  async markPaid(
    invoiceId: string,
    paymentAmount: number,
    userId: string,
    userSiteId?: string,
  ): Promise<InvoiceResponseDto> {
    this.logger.log(`Marking invoice ${invoiceId} as paid: ${paymentAmount}`);

    return await this.prisma.$transaction(async (tx) => {
      const invoice = await tx.invoice.findUnique({
        where: { id: invoiceId },
        include: { items: true },
      });

      if (!invoice) {
        throw new NotFoundException(`Invoice with ID ${invoiceId} not found`);
      }

      // Enforce site scoping for non-SUPER_ADMIN users
      if (userSiteId && invoice.siteId !== userSiteId) {
        throw new NotFoundException(`Invoice with ID ${invoiceId} not found`);
      }

      if (invoice.status === InvoiceStatus.VOID) {
        throw new InsufficientDataException('Cannot mark voided invoice as paid');
      }

      const newPaidAmount = invoice.paidAmount + paymentAmount;
      const newStatus =
        newPaidAmount >= invoice.totalAmount ? InvoiceStatus.PAID : InvoiceStatus.UNPAID;

      const updatedInvoice = await tx.invoice.update({
        where: { id: invoiceId },
        data: {
          paidAmount: newPaidAmount,
          status: newStatus,
        },
        include: { items: true },
      });

      await tx.auditLog.create({
        data: {
          entityType: 'INVOICE',
          entityId: invoiceId,
          action: AuditAction.PAYMENT_RECEIVED,
          userId,
          details: {
            paymentAmount,
            paidAmount: newPaidAmount,
            totalAmount: invoice.totalAmount,
            newStatus,
          },
        },
      });

      this.logger.log(
        `Invoice ${invoice.invoiceNumber} marked as ${newStatus}. ` +
          `Paid: ${newPaidAmount}/${invoice.totalAmount}`,
      );

      return this.mapToResponseDto(updatedInvoice);
    });
  }

  /**
   * void an invoice (cannot be undone)
   * only unpaid invoices can be voided
   */
  async voidInvoice(
    invoiceId: string,
    reason: string,
    userId: string,
    userSiteId?: string,
  ): Promise<void> {
    this.logger.log(`Voiding invoice ${invoiceId}: ${reason}`);

    await this.prisma.$transaction(async (tx) => {
      const invoice = await tx.invoice.findUnique({
        where: { id: invoiceId },
      });

      if (!invoice) {
        throw new NotFoundException(`Invoice with ID ${invoiceId} not found`);
      }

      // enforce site scoping for non-SUPER_ADMIN users
      if (userSiteId && invoice.siteId !== userSiteId) {
        throw new NotFoundException(`Invoice with ID ${invoiceId} not found`);
      }

      if (invoice.status === InvoiceStatus.PAID) {
        throw new InsufficientDataException('Cannot void paid invoice. Issue refund instead.');
      }

      if (invoice.status === InvoiceStatus.VOID) {
        throw new InsufficientDataException('Invoice is already voided');
      }

      await tx.invoice.update({
        where: { id: invoiceId },
        data: { status: InvoiceStatus.VOID },
      });

      await tx.auditLog.create({
        data: {
          entityType: 'INVOICE',
          entityId: invoiceId,
          action: AuditAction.UPDATE,
          userId,
          details: {
            action: 'VOID',
            reason,
            invoiceNumber: invoice.invoiceNumber,
          },
        },
      });

      this.logger.log(`Invoice ${invoice.invoiceNumber} voided: ${reason}`);
    });
  }

  /**
   * calculate tax amount
   * centralized tax calculation for consistency
   */
  private calculateTax(subtotal: number): number {
    return subtotal * INVOICE_CONFIG.TAX_RATE;
  }

  /**
   * map prisma invoice to response DTO
   */
  private mapToResponseDto(invoice: {
    id: string;
    invoiceNumber: string;
    orderId: string | null;
    rentalId: string | null;
    clientId: string;
    siteId: string;
    subtotal: number;
    taxAmount: number;
    totalAmount: number;
    paidAmount: number;
    status: InvoiceStatus;
    dueDate: Date;
    createdAt: Date;
    updatedAt: Date;
    items?: Array<{
      id: string;
      description: string;
      quantity: number;
      unit: string;
      unitPrice: number;
      subtotal: number;
    }>;
  }): InvoiceResponseDto {
    return {
      id: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      orderId: invoice.orderId,
      rentalId: invoice.rentalId,
      clientId: invoice.clientId,
      siteId: invoice.siteId,
      subtotal: invoice.subtotal,
      taxAmount: invoice.taxAmount,
      totalAmount: invoice.totalAmount,
      paidAmount: invoice.paidAmount,
      status: invoice.status,
      dueDate: invoice.dueDate,
      items: invoice.items || [],
      createdAt: invoice.createdAt,
      updatedAt: invoice.updatedAt,
    };
  }
}
