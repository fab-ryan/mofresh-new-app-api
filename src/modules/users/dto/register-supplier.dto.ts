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

export class RegisterSupplierDto {
  @ApiProperty({ example: 'supplier@example.com' })
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @ApiProperty({ example: 'Jane' })
  @IsString()
  @IsNotEmpty()
  firstName: string;

  @ApiProperty({ example: 'Smith' })
  @IsString()
  @IsNotEmpty()
  lastName: string;

  @ApiProperty({ example: '+250788111111' })
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

  @ApiProperty({ example: 'Fresh Farms Ltd' })
  @IsString()
  @IsNotEmpty()
  businessName: string;

  @ApiProperty({ example: '987654321' })
  @IsString()
  @IsNotEmpty()
  tinNumber: string;

  @ApiProperty({ type: 'string', format: 'binary', description: 'Business Certificate Document' })
  businessCertificateDocument: any;

  @ApiProperty({ type: 'string', format: 'binary', description: 'National ID Document' })
  nationalIdDocument: any;

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
