/* eslint-disable @typescript-eslint/no-unsafe-return */
import {
  Controller,
  Get,
  Param,
  Patch,
  Delete,
  Body,
  Post,
  UseGuards,
  UseInterceptors,
  UploadedFiles,
} from '@nestjs/common';
import { ApiOkResponse, ApiTags, ApiOperation, ApiBearerAuth, ApiConsumes } from '@nestjs/swagger';
import { UsersService } from './users.service';
import { UpdateUserDto } from './dto/update-user.dto';
import { CreateUserDto } from './dto/create-user.dto';
import { UserEntity } from './entities/user.entity';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { OptionalJwtAuthGuard } from '../../common/guards/optional-jwt.guard';
import { CurrentUser, CurrentUserPayload } from '../../common/decorators/current-user.decorator';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { CloudinaryService } from '../cloudinary/cloudinary.service';
import { UploadApiResponse } from 'cloudinary';
import { RegisterClientPersonalDto } from './dto/register-client-personal.dto';
import { RegisterClientBusinessDto } from './dto/register-client-business.dto';
import { RegisterSupplierDto } from './dto/register-supplier.dto';
import { RegisterSiteManagerDto } from './dto/register-site-manager.dto';
import { VendorRequestDto } from './dto/vendor-request.dto';
import { ReplyVendorRequestDto } from './dto/reply-vendor-request.dto';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '@prisma/client';

