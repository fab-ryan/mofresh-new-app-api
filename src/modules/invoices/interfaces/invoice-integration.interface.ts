import { InvoiceResponseDto } from '../dto';

/**
 * Invoice Service Integration Interface
 *
 * This interface defines the contract for Order and Rental modules to integrate
 * with the Invoice generation system. All invoice generation must follow these
 * specifications to ensure proper financial tracking and payment processing.
 *
 * @module InvoicesModule
 */

/**
 * IInvoiceService - Public interface for invoice generation
 *
 * IMPORTANT: Invoice generation is a CRITICAL financial operation.
 * All consumers MUST ensure data integrity before calling these methods.
 */
export interface IInvoiceService {
  /**
   * Generate invoice for an APPROVED order
   *
   * CRITICAL REQUIREMENTS:
   *
   * 1. WHEN TO CALL:
   *    - ONLY after Order.status = 'APPROVED'
   *    - ONLY after stock has been successfully reserved
   *    - ONLY after all order items are validated
   *    - ONLY after Order.approvedBy is set
   *    - ONLY after Order.approvedAt is set
   *
   * 2. TRANSACTION ORDERING:
   *    OrdersModule MUST execute operations in this EXACT order:
   *
   *    Step 1: Validate order data
   *    Step 2: Reserve stock (call StockMovementsService)
   *    Step 3: Update order status to APPROVED
   *    Step 4: Call this method to generate invoice
   *    Step 5: Update order status to INVOICED (if needed)
   *
   * 3. ERROR HANDLING:
   *    - If invoice generation fails, rollback stock reservation
   *    - Use database transactions to ensure atomicity
   *    - Do NOT approve order if invoice cannot be generated
   *
   * 4. INVOICE NUMBER FORMAT:
   *    - Format: INV-{SITE_NAME}-{YEAR}-{SEQUENCE}
   *    - Example: INV-MOFRESH_KIGALI-2026-00001
   *    - Auto-incremented per site per year
   *    - Thread-safe with pessimistic locking
   *
   * 5. TAX CALCULATION:
   *    - Tax rate: 18% VAT (Rwanda standard)
   *    - Calculated on subtotal (sum of all order items)
   *    - Total = Subtotal + Tax
   *
   * 6. DUE DATE:
   *    - Default: 7 days from invoice generation
   *    - Can be overridden by passing custom dueDate
   *    - Format: ISO 8601 date string
   *
   * @param orderId - UUID of the APPROVED order
   * @param dueDate - Optional custom due date (defaults to +7 days)
   * @param userId - UUID of user approving order (for audit trail)
   *
   * @returns Promise<InvoiceResponseDto> - Generated invoice with items
   *
   * @throws {NotFoundException} - Order not found
   * @throws {InsufficientDataException} - Order not approved or has no items
   * @throws {InvoiceAlreadyExistsException} - Invoice already exists for this order
   *
   * @example
   * ```typescript
   * // In OrdersService.approveOrder() method:
   *
   * async approveOrder(orderId: string, userId: string) {
   *   return await this.prisma.$transaction(async (tx) => {
   *     // Step 1: Validate order
   *     const order = await tx.order.findUnique({
   *       where: { id: orderId },
   *       include: { items: true }
   *     });
   *
   *     if (!order) throw new NotFoundException('Order not found');
   *     if (order.items.length === 0) throw new BadRequestException('Order has no items');
   *
   *     // Step 2: Reserve stock for each item
   *     for (const item of order.items) {
   *       await this.stockMovementsService.reserveStock({
   *         productId: item.productId,
   *         quantityKg: item.quantityKg,
   *         orderId: order.id,
   *         userId
   *       });
   *     }
   *
   *     // Step 3: Update order status to APPROVED
   *     const approvedOrder = await tx.order.update({
   *       where: { id: orderId },
   *       data: {
   *         status: 'APPROVED',
   *         approvedBy: userId,
   *         approvedAt: new Date()
   *       }
   *     });
   *
   *     // step 4: Generate invoice
   *     const invoice = await this.invoicesService.generateOrderInvoice(
   *       orderId,
   *       undefined, // Use default due date (7 days)
   *       userId
   *     );
   *
   *     // step 5: Update order status to INVOICED
   *     await tx.order.update({
   *       where: { id: orderId },
   *       data: { status: 'INVOICED' }
   *     });
   *
   *     return { order: approvedOrder, invoice };
   *   });
   * }
   * ```
   */
  generateOrderInvoice(
    orderId: string,
    dueDate?: Date,
    userId?: string,
  ): Promise<InvoiceResponseDto>;

