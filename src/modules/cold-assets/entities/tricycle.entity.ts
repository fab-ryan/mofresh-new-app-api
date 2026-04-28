import { ApiProperty } from '@nestjs/swagger';
import { AssetStatus, TricycleCategory } from '@prisma/client';

export class TricycleEntity {
  @ApiProperty()
  id: string;

  @ApiProperty({ example: 'RAA 123 A' })
  plateNumber: string;

  @ApiProperty()
  siteId: string;

  @ApiProperty()
  capacity: string;

  @ApiProperty({ enum: TricycleCategory })
  category: TricycleCategory;

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

  constructor(partial: Partial<TricycleEntity>) {
    Object.assign(this, partial);
  }
}
