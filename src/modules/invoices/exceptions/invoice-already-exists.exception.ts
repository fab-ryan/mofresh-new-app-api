import { HttpException, HttpStatus } from '@nestjs/common';

export class InvoiceAlreadyExistsException extends HttpException {
  constructor(entityType: 'order' | 'rental', entityId: string) {
    super(
      {
        statusCode: HttpStatus.CONFLICT,
        message: `Invoice already exists for ${entityType} with ID: ${entityId}`,
        error: 'Invoice Already Exists',
      },
      HttpStatus.CONFLICT,
    );
  }
}
