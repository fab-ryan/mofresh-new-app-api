import { ApiProperty } from '@nestjs/swagger';

export class SiteEntity {
  @ApiProperty({ example: 'uuid' })
  id: string;

  @ApiProperty({ example: 'My Cool Site' })
  name: string;

  @ApiProperty({ example: 'New York, USA' })
  location: string;

  @ApiProperty({ example: 'uuid', nullable: true })
  managerId?: string;

  @ApiProperty({ example: '2026-01-01T12:00:00.000Z' })
  createdAt: Date;

  @ApiProperty({ example: '2026-01-01T12:00:00.000Z' })
  updatedAt: Date;

  @ApiProperty({ example: '2026-01-01T12:00:00.000Z', nullable: true })
  deletedAt?: Date;
}
