import { ApiProperty } from '@nestjs/swagger';
import { AssetType } from '@prisma/client';
import { IsEnum, IsNotEmpty, IsOptional, IsUUID } from 'class-validator';

export class GetAvailableAssetsDto {
  @ApiProperty({
    description: 'Type of asset to fetch',
    enum: AssetType,
    example: AssetType.COLD_BOX,
  })
  @IsEnum(AssetType)
  @IsNotEmpty()
  assetType: AssetType;

  @ApiProperty({
    description: 'Optional Site ID to filter assets by site',
    required: false,
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsOptional()
  @IsUUID()
  siteId?: string;
}
