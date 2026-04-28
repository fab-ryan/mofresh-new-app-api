import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString, IsUUID } from 'class-validator';

export class UpdateSiteDto {
  @ApiProperty({
    description: 'The name of the site (optional)',
    example: 'Updated Site Name',
    required: false,
  })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiProperty({
    description: 'The location of the site (optional)',
    example: 'Los Angeles, USA',
    required: false,
  })
  @IsOptional()
  @IsString()
  location?: string;

  @ApiProperty({
    description: 'The ID of the site manager (optional)',
    example: '67890',
    required: false,
  })
  @IsOptional()
  @IsUUID()
  managerId?: string;
}
