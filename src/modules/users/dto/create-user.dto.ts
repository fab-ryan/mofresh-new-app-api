import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  MinLength,
  IsUUID,
  Matches,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { UserRole } from '@prisma/client';

export class CreateUserDto {
  @ApiProperty({ example: 'user@example.com' })
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @ApiPropertyOptional({
    example: 'SecurePass123!',
    description:
      'Password must be at least 8 characters and contain uppercase, lowercase, number, and special character',
  })
  @IsString()
  // eslint-disable-next-line @typescript-eslint/no-unsafe-return
  @Transform(({ value }) => (value === '' ? undefined : value))
  @IsOptional()
  @MinLength(8, { message: 'Password must be at least 8 characters long' })
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/, {
    message: 'Password must contain uppercase, lowercase, number, and special character',
  })
  password?: string;

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
    enum: UserRole,
    example: UserRole.CLIENT,
    description: 'User role: SUPER_ADMIN, SITE_MANAGER, SUPPLIER, or CLIENT',
  })
  @IsEnum(UserRole)
  @IsNotEmpty()
  role: UserRole;

  @ApiPropertyOptional({
    example: '3a8e310e-8a62-41a6-9b08-8b7f4e593840',
    description:
      'Required for SITE_MANAGER, SUPPLIER, and CLIENT roles. Should be null for SUPER_ADMIN.',
  })
  @IsOptional()
  @IsUUID()
  siteId?: string;

  @ApiPropertyOptional({
    enum: ['PERSONAL', 'BUSINESS'],
    example: 'PERSONAL',
    description: 'Account type for CLIENT role',
  })
  @IsOptional()
  @IsString()
  accountType?: string;
}
