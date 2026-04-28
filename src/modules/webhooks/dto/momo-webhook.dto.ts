import { IsString, IsNotEmpty, IsOptional, IsNumber } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class MoMoWebhookDto {
  @ApiProperty({
    description: 'MTN MoMo transaction reference',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @IsString()
  @IsNotEmpty()
  transactionRef: string;

  @ApiProperty({
    description: 'Payment status',
    example: 'SUCCESSFUL',
    enum: ['PENDING', 'SUCCESSFUL', 'FAILED', 'PAID'],
  })
  @IsString()
  @IsNotEmpty()
  status: string;

  @ApiProperty({
    description: 'Payment amount',
    example: 100000,
    required: false,
  })
  @IsNumber()
  @IsOptional()
  amount?: number;

  @ApiProperty({
    description: 'Failure reason if applicable',
    example: 'Insufficient funds',
    required: false,
  })
  @IsString()
  @IsOptional()
  reason?: string;

  @ApiProperty({
    description: 'External transaction ID',
    required: false,
  })
  @IsString()
  @IsOptional()
  externalId?: string;

  @ApiProperty({
    description: 'Financial transaction ID from MTN',
    required: false,
  })
  @IsString()
  @IsOptional()
  financialTransactionId?: string;
}
