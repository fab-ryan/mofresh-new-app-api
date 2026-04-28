import { ApiProperty } from '@nestjs/swagger';
import { StockMovementType } from '@prisma/client';

export class StockMovementEntity {
  @ApiProperty()
  id: string;

  @ApiProperty()
  productId: string;

  @ApiProperty({ example: 'uuid-coldroom-456' })
  coldRoomId: string;

  @ApiProperty()
  quantityKg: number;

  @ApiProperty({ enum: StockMovementType })
  movementType: StockMovementType;

  @ApiProperty()
  reason: string;

  @ApiProperty()
  createdBy: string;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty({ required: false })
  user?: { firstName: string; lastName: string };

  @ApiProperty({ required: false })
  product?: { name: string; unit: string };

  constructor(partial: Partial<StockMovementEntity>) {
    Object.assign(this, partial);
  }
}
