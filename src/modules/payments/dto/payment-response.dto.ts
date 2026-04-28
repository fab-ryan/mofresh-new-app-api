import { ApiProperty } from '@nestjs/swagger';
import { PaymentStatus, PaymentMethod } from '@prisma/client';

export class PaymentResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  invoiceId: string;

  @ApiProperty()
  amount: number;

  @ApiProperty({ enum: PaymentMethod })
  paymentMethod: PaymentMethod;

  @ApiProperty({ enum: PaymentStatus })
  status: PaymentStatus;

  @ApiProperty({ nullable: true })
  momoTransactionRef?: string | null;

  @ApiProperty({ nullable: true })
  phoneNumber?: string | null;

  @ApiProperty({ nullable: true })
  paidAt?: Date | null;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}