  /**
   * Generate invoice for an APPROVED or ACTIVE rental
   *
   * ⚠️  CRITICAL REQUIREMENTS:
   *
   * 1. WHEN TO CALL:
   *    - ONLY after Rental.status = 'APPROVED' OR 'ACTIVE'
   *    - ONLY after asset status updated to 'RENTED'
   *    - ONLY after rental dates are validated
   *    - ONLY after rental fee is calculated
   *
   * 2. TRANSACTION ORDERING:
   *    RentalsModule MUST execute operations in this EXACT order:
   *
   *    step 1: Validate rental data
   *    step 2: Update asset status to RENTED
   *    step 3: Update rental status to APPROVED
   *    step 4: Call this method to generate invoice
   *    step 5: Update rental status to ACTIVE (if needed)
   *
   * 3. RENTAL FEE CALCULATION:
   *    - Use Rental.actualFee if set
   *    - Otherwise use Rental.estimatedFee
   *    - Fee should be calculated based on:
   *      * Asset type (cold box, cold plate, tricycle)
   *      * Duration (rentalEndDate - rentalStartDate)
   *      * Base rate per day/asset
   *
   * 4. INVOICE ITEMS:
   *    - Description: "{Asset Type} Rental - {Asset ID/Plate Number}"
   *    - Quantity: Number of days
   *    - Unit: "days"
   *    - Unit Price: totalFee / numberOfDays
   *    - Subtotal: totalFee
   *
   * 5. ASSET TYPES:
   *    - COLD_BOX: Use coldBox.identificationNumber
   *    - COLD_PLATE: Use coldPlate.identificationNumber
   *    - TRICYCLE: Use tricycle.plateNumber
   *
   * @param rentalId - UUID of the APPROVED/ACTIVE rental
   * @param dueDate - Optional custom due date (defaults to +7 days)
   * @param userId - UUID of user approving rental (for audit trail)
   *
   * @returns Promise<InvoiceResponseDto> - Generated invoice with items
   *
   * @throws {NotFoundException} - Rental not found
   * @throws {InsufficientDataException} - Rental not approved or has no asset
   * @throws {InvoiceAlreadyExistsException} - Invoice already exists for this rental
   *
   * @example
   * ```typescript
   * // In RentalsService.approveRental() method:
   *
   * async approveRental(rentalId: string, userId: string) {
   *   return await this.prisma.$transaction(async (tx) => {
   *     // Step 1: Validate rental
   *     const rental = await tx.rental.findUnique({
   *       where: { id: rentalId },
   *       include: { coldBox: true, coldPlate: true, tricycle: true }
   *     });
   *
   *     if (!rental) throw new NotFoundException('Rental not found');
   *
   *     // Validate asset exists
   *     if (!rental.coldBoxId && !rental.coldPlateId && !rental.tricycleId) {
   *       throw new BadRequestException('Rental has no associated asset');
   *     }
   *
   *     // Step 2: Update asset status to RENTED
   *     if (rental.coldBoxId) {
   *       await tx.coldBox.update({
   *         where: { id: rental.coldBoxId },
   *         data: { status: 'RENTED' }
   *       });
   *     }
   *     // ... similar for coldPlate and tricycle
   *
   *     // Step 3: Update rental status to APPROVED
   *     const approvedRental = await tx.rental.update({
   *       where: { id: rentalId },
   *       data: {
   *         status: 'APPROVED',
   *         approvedAt: new Date()
   *       }
   *     });
   *
   *     // Step 4: Generate invoice
   *     const invoice = await this.invoicesService.generateRentalInvoice(
   *       rentalId,
   *       undefined, // Use default due date
   *       userId
   *     );
   *
   *     // Step 5: Update rental status to ACTIVE
   *     await tx.rental.update({
   *       where: { id: rentalId },
   *       data: { status: 'ACTIVE' }
   *     });
   *
   *     return { rental: approvedRental, invoice };
   *   });
   * }
   * ```
   */
  generateRentalInvoice(
    rentalId: string,
    dueDate?: Date,
    userId?: string,
  ): Promise<InvoiceResponseDto>;
}

