import { Module } from '@nestjs/common';
import { SeederService } from './seeder.service';
import { SeederController } from './seeder.controller';
import { PrismaService } from '../../database/prisma.service';

@Module({
  controllers: [SeederController],
  providers: [SeederService, PrismaService],
  exports: [SeederService],
})
export class SeederModule {}
