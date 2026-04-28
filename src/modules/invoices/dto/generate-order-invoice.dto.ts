import { IsNotEmpty, IsUUID, IsDateString, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class GenerateOrderInvoiceDto {
  @ApiProperty({
    description: 'Order ID to generate invoice for',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsNotEmpty()
  @IsUUID()
  orderId: string;

  @ApiPropertyOptional({
    description: 'Invoice due date',
    example: '2026-02-10T00:00:00Z',
  })
  @IsOptional()
  @IsDateString()
  dueDate?: string;
}
