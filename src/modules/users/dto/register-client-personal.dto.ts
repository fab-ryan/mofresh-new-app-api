/* eslint-disable @typescript-eslint/no-unsafe-return */
import { ApiProperty } from '@nestjs/swagger';
import {
  IsEmail,
  IsNotEmpty,
  IsString,
  MinLength,
  Matches,
  IsOptional,
  IsUUID,
} from 'class-validator';
import { Transform } from 'class-transformer';

export class RegisterClientPersonalDto {
  @ApiProperty({ example: 'user@example.com' })
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @ApiProperty({ example: 'John' })
  @IsString()
  @IsNotEmpty()
  firstName: string;

  @ApiProperty({ example: 'Doe' })
  @IsString()
  @IsNotEmpty()
  lastName: string;

  @ApiProperty({ example: '+250788000000' })
  @IsString()
  @IsNotEmpty()
  phone: string;

  @ApiProperty({
    example: 'SecurePass123!',
    description:
      'Password must be at least 8 characters and contain uppercase, lowercase, number, and special character',
  })
  @IsString()
  @Transform(({ value }) => (value === '' ? undefined : value))
  @IsOptional()
  @MinLength(8, { message: 'Password must be at least 8 characters long' })
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/, {
    message: 'Password must contain uppercase, lowercase, number, and special character',
  })
  password?: string;

  @ApiProperty({ example: 'uuid-of-site', required: false })
  @IsOptional()
  @IsUUID()
  siteId?: string;

  @ApiProperty({
    enum: ['PERSONAL', 'BUSINESS'],
    example: 'PERSONAL',
    description: 'Account type for CLIENT role',
    required: false,
  })
  @IsOptional()
  @IsString()
  accountType?: string;

  @ApiProperty({
    type: 'string',
    format: 'binary',
    description: 'National ID Document',
    required: false,
  })
  @IsOptional()
  nationalIdDocument?: any;
}
