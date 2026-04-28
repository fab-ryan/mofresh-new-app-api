import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Patch,
  Delete,
  NotFoundException,
  BadRequestException,
  UseGuards,
} from '@nestjs/common';
import { SitesService } from './sites.service';
import { CreateSiteDto } from './dto/create-site.dto';
import { UpdateSiteDto } from './dto/update-site.dto';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { SiteEntity } from './dto/entities/site.entity';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '@prisma/client';
import { CurrentUser, CurrentUserPayload } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';

@ApiTags('Sites')
@Controller('sites')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class SitesController {
  constructor(private readonly sitesService: SitesService) {}

  @Post()
  @Roles(UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Create a new site' })
  @ApiResponse({
    status: 201,
    description: 'The site has been successfully created.',
    type: SiteEntity,
  })
  @ApiResponse({ status: 400, description: 'Bad request.' })
  async create(
    @Body() createSiteDto: CreateSiteDto,
    @CurrentUser() user: CurrentUserPayload,
  ): Promise<{ status: string; message: string; data: SiteEntity }> {
    try {
      const createdSite = await this.sitesService.create(createSiteDto, user.userId);
      return {
        status: 'success',
        message: 'Site created successfully',
        data: createdSite,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error occurred';
      throw new BadRequestException('Failed to create site', message);
    }
  }

  @Get()
  @Public()
  @Roles(UserRole.SUPER_ADMIN, UserRole.SITE_MANAGER, UserRole.SUPPLIER, UserRole.CLIENT)
  @ApiOperation({ summary: 'Get all sites' })
  @ApiResponse({
    status: 200,
    description: 'Successfully retrieved all sites.',
    type: [SiteEntity],
  })
  async findAll(
    @CurrentUser() user?: CurrentUserPayload,
  ): Promise<{ status: string; message: string; data: SiteEntity[] }> {
    try {
      const siteId = user?.role === UserRole.SITE_MANAGER ? user.siteId : undefined;
      const sites = await this.sitesService.findAll(siteId);

      return {
        status: 'success',
        message: 'Successfully retrieved all sites.',
        data: sites,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error occurred';
      throw new BadRequestException('Failed to retrieve sites', message);
    }
  }

  @Get(':id')
  @Roles(UserRole.SUPER_ADMIN, UserRole.SITE_MANAGER, UserRole.SUPPLIER, UserRole.CLIENT)
  @ApiOperation({ summary: 'Get a site by ID' })
  @ApiResponse({ status: 200, description: 'Successfully retrieved the site.', type: SiteEntity })
  @ApiResponse({ status: 404, description: 'Site not found.' })
  async findOne(
    @Param('id') id: string,
  ): Promise<{ status: string; message: string; data?: SiteEntity }> {
    const site = await this.sitesService.findOne(id);

    if (!site) {
      throw new NotFoundException(`Site with ID ${id} not found.`);
    }

    return {
      status: 'success',
      message: `Successfully retrieved site with ID ${id}`,
      data: site,
    };
  }

  @Patch(':id')
  @Roles(UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Update a site' })
  @ApiResponse({
    status: 200,
    description: 'The site has been successfully updated.',
    type: SiteEntity,
  })
  @ApiResponse({ status: 404, description: 'Site not found.' })
  async update(
    @Param('id') id: string,
    @Body() updateSiteDto: UpdateSiteDto,
    @CurrentUser() user: CurrentUserPayload,
  ): Promise<{ status: string; message: string; data?: SiteEntity }> {
    const updatedSite = await this.sitesService.update(id, updateSiteDto, user.userId);

    if (!updatedSite) {
      throw new NotFoundException(`Site with ID ${id} not found.`);
    }

    return {
      status: 'success',
      message: `Site with ID ${id} has been successfully updated.`,
      data: updatedSite,
    };
  }

  @Delete(':id')
  @Roles(UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Delete a site' })
  @ApiResponse({ status: 200, description: 'The site has been successfully deleted.' })
  @ApiResponse({ status: 404, description: 'Site not found.' })
  async remove(
    @Param('id') id: string,
    @CurrentUser() user: CurrentUserPayload,
  ): Promise<{ status: string; message: string }> {
    const site = await this.sitesService.remove(id, user.userId);
    if (!site) {
      throw new NotFoundException(`Site with ID ${id} not found.`);
    }

    return {
      status: 'success',
      message: `Site with ID ${id} has been successfully deleted.`,
    };
  }
}
