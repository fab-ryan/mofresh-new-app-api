import { ApiProperty } from '@nestjs/swagger';
import {
  ArrayMinSize,
  IsArray,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateOrderItemDto {
  @ApiProperty({
    description: 'Product ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsUUID()
  productId!: string;

  @ApiProperty({
    description: 'Quantity in kilograms',
    example: 25.5,
    minimum: 0.001,
  })
  @IsNumber()
  @Min(0.001)
  quantityKg!: number;
}

export class CreateOrderDto {
  @ApiProperty({
    description: 'Delivery address for the order',
    example: '123 Main Street, Kigali',
    maxLength: 255,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  deliveryAddress!: string;

  @ApiProperty({
    description: 'Additional notes for the order',
    example: 'Please deliver before 10 AM',
    required: false,
    maxLength: 1000,
  })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;

  @ApiProperty({
    description: 'List of order items',
    type: [CreateOrderItemDto],
    minItems: 1,
  })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreateOrderItemDto)
  items!: CreateOrderItemDto[];
}

export class RejectOrderDto {
  @ApiProperty({
    description: 'Reason for rejecting the order',
    example: 'Insufficient stock available',
    maxLength: 500,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  rejectionReason!: string;
}
export class UpdateOrderDto {
  @ApiProperty({
    description: 'Delivery address for the order',
    example: '123 Main Street, Kigali',
    maxLength: 255,
    required: false,
  })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  deliveryAddress?: string;

  @ApiProperty({
    description: 'Additional notes for the order',
    example: 'Please deliver before 10 AM',
    required: false,
    maxLength: 1000,
  })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;

  @ApiProperty({
    description: 'List of order items',
    type: [CreateOrderItemDto],
    minItems: 1,
    required: false,
  })
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreateOrderItemDto)
  items?: CreateOrderItemDto[];
}
