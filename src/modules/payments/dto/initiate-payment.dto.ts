import { IsNotEmpty, IsUUID, IsString, Matches } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class InitiatePaymentDto {
  @ApiProperty({
    description: 'Invoice ID to pay',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsNotEmpty()
  @IsUUID()
  invoiceId!: string;

  @ApiProperty({
    description: 'Phone number in Rwanda format',
    example: '250788123456',
  })
  @IsNotEmpty()
  @IsString()
  @Matches(/^250\d{9}$/, { message: 'Phone number must be in format 250XXXXXXXXX' })
  phoneNumber!: string;
}
