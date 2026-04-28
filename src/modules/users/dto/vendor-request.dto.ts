import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class VendorRequestDto {
  @ApiProperty({ example: 'vendor@example.com' })
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @ApiProperty({ example: '+250788333333' })
  @IsString()
  @IsNotEmpty()
  phone: string;

  @ApiPropertyOptional({ example: 'I want to sell my fresh vegetables through MoFresh.' })
  @IsString()
  @IsOptional()
  description?: string;
}
