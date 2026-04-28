import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { InvoicesService } from '../invoices/invoices.service';
import { PaymentStatus, PaymentMethod, AuditAction, InvoiceStatus } from '@prisma/client';
import { MtnMomoService } from './services/mtn-momo.service';

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly invoicesService: InvoicesService,
    private readonly mtnMomoService: MtnMomoService,
  ) {}

  /**
   * initiate payment
   */
  async initiatePayment(
    invoiceId: string,
    phoneNumber: string,
    userId?: string,
    userRole?: string,
    userSiteId?: string,
  ) {
    this.logger.log(`Initiating payment for invoice: ${invoiceId}`);

    const invoice = await this.invoicesService.findOne(invoiceId);

    if (!invoice) {
      throw new NotFoundException(`Invoice ${invoiceId} not found`);
    }

    // CLIENT can only pay their own invoices, SITE_MANAGER only their site
    if (userRole === 'CLIENT' && invoice.clientId !== userId) {
      throw new NotFoundException(`Invoice ${invoiceId} not found`);
    }

    if (userRole === 'SITE_MANAGER' && userSiteId && invoice.siteId !== userSiteId) {
      throw new NotFoundException(`Invoice ${invoiceId} not found`);
    }

    if (invoice.status === InvoiceStatus.PAID) {
      throw new BadRequestException('Invoice is already paid');
    }

    if (invoice.status === InvoiceStatus.VOID) {
      throw new BadRequestException('Cannot pay voided invoice');
    }

    const amountDue = invoice.totalAmount - invoice.paidAmount;

    if (amountDue <= 0) {
      throw new BadRequestException('Invoice has no outstanding balance');
    }

    if (!this.mtnMomoService.isConfigured()) {
      throw new BadRequestException(
        'MTN MoMo payment is not configured. Please contact administrator or use manual payment.',
      );
    }

    try {
      const momoTransactionRef = await this.mtnMomoService.requestToPay(
        amountDue,
        phoneNumber,
        invoice.invoiceNumber,
        `Payment for invoice ${invoice.invoiceNumber}`,
        `MoFresh invoice payment - ${invoice.invoiceNumber}`,
      );

      const payment = await this.prisma.payment.create({
        data: {
          invoiceId,
          amount: amountDue,
          paymentMethod: PaymentMethod.MOBILE_MONEY,
          status: PaymentStatus.PENDING,
          phoneNumber,
          momoTransactionRef,
        },
      });

      if (userId) {
        await this.prisma.auditLog.create({
          data: {
            entityType: 'PAYMENT',
            entityId: payment.id,
            action: AuditAction.CREATE,
            userId,
            details: {
              invoiceId,
              invoiceNumber: invoice.invoiceNumber,
              amount: amountDue,
              phoneNumber,
              momoTransactionRef,
              paymentMethod: 'MOBILE_MONEY',
            },
          },
        });
      }

      this.logger.log(
        `MTN MoMo payment initiated. Payment ID: ${payment.id}, MoMo Ref: ${momoTransactionRef}`,
      );

      return {
        paymentId: payment.id,
        momoTransactionRef,
        amount: payment.amount,
        phoneNumber: payment.phoneNumber,
        status: payment.status,
        message: 'Payment request sent to your phone. Please approve to complete payment.',
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.logger.error(`Failed to initiate MTN MoMo payment: ${errorMessage}`, errorStack);
      throw error;
    }
  }

  /**
   * momo webhook callback
   */
  async processWebhook(webhookData: {
    transactionRef: string;
    status: string;
    amount?: number;
    reason?: string;
  }) {
    this.logger.log(`Processing MTN MoMo webhook for transaction: ${webhookData.transactionRef}`);

    const existingPayment = await this.prisma.payment.findUnique({
      where: { momoTransactionRef: webhookData.transactionRef },
      include: { invoice: true },
    });

    if (!existingPayment) {
      this.logger.warn(`Received webhook for unknown transaction: ${webhookData.transactionRef}`);
      return {
        message: 'Transaction not found',
        processed: false,
      };
    }

    if (existingPayment.status === PaymentStatus.PAID) {
      this.logger.warn(
        `Duplicate webhook received for already paid transaction: ${webhookData.transactionRef}`,
      );
      return {
        message: 'Payment already processed',
        processed: true,
        paymentId: existingPayment.id,
        idempotent: true,
      };
    }

    if (webhookData.status === 'SUCCESSFUL' || webhookData.status === 'PAID') {
      return await this.reconcilePayment(
        existingPayment.id,
        webhookData.transactionRef,
        existingPayment.amount,
      );
    }

    if (webhookData.status === 'FAILED') {
      await this.prisma.payment.update({
        where: { id: existingPayment.id },
        data: {
          status: PaymentStatus.FAILED,
          notes: webhookData.reason || 'Payment failed',
        },
      });

      this.logger.log(
        `Payment ${existingPayment.id} marked as FAILED. Reason: ${webhookData.reason || 'Unknown'}`,
      );

      return {
        message: 'Payment marked as failed',
        processed: true,
        paymentId: existingPayment.id,
        status: 'FAILED',
      };
    }

    this.logger.warn(`Unknown webhook status: ${webhookData.status}`);
    return {
      message: 'Unknown status',
      processed: false,
    };
  }

  /**
   * reconcile payment
   */
  private async reconcilePayment(paymentId: string, momoTransactionRef: string, amount: number) {
    this.logger.log(`Reconciling payment ${paymentId}`);

    return await this.prisma.$transaction(async (tx) => {
      const payment = await tx.payment.findUnique({
        where: { id: paymentId },
      });

      if (!payment) {
        throw new NotFoundException(`Payment ${paymentId} not found`);
      }

      if (payment.status === PaymentStatus.PAID) {
        this.logger.warn(`Payment ${paymentId} already reconciled (idempotency)`);
        return {
          message: 'Payment already reconciled',
          processed: true,
          paymentId: payment.id,
          idempotent: true,
        };
      }

      const updatedPayment = await tx.payment.update({
        where: { id: paymentId },
        data: {
          status: PaymentStatus.PAID,
          paidAt: new Date(),
        },
      });

      const updatedInvoice = await tx.invoice.findUnique({
        where: { id: payment.invoiceId },
      });

      if (!updatedInvoice) {
        throw new NotFoundException(`Invoice ${payment.invoiceId} not found`);
      }

      const newPaidAmount = updatedInvoice.paidAmount + amount;
      const newStatus =
        newPaidAmount >= updatedInvoice.totalAmount ? InvoiceStatus.PAID : InvoiceStatus.UNPAID;

      await tx.invoice.update({
        where: { id: payment.invoiceId },
        data: {
          paidAmount: newPaidAmount,
          status: newStatus,
        },
      });

      await tx.auditLog.create({
        data: {
          entityType: 'PAYMENT',
          entityId: paymentId,
          action: AuditAction.PAYMENT_RECEIVED,
          userId: 'SYSTEM',
          details: {
            momoTransactionRef,
            amount,
            invoiceId: payment.invoiceId,
            invoiceNumber: updatedInvoice.invoiceNumber,
            newInvoiceStatus: newStatus,
            source: 'MTN_MOMO_WEBHOOK',
          },
        },
      });

      this.logger.log(
        `Payment ${paymentId} reconciled successfully. Invoice ${updatedInvoice.invoiceNumber} status: ${newStatus}`,
      );

      return {
        message: 'Payment reconciled successfully',
        processed: true,
        paymentId: updatedPayment.id,
        invoiceStatus: newStatus,
        idempotent: false,
      };
    });
  }

  /**
   * mark payment as paid manually
   */
  async markPaidManually(paymentId: string, userId: string, userSiteId?: string) {
    this.logger.log(`Manually marking payment ${paymentId} as paid`);

    const payment = await this.prisma.payment.findUnique({
      where: { id: paymentId },
      include: { invoice: true },
    });

    if (!payment) {
      throw new NotFoundException(`Payment ${paymentId} not found`);
    }

    // site scoping for non-SUPER_ADMIN users
    if (userSiteId && payment.invoice.siteId !== userSiteId) {
      throw new NotFoundException(`Payment ${paymentId} not found`);
    }

    if (payment.status === PaymentStatus.PAID) {
      throw new BadRequestException('Payment is already marked as paid');
    }

    // update payment status
    const updatedPayment = await this.prisma.payment.update({
      where: { id: paymentId },
      data: {
        status: PaymentStatus.PAID,
        paidAt: new Date(),
        markedPaidBy: userId,
      },
    });

    // mark invoice as paid
    await this.invoicesService.markPaid(payment.invoiceId, payment.amount, userId, userSiteId);

    return updatedPayment;
  }

  /**
   * get payment by ID with user scoping
   */
  async findOne(id: string, userId?: string, userRole?: string, userSiteId?: string) {
    const payment = await this.prisma.payment.findUnique({
      where: { id },
      include: {
        invoice: true,
      },
    });

    if (!payment) {
      throw new NotFoundException(`Payment ${id} not found`);
    }

    // role-based access control
    if (userId && userRole) {
      const invoice = payment.invoice;

      if (userRole === 'CLIENT' && invoice.clientId !== userId) {
        throw new NotFoundException(`Payment ${id} not found`);
      }

      if (userRole === 'SITE_MANAGER') {
        if (!userSiteId) {
          throw new BadRequestException('Site manager must have a valid site assignment');
        }
        if (invoice.siteId !== userSiteId) {
          throw new NotFoundException(`Payment ${id} not found`);
        }
      }
    }

    return payment;
  }

  /**
   * list all payments with filters
   */
  async findAll(filters?: { invoiceId?: string; status?: PaymentStatus }) {
    interface WhereClause {
      invoiceId?: string;
      status?: PaymentStatus;
    }

    const where: WhereClause = {};

    if (filters?.invoiceId) {
      where.invoiceId = filters.invoiceId;
    }

    if (filters?.status) {
      where.status = filters.status;
    }

    return this.prisma.payment.findMany({
      where,
      include: {
        invoice: {
          select: {
            invoiceNumber: true,
            totalAmount: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }
}
