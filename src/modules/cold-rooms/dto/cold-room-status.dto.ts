import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, Min, IsBoolean, IsPositive, Max } from 'class-validator';

export class ColdRoomStatusDto {
  @ApiProperty({ example: 1000.0, description: 'Total capacity in KG' })
  @IsNumber()
  @IsPositive()
  totalCapacityKg: number;

  @ApiProperty({ example: 450.0, description: 'Current weight stored' })
  @IsNumber()
  @Min(0)
  usedCapacityKg: number;

  @ApiProperty({ example: 550.0, description: 'Remaining space' })
  @IsNumber()
  @Min(0)
  availableKg: number;

  @ApiProperty({ example: 45.0, description: 'Percentage of room filled' })
  @IsNumber()
  @Min(0)
  @Max(100)
  occupancyPercentage: number;

  @ApiProperty({ example: true, description: 'Whether the room can accept more stock' })
  @IsBoolean()
  canAcceptMore: boolean;
}
