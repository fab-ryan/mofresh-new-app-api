import { IsNotEmpty, IsUUID, IsDateString, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class GenerateRentalInvoiceDto {
  @ApiProperty({
    description: 'Rental ID to generate invoice for',
    example: '123e4567-e89b-12d3-a456-426614174001',
  })
  @IsNotEmpty()
  @IsUUID()
  rentalId: string;

  @ApiPropertyOptional({
    description: 'Invoice due date',
    example: '2026-02-10T00:00:00Z',
  })
  @IsOptional()
  @IsDateString()
  dueDate?: string;
}