@ApiTags('Users')
@Controller('users')
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly cloudinaryService: CloudinaryService,
  ) {}

  @Post('register')
  @UseGuards(OptionalJwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Register a new user',
    description: 'Public for CLIENTs. Token required for SUPPLIER and SITE_MANAGER roles.',
  })
  async register(@Body() dto: CreateUserDto, @CurrentUser() user?: CurrentUserPayload) {
    const creatorId = user?.userId;
    return this.usersService.register(dto, creatorId);
  }

  @Post('register/client/personal')
  @UseInterceptors(FileFieldsInterceptor([{ name: 'nationalIdDocument', maxCount: 1 }]))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Register a new personal client' })
  @ApiOkResponse({ description: 'Client registered successfully' })
  async registerClientPersonal(
    @Body() dto: RegisterClientPersonalDto,
    @UploadedFiles() files: { nationalIdDocument?: Express.Multer.File[] },
  ) {
    let nationalIdUrl: string | undefined;
    if (files.nationalIdDocument?.[0]) {
      const result = (await this.cloudinaryService.uploadFile(
        files.nationalIdDocument[0],
        'national-ids',
      )) as UploadApiResponse;
      nationalIdUrl = result.secure_url;
    }
    return this.usersService.registerClientPersonal(dto, nationalIdUrl);
  }

  @Post('register/client/business')
  @UseInterceptors(
    FileFieldsInterceptor([
      { name: 'businessCertificateDocument', maxCount: 1 },
      { name: 'nationalIdDocument', maxCount: 1 },
    ]),
  )
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Register a new business client' })
  @ApiOkResponse({ description: 'Client registered successfully' })
  async registerClientBusiness(
    @Body() dto: RegisterClientBusinessDto,
    @UploadedFiles()
    files: {
      businessCertificateDocument?: Express.Multer.File[];
      nationalIdDocument?: Express.Multer.File[];
    },
  ) {
    let businessCertificateUrl: string | undefined;
    let nationalIdUrl: string | undefined;

    if (files.businessCertificateDocument?.[0]) {
      const result = (await this.cloudinaryService.uploadFile(
        files.businessCertificateDocument[0],
        'business-certificates',
      )) as UploadApiResponse;
      businessCertificateUrl = result.secure_url;
    }

    if (files.nationalIdDocument?.[0]) {
      const result = (await this.cloudinaryService.uploadFile(
        files.nationalIdDocument[0],
        'national-ids',
      )) as UploadApiResponse;
      nationalIdUrl = result.secure_url;
    }

    return this.usersService.registerClientBusiness(dto, businessCertificateUrl, nationalIdUrl);
  }

  @Post('register/supplier')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SUPER_ADMIN, UserRole.SITE_MANAGER)
  @ApiBearerAuth()
  @UseInterceptors(
    FileFieldsInterceptor([
      { name: 'businessCertificateDocument', maxCount: 1 },
      { name: 'nationalIdDocument', maxCount: 1 },
    ]),
  )
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Register a new supplier' })
  @ApiOkResponse({ description: 'Supplier registered successfully' })
  async registerSupplier(
    @Body() dto: RegisterSupplierDto,
    @UploadedFiles()
    files: {
      businessCertificateDocument?: Express.Multer.File[];
      nationalIdDocument?: Express.Multer.File[];
    },
    @CurrentUser() user: CurrentUserPayload,
  ) {
    const creatorId = user.userId;
    let businessCertificateUrl: string | undefined;
    let nationalIdUrl: string | undefined;

    if (files.businessCertificateDocument?.[0]) {
      const result = (await this.cloudinaryService.uploadFile(
        files.businessCertificateDocument[0],
        'business-certificates',
      )) as UploadApiResponse;
      businessCertificateUrl = result.secure_url;
    }

    if (files.nationalIdDocument?.[0]) {
      const result = (await this.cloudinaryService.uploadFile(
        files.nationalIdDocument[0],
        'national-ids',
      )) as UploadApiResponse;
      nationalIdUrl = result.secure_url;
    }

    return this.usersService.registerSupplier(
      dto,
      businessCertificateUrl,
      nationalIdUrl,
      creatorId,
    );
  }

  @Post('register/sitemanager')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SUPER_ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Register a new site manager' })
  @ApiOkResponse({ description: 'Site manager registered successfully' })
  registerSiteManager(
    @Body() dto: RegisterSiteManagerDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    const creatorId = user.userId;
    return this.usersService.registerSiteManager(dto, creatorId);
  }

  @Post('register/vendor')
  @UseInterceptors(
    FileFieldsInterceptor([
      { name: 'businessCertificateDocument', maxCount: 1 },
      { name: 'nationalIdDocument', maxCount: 1 },
    ]),
  )
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Register a new vendor (self-registration)' })
  @ApiOkResponse({ description: 'Vendor registered successfully' })
  async registerVendor(
    @Body() dto: RegisterSupplierDto,
    @UploadedFiles()
    files: {
      businessCertificateDocument?: Express.Multer.File[];
      nationalIdDocument?: Express.Multer.File[];
    },
  ) {
    let businessCertificateUrl: string | undefined;
    let nationalIdUrl: string | undefined;

    if (files.businessCertificateDocument?.[0]) {
      const result = (await this.cloudinaryService.uploadFile(
        files.businessCertificateDocument[0],
        'business-certificates',
      )) as UploadApiResponse;
      businessCertificateUrl = result.secure_url;
    }

    if (files.nationalIdDocument?.[0]) {
      const result = (await this.cloudinaryService.uploadFile(
        files.nationalIdDocument[0],
        'national-ids',
      )) as UploadApiResponse;
      nationalIdUrl = result.secure_url;
    }

    return this.usersService.registerSupplier(dto, businessCertificateUrl, nationalIdUrl);
  }

  @Post('vendor-request')
  @ApiOperation({ summary: 'Submit a vendor request' })
  @ApiOkResponse({ description: 'Request submitted successfully' })
  createVendorRequest(@Body() dto: VendorRequestDto) {
    return this.usersService.createVendorRequest(dto);
  }

  @Get('vendor-requests')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SUPER_ADMIN, UserRole.SITE_MANAGER)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get all vendor requests' })
  @ApiOkResponse({ description: 'List of vendor requests retrieved successfully' })
  findAllVendorRequests() {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call
    return this.usersService.findAllVendorRequests();
  }

  @Post('vendor-request/reply')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SUPER_ADMIN, UserRole.SITE_MANAGER)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Reply to a vendor request by email' })
  @ApiOkResponse({ description: 'Reply sent successfully' })
  replyToVendorRequest(@Body() dto: ReplyVendorRequestDto) {
    return this.usersService.replyToVendorRequest(dto);
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Get('profile/completeness')
  @ApiOperation({ summary: 'Check if current user profile is complete' })
  @ApiOkResponse({ description: 'Completeness status and missing fields returned' })
  getProfileCompleteness(@CurrentUser() user: CurrentUserPayload) {
    return this.usersService.getProfileCompleteness(user.userId);
  }

  // Role-specific GET/PUT/DELETE mappings
  @Get('client/personal/:id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get personal client by ID' })
  getClientPersonal(@Param('id') id: string) {
    return this.usersService.findOne(id);
  }

  @Patch('client/personal/:id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update personal client' })
  updateClientPersonal(
    @Param('id') id: string,
    @Body() dto: UpdateUserDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.usersService.update(id, dto, user.userId);
  }

  @Delete('client/personal/:id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete personal client' })
  deleteClientPersonal(@Param('id') id: string, @CurrentUser() user: CurrentUserPayload) {
    return this.usersService.remove(id, user.userId);
  }

  @Get('client/business/:id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get business client by ID' })
  getClientBusiness(@Param('id') id: string) {
    return this.usersService.findOne(id);
  }

  @Patch('client/business/:id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update business client' })
  updateClientBusiness(
    @Param('id') id: string,
    @Body() dto: UpdateUserDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.usersService.update(id, dto, user.userId);
  }

  @Delete('client/business/:id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete business client' })
  deleteClientBusiness(@Param('id') id: string, @CurrentUser() user: CurrentUserPayload) {
    return this.usersService.remove(id, user.userId);
  }

  @Get('supplier/:id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get supplier by ID' })
  getSupplier(@Param('id') id: string) {
    return this.usersService.findOne(id);
  }

  @Patch('supplier/:id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update supplier' })
  updateSupplier(
    @Param('id') id: string,
    @Body() dto: UpdateUserDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.usersService.update(id, dto, user.userId);
  }

  @Delete('supplier/:id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete supplier' })
  deleteSupplier(@Param('id') id: string, @CurrentUser() user: CurrentUserPayload) {
    return this.usersService.remove(id, user.userId);
  }

  @Get('sitemanager/:id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get site manager by ID' })
  getSiteManager(@Param('id') id: string) {
    return this.usersService.findOne(id);
  }

  @Patch('sitemanager/:id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update site manager' })
  updateSiteManager(
    @Param('id') id: string,
    @Body() dto: UpdateUserDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.usersService.update(id, dto, user.userId);
  }

  @Delete('sitemanager/:id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete site manager' })
  deleteSiteManager(@Param('id') id: string, @CurrentUser() user: CurrentUserPayload) {
    return this.usersService.remove(id, user.userId);
  }

  @Get('vendor/:id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get vendor by ID' })
  getVendor(@Param('id') id: string) {
    return this.usersService.findOne(id);
  }

  @Patch('vendor/:id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update vendor' })
  updateVendor(
    @Param('id') id: string,
    @Body() dto: UpdateUserDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.usersService.update(id, dto, user.userId);
  }

  @Delete('vendor/:id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete vendor' })
  deleteVendor(@Param('id') id: string, @CurrentUser() user: CurrentUserPayload) {
    return this.usersService.remove(id, user.userId);
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Get()
  @ApiOkResponse({
    type: [UserEntity],
    description: 'List of all active users',
  })
  @ApiOperation({ summary: 'Get all users' })
  findAll(@CurrentUser() user: CurrentUserPayload) {
    return this.usersService.findAll(user.userId);
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Get(':id')
  @ApiOkResponse({
    type: UserEntity,
    description: 'User details retrieved successfully',
  })
  @ApiOperation({ summary: 'Get user by ID' })
  findOne(@Param('id') id: string) {
    return this.usersService.findOne(id);
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Patch(':id')
  @ApiOkResponse({
    type: UserEntity,
    description: 'User updated successfully',
  })
  @ApiOperation({ summary: 'Update user details' })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateUserDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.usersService.update(id, dto, user.userId);
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Delete(':id')
  @ApiOkResponse({ description: 'User soft deleted successfully' })
  @ApiOperation({
    summary: 'Soft delete user',
    description: 'Marks user as deleted (soft delete) and deactivates the account',
  })
  remove(@Param('id') id: string, @CurrentUser() user: CurrentUserPayload) {
    return this.usersService.remove(id, user.userId);
  }
}
