/* eslint-disable @typescript-eslint/no-unsafe-return */
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsNotEmpty,
  IsString,
  IsUUID,
  IsOptional,
  MinLength,
  Matches,
} from 'class-validator';
import { Transform } from 'class-transformer';

export class RegisterSiteManagerDto {
  @ApiProperty({ example: 'manager@mofresh.rw' })
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @ApiProperty({ example: 'Alice' })
  @IsString()
  @IsNotEmpty()
  firstName: string;

  @ApiProperty({ example: 'Johnson' })
  @IsString()
  @IsNotEmpty()
  lastName: string;

  @ApiProperty({ example: '+250788222222' })
  @IsString()
  @IsNotEmpty()
  phone: string;

  @ApiProperty({ example: 'uuid-of-site' })
  @IsUUID()
  @IsNotEmpty()
  siteId: string;

  @ApiPropertyOptional({
    enum: ['PERSONAL', 'BUSINESS'],
    example: 'PERSONAL',
    description: 'Account type for CLIENT role',
  })
  @IsOptional()
  @IsString()
  accountType?: string;

  @ApiPropertyOptional({
    example: 'SecurePass123!',
    description:
      'Password must be at least 8 characters and contain uppercase, lowercase, number, and special character. If omitted, a temporary password will be sent via email.',
  })
  @IsString()
  @Transform(({ value }) => (value === '' ? undefined : value))
  @IsOptional()
  @MinLength(8, { message: 'Password must be at least 8 characters long' })
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/, {
    message: 'Password must contain uppercase, lowercase, number, and special character',
  })
  password?: string;
}
