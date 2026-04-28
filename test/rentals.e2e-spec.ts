import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/database/prisma.service';
import { InvoicesService } from '../src/modules/invoices/invoices.service';

describe('Rentals (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  // Test Data
  let testSiteId: string;
  let testClientId: string;
  let testManagerId: string;
  let testColdBoxId: string;
  let testRentalId: string;

  const mockInvoicesService = {
    generateRentalInvoice: jest.fn().mockResolvedValue({ id: 'mock-invoice-id', rentalId: '123' }),
    generateOrderInvoice: jest.fn().mockResolvedValue({ id: 'mock-invoice-id', orderId: '456' }),
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(InvoicesService)
      .useValue(mockInvoicesService)
      .compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

    // Mock Auth

    app.use((req: any, res: any, next: any) => {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      if (req.headers['x-mock-user']) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
        req.user = JSON.parse(req.headers['x-mock-user'] as string);
      }
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call
      next();
    });

    await app.init();
    prisma = app.get<PrismaService>(PrismaService);

    await cleanupTestData();
    await setupTestData();
  });

  afterAll(async () => {
    await cleanupTestData();
    await app.close();
  });

  async function cleanupTestData() {
    await prisma.rental.deleteMany();
    await prisma.coldBox.deleteMany();
    await prisma.user.deleteMany();
    await prisma.site.deleteMany();
  }

  async function setupTestData() {
    // Site
    const site = await prisma.site.create({
      data: { name: 'Rental Test Site', location: 'Kigali' },
    });
    testSiteId = site.id;

    // Client
    const client = await prisma.user.create({
      data: {
        email: 'rentalclient@test.com',
        password: 'password',
        firstName: 'Rental',
        lastName: 'Client',
        phone: '+250788000001',
        role: 'CLIENT',
        siteId: testSiteId,
      },
    });
    testClientId = client.id;

    // Manager
    const manager = await prisma.user.create({
      data: {
        email: 'rentalmanager@test.com',
        password: 'password',
        firstName: 'Rental',
        lastName: 'Manager',
        phone: '+250788000002',
        role: 'SITE_MANAGER',
        siteId: testSiteId,
      },
    });
    testManagerId = manager.id;

    // Cold Box
    const coldBox = await prisma.coldBox.create({
      data: {
        identificationNumber: 'CB-TEST-001',
        siteId: testSiteId,
        sizeOrCapacity: '100L',
        location: 'Zone A',
        status: 'AVAILABLE',
      },
    });
    testColdBoxId = coldBox.id;
  }

  it('/rentals (POST) - Request Rental', async () => {
    const createRentalDto = {
      assetType: 'COLD_BOX',
      coldBoxId: testColdBoxId,
      rentalStartDate: new Date().toISOString(),
      rentalEndDate: new Date(Date.now() + 86400000).toISOString(),
      estimatedFee: 50.0,
    };

    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    const response = await request(app.getHttpServer())
      .post('/rentals')
      .set(
        'x-mock-user',
        JSON.stringify({ userId: testClientId, siteId: testSiteId, role: 'CLIENT' }),
      )
      .send(createRentalDto)
      .expect(201);

    expect(response.body).toHaveProperty('id');
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    expect(response.body.status).toBe('REQUESTED');
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
    testRentalId = response.body.id;
  });

  it('/rentals/:id/approve (PATCH) - Approve Rental & Invoice', async () => {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    const response = await request(app.getHttpServer())
      .patch(`/rentals/${testRentalId}/approve`)
      .set(
        'x-mock-user',
        JSON.stringify({ userId: testManagerId, siteId: testSiteId, role: 'SITE_MANAGER' }),
      )
      .expect(200);

    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    expect(response.body.status).toBe('APPROVED');
    expect(mockInvoicesService.generateRentalInvoice).toHaveBeenCalledWith(testRentalId);

    // Check Asset Status
    const asset = await prisma.coldBox.findUnique({ where: { id: testColdBoxId } });
    expect(asset?.status).toBe('RENTED');
  });

  it('/rentals/:id/complete (PATCH) - Complete Rental', async () => {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    const response = await request(app.getHttpServer())
      .patch(`/rentals/${testRentalId}/complete`)
      .set(
        'x-mock-user',
        JSON.stringify({ userId: testManagerId, siteId: testSiteId, role: 'SITE_MANAGER' }),
      )
      .expect(200);

    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    expect(response.body.status).toBe('COMPLETED');

    // Check Asset Status
    const asset = await prisma.coldBox.findUnique({ where: { id: testColdBoxId } });
    expect(asset?.status).toBe('AVAILABLE');
  });
});
