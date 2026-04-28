import { ApiProperty, PartialType } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsString, IsUUID, IsOptional } from 'class-validator';
import { TricycleCategory, AssetStatus } from '@prisma/client';

export class CreateTricycleDto {
  @ApiProperty({ example: 'RAA 123 A' })
  @IsString()
  @IsNotEmpty()
  plateNumber: string;

  @ApiProperty({ example: 'uuid-site-789' })
  @IsUUID()
  siteId: string;

  @ApiProperty({ example: '200kg' })
  @IsString()
  capacity: string;

  @ApiProperty({ enum: TricycleCategory })
  @IsEnum(TricycleCategory)
  category: TricycleCategory;

  // Added imageUrl to match new updated Prisma schema
  @ApiProperty({ example: 'https://example.com/tricycle.jpg', required: false })
  @IsOptional()
  @IsString()
  imageUrl?: string;
}

export class UpdateTricycleDto extends PartialType(CreateTricycleDto) {}

export class CreateColdBoxDto {
  @ApiProperty({ example: 'CB-001' })
  @IsString()
  @IsNotEmpty()
  identificationNumber: string;

  @ApiProperty({ example: '50L' })
  @IsString()
  sizeOrCapacity: string;

  @ApiProperty({ example: 'uuid-site-789' })
  @IsUUID()
  siteId: string;

  @ApiProperty({ example: 'Zone B-4' })
  @IsString()
  location: string;

  // Added imageUrl to match new updated Prisma schema
  @ApiProperty({ example: 'https://example.com/box.jpg', required: false })
  @IsOptional()
  @IsString()
  imageUrl?: string;
}

export class UpdateColdBoxDto extends PartialType(CreateColdBoxDto) {}

export class CreateColdPlateDto {
  @ApiProperty({ example: 'CP-500' })
  @IsString()
  @IsNotEmpty()
  identificationNumber: string;

  @ApiProperty({ example: 'PCM-23' })
  @IsString()
  coolingSpecification: string;

  @ApiProperty({ example: 'uuid-site-789' })
  @IsUUID()
  siteId: string;

  // Added imageUrl to match new updated Prisma schema
  @ApiProperty({ example: 'https://example.com/plate.jpg', required: false })
  @IsOptional()
  @IsString()
  imageUrl?: string;
}

export class UpdateColdPlateDto extends PartialType(CreateColdPlateDto) {}

export class UpdateAssetStatusDto {
  @ApiProperty({ enum: AssetStatus })
  @IsEnum(AssetStatus)
  status: AssetStatus;
}