/**
 * Integration Data Models
 *
 * These types describe the data consumers can expect from invoice generation
 */

/**
 * Invoice generation result
 * Contains the generated invoice with all calculated fields
 *
 * This is an alias for InvoiceResponseDto for clarity in integration contexts.
 * All fields are inherited from InvoiceResponseDto:
 * - id: string
 * - invoiceNumber: string (format: INV-{SITE}-{YEAR}-{SEQUENCE})
 * - orderId: string | null
 * - rentalId: string | null
 * - clientId: string
 * - siteId: string
 * - subtotal: number
 * - taxAmount: number (18% of subtotal)
 * - totalAmount: number (subtotal + taxAmount)
 * - paidAmount: number (always 0 for new invoices)
 * - status: InvoiceStatus (always 'UNPAID' for new invoices)
 * - dueDate: Date
 * - items: InvoiceItemResponseDto[]
 * - createdAt: Date
 * - updatedAt: Date
 */
export type InvoiceGenerationResult = InvoiceResponseDto;

/**
 * Common errors that invoice generation can throw
 * Consumers MUST handle these errors appropriately
 */
export enum InvoiceGenerationError {
  /** Order/Rental not found in database */
  NOT_FOUND = 'NOT_FOUND',

  /** Order not approved or rental not approved/active */
  INVALID_STATUS = 'INVALID_STATUS',

  /** Order has no items or rental has no asset */
  NO_ITEMS = 'NO_ITEMS',

  /** Invoice already generated for this order/rental */
  DUPLICATE = 'DUPLICATE',

  /** Order/Rental has been soft-deleted */
  DELETED = 'DELETED',
}

/**
 * Best Practices for Invoice Integration
 *
 * 1. ALWAYS use database transactions when calling invoice generation
 * 2. ALWAYS validate entity state before invoice generation
 * 3. ALWAYS handle invoice generation errors
 * 4. NEVER generate invoices for non-approved entities
 * 5. NEVER call invoice generation multiple times for same entity
 * 6. ALWAYS pass userId for audit trail
 * 7. ALWAYS rollback previous operations if invoice generation fails
 *
 * 8. TESTING:
 *    - Write integration tests for full approval flow
 *    - Test error scenarios (duplicate invoice, invalid status)
 *    - Test transaction rollback on failure
 *    - Verify invoice number uniqueness
 *    - Verify tax calculations
 */

/**
 * Troubleshooting Guide
 *
 * ERROR: "Order must be APPROVED before generating invoice"
 * FIX: Ensure order.status = 'APPROVED' before calling generateOrderInvoice()
 *
 * ERROR: "Invoice already exists for order"
 * FIX: Check if invoice was already generated. Use idempotency checks.
 *
 * ERROR: "Order has no items"
 * FIX: Validate order.items.length > 0 before approval
 *
 * ERROR: "Rental must be APPROVED or ACTIVE before generating invoice"
 * FIX: Ensure rental.status IN ('APPROVED', 'ACTIVE')
 *
 * ERROR: "Rental has no associated asset"
 * FIX: Ensure rental has coldBoxId OR coldPlateId OR tricycleId
 *
 * ERROR: Database transaction timeout
 * FIX: Keep transactions short. Don't include external API calls.
 */
