import { IsUUID, IsNumber, IsEnum, IsString, Min, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { StockMovementType } from '@prisma/client';

export class CreateStockMovementDto {
  @ApiProperty({ example: 'uuid-product-1' })
  @IsUUID()
  productId: string;

  @ApiProperty({ example: 'uuid-coldroom-456' })
  @IsUUID()
  coldRoomId: string;

  @ApiProperty({ example: 100 })
  @IsNumber()
  @Min(0.1)
  quantityKg: number;

  @ApiProperty({ example: 'IN', enum: StockMovementType })
  @IsEnum(StockMovementType)
  movementType: StockMovementType;

  @ApiProperty({ example: 'Received new delivery' })
  @IsString()
  reason: string;

  @IsUUID()
  @IsOptional()
  supplierId?: string;
}
