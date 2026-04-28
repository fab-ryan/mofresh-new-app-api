import { ApiProperty } from '@nestjs/swagger';
import { AssetStatus } from '@prisma/client';

export class ColdBoxEntity {
  @ApiProperty()
  id: string;

  @ApiProperty({ example: 'CB-001' })
  identificationNumber: string;

  @ApiProperty()
  sizeOrCapacity: string;

  @ApiProperty()
  siteId: string;

  @ApiProperty()
  location: string;

  @ApiProperty({ enum: AssetStatus })
  status: AssetStatus;

  // Added imageUrl to match new updated Prisma schema
  @ApiProperty({ nullable: true }) imageUrl: string | null;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;

  @ApiProperty({ nullable: true })
  deletedAt: Date | null;

  constructor(partial: Partial<ColdBoxEntity>) {
    Object.assign(this, partial);
  }
}
