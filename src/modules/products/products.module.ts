import { Module } from '@nestjs/common';
import { ProductsController } from './products.controller';
import { ProductsService } from './products.service';
import { AuditLogsModule } from '../audit-logs/audit-logs.module';
import { CloudinaryModule } from '../cloudinary/cloudinary.module';

@Module({
  imports: [AuditLogsModule, CloudinaryModule],
  controllers: [ProductsController],
  providers: [ProductsService],
  exports: [ProductsService],
})
export class ProductsModule {}
