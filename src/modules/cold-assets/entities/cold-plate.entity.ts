import { ApiProperty } from '@nestjs/swagger';
import { AssetStatus } from '@prisma/client';

export class ColdPlateEntity {
  @ApiProperty() id: string;
  @ApiProperty({ example: 'CP-001' }) identificationNumber: string;
  @ApiProperty() coolingSpecification: string;
  @ApiProperty() siteId: string;
  @ApiProperty({ enum: AssetStatus }) status: AssetStatus;
  // Added imageUrl to match new updated Prisma schema
  @ApiProperty({ nullable: true }) imageUrl: string | null;
  @ApiProperty() createdAt: Date;
  @ApiProperty() updatedAt: Date;
  @ApiProperty({ nullable: true }) deletedAt: Date | null;

  constructor(partial: Partial<ColdPlateEntity>) {
    Object.assign(this, partial);
  }
}
