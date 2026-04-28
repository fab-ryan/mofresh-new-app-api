import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsNumber, IsOptional, IsString, IsUUID, Min } from 'class-validator';
import { PowerType } from '@prisma/client';

export class CreateColdRoomDto {
  @ApiProperty({ example: 'Main Kigali Freezer' })
  @IsString()
  name: string;

  @ApiProperty({ example: 'uuid-site-789' })
  @IsUUID()
  siteId: string;

  @ApiProperty({ example: 1000.0 })
  @IsNumber()
  @Min(0)
  totalCapacityKg: number;

  @ApiProperty({ example: 2.5 })
  @IsNumber()
  temperatureMin: number;

  @ApiProperty({ example: 8.0, required: false })
  @IsOptional()
  @IsNumber()
  temperatureMax?: number;

  @ApiProperty({ enum: PowerType, example: 'HYBRID' })
  @IsEnum(PowerType)
  powerType: PowerType;
}
