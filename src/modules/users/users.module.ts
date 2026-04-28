import { Module } from '@nestjs/common';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { PrismaService } from '../../database/prisma.service';
import { MailModule } from '../mail/mail.module';
import { AuditLogsModule } from '../audit-logs/audit-logs.module';

import { CloudinaryModule } from '../cloudinary/cloudinary.module';
import { CloudinaryService } from '../cloudinary/cloudinary.service';

@Module({
  imports: [MailModule, AuditLogsModule, CloudinaryModule],
  controllers: [UsersController],
  providers: [UsersService, PrismaService, CloudinaryService],
  exports: [UsersService],
})
export class UsersModule {}
