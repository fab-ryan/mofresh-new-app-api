import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsNumber, IsString, IsNotEmpty, Min } from 'class-validator';
import { StockMovementType } from '@prisma/client';

export class AdjustStockDto {
  @ApiProperty({ enum: StockMovementType, example: 'IN' })
  @IsEnum(StockMovementType)
  movementType: StockMovementType;

  @ApiProperty({ example: 50 })
  @IsNumber()
  @Min(0.1)
  quantityKg: number;

  @ApiProperty({ example: 'Restocking from weekly harvest' })
  @IsString()
  @IsNotEmpty()
  reason: string;
}
