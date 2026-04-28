import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  UseGuards,
  ParseUUIDPipe,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse, ApiConsumes } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { ProductsService } from './products.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { AdjustStockDto } from './dto/adjust-stock.dto';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser, CurrentUserPayload } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { ProductEntity } from './entities/product.entity';
import { ProductQueryDto } from './dto/product-query.dto';
import { FileInterceptor } from '@nestjs/platform-express';
@ApiTags('Products')
@Controller('products')
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Public()
  @Get('all/public')
  @ApiOperation({ summary: 'Public: List all available products without filters' })
  @ApiResponse({ status: 200, type: [ProductEntity] })
  async findAllProductsPublic() {
    return this.productsService.findAll(undefined);
  }

  @Public()
  @Get('discovery')
  @ApiOperation({ summary: 'Landing Page: List all available products' })
  async discovery(@Query() query: ProductQueryDto, @CurrentUser() user?: CurrentUserPayload) {
    return this.productsService.findAll(user, query.siteId, query.category);
  }

  @Public()
  @Get('discovery/:id')
  @ApiOperation({ summary: 'Details: View a specific product' })
  async discoveryOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.productsService.findOne(id, undefined);
  }

  @Public()
  @Get('discovery')
  @ApiOperation({ summary: 'List all products with site-specific filtering' })
  @ApiResponse({ status: 200, type: [ProductEntity] })
  async findAll(@Query('siteId') siteId?: string, @Query('category') category?: string) {
    return this.productsService.findAll(undefined, siteId, category);
  }

  @Public()
  @Get(':id')
  @ApiOperation({ summary: 'Get detailed product information' })
  async findOne(
    @Param('id', new ParseUUIDPipe()) id: string,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.productsService.findOne(id, user);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Get()
  @Roles(UserRole.SUPER_ADMIN, UserRole.SITE_MANAGER, UserRole.CLIENT, UserRole.SUPPLIER)
  @ApiOperation({ summary: 'View products on my registered site' })
  async findAllDashboard(
    @CurrentUser() user: CurrentUserPayload,
    @Query('siteId') siteId?: string,
    @Query('category') category?: string,
  ) {
    return this.productsService.findAll(user, siteId, category);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Post()
  @Roles(UserRole.SUPER_ADMIN, UserRole.SITE_MANAGER)
  @ApiOperation({ summary: 'Register a new agricultural product' })
  @ApiConsumes('multipart/form-data')
  @ApiResponse({ status: 201, type: ProductEntity })
  @UseInterceptors(FileInterceptor('image'))
  async create(
    @Body() dto: CreateProductDto,
    @CurrentUser() user: CurrentUserPayload,
    @UploadedFile() image?: Express.Multer.File,
  ) {
    return this.productsService.create(dto, user, image);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Patch(':id')
  @Roles(UserRole.SUPER_ADMIN, UserRole.SITE_MANAGER)
  @ApiOperation({ summary: 'Update product metadata' })
  @ApiConsumes('multipart/form-data')
  @ApiResponse({ status: 200, type: ProductEntity })
  @UseInterceptors(FileInterceptor('image'))
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateProductDto,
    @CurrentUser() user: CurrentUserPayload,
    @UploadedFile() image?: Express.Multer.File,
  ) {
    return this.productsService.update(id, dto, user, image);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Patch(':id/adjust-stock')
  @Roles(UserRole.SUPER_ADMIN, UserRole.SITE_MANAGER)
  @ApiOperation({
    summary: 'Adjust product stock levels (IN/OUT movements)',
    description:
      'Records a stock movement and updates product quantity atomically. Enforces cold room capacity constraints on IN movements.',
  })
  @ApiResponse({ status: 200, description: 'Stock adjusted successfully' })
  @ApiResponse({ status: 400, description: 'Insufficient stock or capacity exceeded' })
  @ApiResponse({ status: 404, description: 'Product not found' })
  async adjustStock(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AdjustStockDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.productsService.adjustStock(id, dto, user);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Delete(':id')
  @Roles(UserRole.SUPER_ADMIN, UserRole.SITE_MANAGER)
  @ApiOperation({ summary: 'Soft delete a product' })
  async remove(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: CurrentUserPayload) {
    return this.productsService.remove(id, user);
  }
}
