/* eslint-disable @typescript-eslint/no-unused-vars */
import { Controller, Post, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { SeederService } from './seeder.service';

@Controller('seeder')
export class SeederController {
  constructor(private readonly seederService: SeederService) {}

  @Post('seed')
  @ApiOperation({
    summary: 'Manually trigger database seeding',
    description:
      'Seeds the database with initial data. Only accessible by Super Admins. Should only be used once or in development environment.',
  })
  @ApiResponse({
    status: 200,
    description: 'Database seeded successfully',
    schema: {
      example: {
        success: true,
        message: 'Database seeding completed successfully!',
        data: {
          superAdmins: [{ email: 'admin@mofresh.rw', password: 'Password123!' }],
          siteManagers: [{ email: 'manager1@mofresh.rw', password: 'Password123!' }],
          suppliers: [{ email: 'supplier1@mofresh.rw', password: 'Password123!' }],
          clients: [{ email: 'client1@example.rw', password: 'Password123!' }],
        },
      },
    },
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Invalid or missing authentication token',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Only Super Admins can access this endpoint',
  })
  @ApiResponse({
    status: 500,
    description: 'Internal server error during seeding',
  })
  async seedDatabase() {
    return this.seederService.seedDatabase();
  }
}
