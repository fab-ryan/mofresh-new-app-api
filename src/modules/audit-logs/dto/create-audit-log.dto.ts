import { IsEnum, IsOptional, IsString, IsUUID } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { AuditAction, Prisma } from '@prisma/client';

export class CreateAuditLogDto {
  @ApiProperty({
    description: 'The type of entity being audited (e.g., ORDER, INVOICE)',
    example: 'ORDER',
  })
  @IsString()
  entityType: string;

  @ApiProperty({
    description: 'Unique identifier for the entity being audited',
    example: '12345',
  })
  @IsUUID()
  entityId: string;

  @ApiProperty({
    description: 'The action that was performed on the entity (e.g., CREATE, UPDATE, DELETE)',
    example: AuditAction.CREATE,
    enum: AuditAction,
  })
  @IsEnum(AuditAction)
  action: AuditAction;

  @ApiProperty({
    description: 'User ID of the person who performed the action',
    example: 'a3c0c4bb-017d-46a4-b90b-5b789018eb80',
  })
  @IsUUID()
  userId: string;

  @ApiProperty({
    description: 'Additional details about the action (optional)',
    example: '{"reason": "Initial order creation"}',
    required: false,
  })
  @IsOptional()
  details?: Prisma.InputJsonValue;

  @ApiProperty({
    description: 'Timestamp of when the action occurred (optional)',
    example: '2023-01-01T12:00:00Z',
    required: false,
  })
  @IsOptional()
  timestamp?: Date;
}
