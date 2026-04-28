import { ApiProperty } from '@nestjs/swagger';
import { AuditAction } from '@prisma/client';
import { UserEntity } from '../../../users/entities/user.entity';

export class AuditLogEntity {
  @ApiProperty({
    example: 'a3c0c4bb-017d-46a4-b90b-5b789018eb80',
    description: 'Unique identifier for the audit log',
  })
  id: string;

  @ApiProperty({ example: 'ORDER', description: 'The type of entity (e.g., ORDER, INVOICE, etc.)' })
  entityType: string;

  @ApiProperty({ example: '12345', description: 'The ID of the associated entity' })
  entityId: string;

  @ApiProperty({
    example: 'CREATE',
    enum: AuditAction,
    description: 'Action taken (CREATE, UPDATE, DELETE, etc.)',
  })
  action: AuditAction;

  @ApiProperty({
    example: 'a3c0c4bb-017d-46a4-b90b-5b789018eb80',
    description: 'User ID of the person who performed the action',
  })
  userId: string;

  @ApiProperty({
    example: '{"reason": "Initial order creation"}',
    description: 'Additional details about the action (nullable)',
  })
  details?: any;

  @ApiProperty({
    example: '2023-01-01T12:00:00Z',
    description: 'Timestamp of when the action occurred',
  })
  timestamp: Date;

  @ApiProperty({ type: () => UserEntity, description: 'The user who performed the action' })
  user: UserEntity;
}
