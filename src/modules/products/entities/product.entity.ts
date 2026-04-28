import { ApiProperty } from '@nestjs/swagger';
import { ProductStatus } from '@prisma/client';

export class ProductEntity {
  @ApiProperty({
    example: 'uui-123-456-789',
  })
  id: string;

  @ApiProperty({ example: 'Fresh Tomatoes' })
  name: string;

  @ApiProperty({ example: 'Vegetables', nullable: true })
  category: string | null;

  @ApiProperty({ example: 25.5, description: 'Current stock weight' })
  quantityKg: number;

  @ApiProperty({ example: 'kg' })
  unit: string;

  @ApiProperty({ example: 'uuid-supplier-123' })
  supplierId: string;

  @ApiProperty({ example: 'uuid-room-456' })
  coldRoomId: string;

  @ApiProperty({ example: 1500.0, description: 'Price per KG in RWF' })
  sellingPricePerUnit: number;

  @ApiProperty({ example: 'uuid-site-789' })
  siteId: string;

  @ApiProperty({
    example: 'IN_STOCK',
    enum: ProductStatus,
    description: 'Current availability status',
  })
  status: ProductStatus;

  @ApiProperty({ example: 'https://example.com/tomato.jpg', nullable: true })
  imageUrl: string | null;

  @ApiProperty({ example: 'Freshly harvested organic tomatoes', nullable: true })
  description: string | null;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;

  @ApiProperty({ nullable: true })
  deletedAt: Date | null;

  constructor(partial: Partial<ProductEntity>) {
    Object.assign(this, partial);
  }
}
