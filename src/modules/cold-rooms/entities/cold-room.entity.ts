import { ApiProperty } from '@nestjs/swagger';
import { PowerType } from '@prisma/client'; // Import the actual enum

export class ColdRoomEntity {
  @ApiProperty({ example: 'uuid-room-101' })
  id: string;

  @ApiProperty({ example: 'Main Kigali Freezer' })
  name: string;

  @ApiProperty({ example: 'uuid-site-789' })
  siteId: string;

  @ApiProperty({ example: 1000.0 })
  totalCapacityKg: number;

  @ApiProperty({ example: 0.0 })
  usedCapacityKg: number;

  @ApiProperty({ example: 2.5 })
  temperatureMin: number;

  @ApiProperty({ example: 8.0, nullable: true })
  temperatureMax: number | null;

  @ApiProperty({
    enum: PowerType,
    example: 'GRID',
    description: 'The primary power source for this unit',
  })
  powerType: PowerType;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;

  @ApiProperty({ nullable: true })
  deletedAt: Date | null;

  constructor(partial: Partial<ColdRoomEntity>) {
    Object.assign(this, partial);
  }
}
