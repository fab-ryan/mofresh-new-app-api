import { ApiProperty } from '@nestjs/swagger';
import { AssetType } from '@prisma/client';
import {
  IsDateString,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsUUID,
  Min,
} from 'class-validator';

export class CreateRentalDto {
  @ApiProperty({
    description: 'Type of asset to rent',
    enum: AssetType,
    example: 'COLD_BOX',
  })
  @IsEnum(AssetType)
  @IsNotEmpty()
  assetType: AssetType;

  @ApiProperty({
    description: 'ID of the Cold Box (if applicable)',
    required: false,
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsOptional()
  @IsUUID()
  coldBoxId?: string;

  @ApiProperty({
    description: 'ID of the Cold Plate (if applicable)',
    required: false,
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsOptional()
  @IsUUID()
  coldPlateId?: string;

  @ApiProperty({
    description: 'ID of the Tricycle (if applicable)',
    required: false,
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsOptional()
  @IsUUID()
  tricycleId?: string;

  @ApiProperty({
    description: 'ID of the Cold Room (if applicable)',
    required: false,
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsOptional()
  @IsUUID()
  coldRoomId?: string;

  @ApiProperty({
    description: 'Start date of the rental',
    example: '2023-10-27T10:00:00Z',
  })
  @IsDateString()
  @IsNotEmpty()
  rentalStartDate: string;

  @ApiProperty({
    description: 'End date of the rental',
    example: '2023-10-28T10:00:00Z',
  })
  @IsDateString()
  @IsNotEmpty()
  rentalEndDate: string;

  @ApiProperty({
    description: 'Estimated fee for the rental',
    example: 50.0,
    minimum: 0,
  })
  @IsNumber()
  @Min(0)
  @IsNotEmpty()
  estimatedFee: number;

  @ApiProperty({
    description: 'Capacity needed in Kg (required for COLD_ROOM rentals)',
    required: false,
    example: 100.5,
    minimum: 0.01,
  })
  @IsOptional()
  @IsNumber()
  @Min(0.01)
  @IsNotEmpty()
  capacityNeededKg?: number;

  @ApiProperty({
    description: 'Site ID where the asset is located (required for public requests)',
    required: false,
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsOptional()
  @IsUUID()
  siteId?: string;

  @ApiProperty({
    description: 'Client ID requesting the rental (required for public requests)',
    required: false,
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsOptional()
  @IsUUID()
  clientId?: string;
}
