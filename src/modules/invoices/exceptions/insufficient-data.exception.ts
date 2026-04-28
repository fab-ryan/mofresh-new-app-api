import { HttpException, HttpStatus } from '@nestjs/common';

export class InsufficientDataException extends HttpException {
  constructor(message: string) {
    super(
      {
        statusCode: HttpStatus.BAD_REQUEST,
        message,
        error: 'Insufficient Data',
      },
      HttpStatus.BAD_REQUEST,
    );
  }
}
