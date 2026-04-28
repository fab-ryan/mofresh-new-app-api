import {
  Controller,
  Get,
  Post,
  Patch,
  Query,
  Delete,
  Body,
  Param,
  ParseUUIDPipe,
  UseGuards,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiConsumes } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { ColdAssetsService } from './cold-assets.services';
import {
  CreateTricycleDto,
  CreateColdBoxDto,
  CreateColdPlateDto,
  UpdateAssetStatusDto,
  UpdateTricycleDto,
  UpdateColdBoxDto,
  UpdateColdPlateDto,
} from './dto/cold-assets.dto';
import { CurrentUser, CurrentUserPayload } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { Public } from '@/common/decorators';
import { FileInterceptor } from '@nestjs/platform-express';

@ApiTags('Cold Assets (Logistics)')
@Controller('cold-assets')
export class ColdAssetsController {
  constructor(private readonly assetsService: ColdAssetsService) {}

  // 1. TRICYCLES
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Post('tricycles')
  @Roles(UserRole.SUPER_ADMIN, UserRole.SITE_MANAGER)
  @ApiOperation({ summary: 'Create a new tricycle' })
  createTricycle(@Body() dto: CreateTricycleDto, @CurrentUser() user: CurrentUserPayload) {
    return this.assetsService.createTricycle(dto, user);
  }
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Get('tricycles')
  @Roles(UserRole.SUPER_ADMIN, UserRole.SITE_MANAGER)
  @ApiOperation({ summary: 'Get tricycles (Admin sees all, Manager sees their site)' })
  getTricycles(@CurrentUser() user: CurrentUserPayload, @Query('siteId') siteId?: string) {
    return this.assetsService.findTricycles(user, siteId);
  }

  @Public()
  @Get('tricycles/public')
  @ApiOperation({ summary: 'Landing Page: List all available tricycles' })
  findAllTricyclesPublic(@Query('siteId') siteId?: string) {
    return this.assetsService.findTricycles(undefined, siteId);
  }

  @Public()
  @Get('tricycles/all/public')
  @ApiOperation({ summary: 'Landing Page: List all available tricycles without filters' })
  findAllTricyclesAllPublic() {
    return this.assetsService.findTricycles(undefined);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Patch('tricycles/:id')
  @Roles(UserRole.SUPER_ADMIN, UserRole.SITE_MANAGER)
  @ApiOperation({ summary: 'Update tricycle details' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('image'))
  updateTricycle(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateTricycleDto,
    @CurrentUser() user: CurrentUserPayload,
    @UploadedFile() image?: Express.Multer.File,
  ) {
    return this.assetsService.updateTricycle(id, dto, user, image);
  }

  // 2. COLD BOXES
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Post('boxes')
  @Roles(UserRole.SUPER_ADMIN, UserRole.SITE_MANAGER)
  @ApiOperation({ summary: 'Create a new cold box' })
  createBox(@Body() dto: CreateColdBoxDto, @CurrentUser() user: CurrentUserPayload) {
    return this.assetsService.createColdBox(dto, user);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Get('boxes')
  @Roles(UserRole.SUPER_ADMIN, UserRole.SITE_MANAGER)
  @ApiOperation({ summary: 'Get cold boxes (Filtered by user scope)' })
  getBoxes(@CurrentUser() user: CurrentUserPayload, @Query('siteId') siteId?: string) {
    return this.assetsService.findColdBoxes(user, siteId);
  }

  @Public()
  @Get('boxes/public')
  @ApiOperation({ summary: 'Landing Page: List all available cold boxes' })
  findAllBoxesPublic(@Query('siteId') siteId?: string) {
    return this.assetsService.findColdBoxes(undefined, siteId);
  }

  @Public()
  @Get('boxes/all/public')
  @ApiOperation({ summary: 'Landing Page: List all available cold boxes without filters' })
  findAllBoxesAllPublic() {
    return this.assetsService.findColdBoxes(undefined);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Patch('boxes/:id')
  @Roles(UserRole.SUPER_ADMIN, UserRole.SITE_MANAGER)
  @ApiOperation({ summary: 'Update cold box details' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('image'))
  updateBox(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateColdBoxDto,
    @CurrentUser() user: CurrentUserPayload,
    @UploadedFile() image?: Express.Multer.File,
  ) {
    return this.assetsService.updateColdBox(id, dto, user, image);
  }

  // 3. COLD PLATES
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Post('plates')
  @Roles(UserRole.SUPER_ADMIN, UserRole.SITE_MANAGER)
  @ApiOperation({ summary: 'Create a new cold plate' })
  createPlate(@Body() dto: CreateColdPlateDto, @CurrentUser() user: CurrentUserPayload) {
    return this.assetsService.createColdPlate(dto, user);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Get('plates')
  @Roles(UserRole.SUPER_ADMIN, UserRole.SITE_MANAGER)
  @ApiOperation({ summary: 'Get cold plates (Filtered by user scope)' })
  getPlates(@CurrentUser() user: CurrentUserPayload, @Query('siteId') siteId?: string) {
    return this.assetsService.findColdPlates(user, siteId);
  }

  @Public()
  @Get('plates/public')
  @ApiOperation({ summary: 'Landing Page: Get available cold plates' })
  getPlatesPublic() {
    return this.assetsService.findColdPlates(undefined);
  }

  @Public()
  @Get('plates/discovery')
  @ApiOperation({ summary: 'Landing Page: List all available cold plates' })
  findAllPlatesPublic(@Query('siteId') siteId?: string) {
    return this.assetsService.findColdPlates(undefined, siteId);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Patch('plates/:id')
  @Roles(UserRole.SUPER_ADMIN, UserRole.SITE_MANAGER)
  @ApiOperation({ summary: 'Update cold plate details' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('image'))
  updatePlate(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateColdPlateDto,
    @CurrentUser() user: CurrentUserPayload,
    @UploadedFile() image?: Express.Multer.File,
  ) {
    return this.assetsService.updateColdPlate(id, dto, user, image);
  }

  // 4. STATUS & REMOVAL

  @Patch(':type/:id/status')
  @Roles(UserRole.SUPER_ADMIN, UserRole.SITE_MANAGER)
  @ApiOperation({ summary: 'Update status (Manager restricted to own site)' })
  updateStatus(
    @Param('type') type: 'tricycle' | 'coldBox' | 'coldPlate',
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateAssetStatusDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.assetsService.updateStatus(type, id, dto.status, user);
  }

  @Delete(':type/:id')
  @Roles(UserRole.SUPER_ADMIN) // Usually, only Super Admins can delete assets
  @ApiOperation({ summary: 'Remove asset (Super Admin only)' })
  remove(
    @Param('type') type: 'tricycle' | 'coldBox' | 'coldPlate',
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.assetsService.remove(type, id, user);
  }
}
