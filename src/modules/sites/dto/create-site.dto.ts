import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class CreateSiteDto {
  @ApiProperty({
    description: 'The name of the site',
    example: 'My Cool Site',
  })
  @IsString()
  name: string;

  @ApiProperty({
    description: 'The location of the site',
    example: 'New York, USA',
  })
  @IsString()
  location: string;

  @ApiProperty({
    description: 'The ID of the site manager (optional)',
    example: '12345',
    required: false,
  })
  @IsOptional()
  @IsString()
  managerId?: string;
}
