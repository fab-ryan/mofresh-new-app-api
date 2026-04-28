import { IsNotEmpty, IsString, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class VoidInvoiceDto {
  @ApiProperty({
    description: 'Reason for voiding the invoice',
    example: 'Order cancelled by client',
    minLength: 3,
  })
  @IsNotEmpty()
  @IsString()
  @MinLength(3)
  reason!: string;
}
