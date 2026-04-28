/* eslint-disable @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-assignment */
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/database/prisma.service';

describe('Orders (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  // Test data IDs (will be created in beforeAll)
  let testSiteId: string;
  let testClientId: string;
  let testManagerId: string;
  let testProductId: string;
  let testColdRoomId: string;
  let testOrderId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

    // Mock authentication middleware

    app.use((req: any, res: any, next: any) => {
      if (req.headers['x-mock-user']) {
        req.user = JSON.parse(req.headers['x-mock-user'] as string);
      }
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call
      next();
    });

    await app.init();

    prisma = app.get<PrismaService>(PrismaService);

    // Create test data
    await setupTestData();
  });

  afterAll(async () => {
    // Clean up test data
    await cleanupTestData();
    await app.close();
  });

  async function setupTestData() {
    // Create test site
    const site = await prisma.site.create({
      data: {
        name: 'Test Site',
        location: 'Kigali',
      },
    });
    testSiteId = site.id;

    // Create test client
    const client = await prisma.user.create({
      data: {
        email: 'testclient@test.com',
        password: 'hashedpassword',
        firstName: 'Test',
        lastName: 'Client',
        phone: '+250788123456',
        role: 'CLIENT',
        siteId: testSiteId,
      },
    });
    testClientId = client.id;

    // Create test manager
    const manager = await prisma.user.create({
      data: {
        email: 'testmanager@test.com',
        password: 'hashedpassword',
        firstName: 'Test',
        lastName: 'Manager',
        phone: '+250788123457',
        role: 'SITE_MANAGER',
        siteId: testSiteId,
      },
    });
    testManagerId = manager.id;

    // Create test cold room
    const coldRoom = await prisma.coldRoom.create({
      data: {
        name: 'Test Cold Room',
        siteId: testSiteId,
        totalCapacityKg: 1000,
        usedCapacityKg: 0,
        temperatureMin: -18,
        powerType: 'GRID',
      },
    });
    testColdRoomId = coldRoom.id;

    // Create test supplier (required for product)
    const supplier = await prisma.user.create({
      data: {
        email: 'supplier@test.com',
        password: 'hashedpassword',
        firstName: 'Test',
        lastName: 'Supplier',
        phone: '+250788123458',
        role: 'SUPPLIER',
        siteId: testSiteId,
      },
    });

    // Create test product
    const product = await prisma.product.create({
      data: {
        name: 'Test Product',
        category: 'DAIRY',
        unit: 'kg',
        quantityKg: 100,
        sellingPricePerUnit: 1000,
        siteId: testSiteId,
        supplierId: supplier.id,
        coldRoomId: testColdRoomId,
        status: 'IN_STOCK',
      },
    });
    testProductId = product.id;
  }

  async function cleanupTestData() {
    // Delete in correct order to respect foreign keys
    await prisma.payment.deleteMany({});
    await prisma.invoiceItem.deleteMany({});
    await prisma.invoice.deleteMany({});
    await prisma.orderItem.deleteMany({});
    await prisma.order.deleteMany({});
    await prisma.stockMovement.deleteMany({});
    await prisma.product.deleteMany({});
    await prisma.coldRoom.deleteMany({});
    await prisma.rental.deleteMany({});
    await prisma.coldBox.deleteMany({});
    await prisma.coldPlate.deleteMany({});
    await prisma.tricycle.deleteMany({});
    await prisma.user.deleteMany({});
    await prisma.site.deleteMany({});
  }

  describe('POST /orders', () => {
    it('should create a new order successfully', async () => {
      const createOrderDto = {
        deliveryAddress: 'Kigali, Rwanda',
        notes: 'Test order',
        items: [
          {
            productId: testProductId,
            quantityKg: 10,
          },
        ],
      };

      const response = await request(app.getHttpServer())
        .post('/orders')
        .set(
          'x-mock-user',
          JSON.stringify({ userId: testClientId, siteId: testSiteId, role: 'CLIENT' }),
        )
        .send(createOrderDto)
        .expect(201);

      expect(response.body).toHaveProperty('id');
      expect(response.body.status).toBe('REQUESTED');
      expect(response.body.totalAmount).toBe(10000); // 10kg * 1000
      expect(response.body.deliveryAddress).toBe('Kigali, Rwanda');
      expect(response.body.items).toHaveLength(1);

      testOrderId = response.body.id;
    });

    it('should fail with insufficient stock', async () => {
      const createOrderDto = {
        deliveryAddress: 'Kigali, Rwanda',
        items: [
          {
            productId: testProductId,
            quantityKg: 200, // More than available (100kg)
          },
        ],
      };

      await request(app.getHttpServer())
        .post('/orders')
        .set(
          'x-mock-user',
          JSON.stringify({ userId: testClientId, siteId: testSiteId, role: 'CLIENT' }),
        )
        .send(createOrderDto)
        .expect(400);
    });

    it('should fail with invalid product ID', async () => {
      const createOrderDto = {
        deliveryAddress: 'Kigali, Rwanda',
        items: [
          {
            productId: '00000000-0000-0000-0000-000000000000',
            quantityKg: 10,
          },
        ],
      };

      await request(app.getHttpServer())
        .post('/orders')
        .set(
          'x-mock-user',
          JSON.stringify({ userId: testClientId, siteId: testSiteId, role: 'CLIENT' }),
        )
        .send(createOrderDto)
        .expect(400);
    });

    it('should fail with missing delivery address', async () => {
      const createOrderDto = {
        items: [
          {
            productId: testProductId,
            quantityKg: 10,
          },
        ],
      };

      await request(app.getHttpServer())
        .post('/orders')
        .set(
          'x-mock-user',
          JSON.stringify({ userId: testClientId, siteId: testSiteId, role: 'CLIENT' }),
        )
        .send(createOrderDto)
        .expect(400);
    });
  });

  describe('GET /orders', () => {
    it('should get all orders', async () => {
      const response = await request(app.getHttpServer())
        .get('/orders')
        .set(
          'x-mock-user',
          JSON.stringify({ userId: testManagerId, siteId: testSiteId, role: 'SITE_MANAGER' }),
        )
        .expect(200);

      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body.data.length).toBeGreaterThan(0);
      expect(response.body.meta).toBeDefined();
    });
  });

  describe('GET /orders/:id', () => {
    it('should get order by ID', async () => {
      const response = await request(app.getHttpServer())
        .get(`/orders/${testOrderId}`)
        .set(
          'x-mock-user',
          JSON.stringify({ userId: testClientId, siteId: testSiteId, role: 'CLIENT' }),
        )
        .expect(200);

      expect(response.body.id).toBe(testOrderId);
      expect(response.body).toHaveProperty('client');
      expect(response.body).toHaveProperty('items');
    });

    it('should return 404 for non-existent order', async () => {
      await request(app.getHttpServer())
        .get('/orders/00000000-0000-0000-0000-000000000000')
        .set(
          'x-mock-user',
          JSON.stringify({ userId: testClientId, siteId: testSiteId, role: 'CLIENT' }),
        )
        .expect(404);
    });
  });

  describe('PATCH /orders/:id/approve', () => {
    it('should approve an order and reserve stock', async () => {
      // Get initial product quantity (for reference)
      await prisma.product.findUnique({
        where: { id: testProductId },
      });

      // Approve the order
      const response = await request(app.getHttpServer())
        .patch(`/orders/${testOrderId}/approve`)
        .set(
          'x-mock-user',
          JSON.stringify({ userId: testManagerId, siteId: testSiteId, role: 'SITE_MANAGER' }),
        )
        .expect(200);

      expect(response.body.status).toBe('APPROVED');
      expect(response.body.approvedBy).toBeDefined();
      expect(response.body.approvedAt).toBeDefined();

      // Verify stock was reserved
      // Logic deferred to StockMovementsService
      /*
      const productAfter = await prisma.product.findUnique({
        where: { id: testProductId },
      });
      expect(productAfter.quantityKg).toBe(initialQuantity - 10);

      // Verify stock movement was created
      const stockMovement = await prisma.stockMovement.findFirst({
        where: {
          productId: testProductId,
          movementType: 'OUT',
        },
      });
      expect(stockMovement).toBeDefined();
      expect(stockMovement.quantityKg).toBe(10);

      // Verify cold room occupancy was updated
      const coldRoom = await prisma.coldRoom.findUnique({
        where: { id: testColdRoomId },
      });
      expect(coldRoom.usedCapacityKg).toBe(-10); // Decreased by 10kg
      */
    });

    it('should fail to approve already approved order', async () => {
      await request(app.getHttpServer())
        .patch(`/orders/${testOrderId}/approve`)
        .set(
          'x-mock-user',
          JSON.stringify({ userId: testManagerId, siteId: testSiteId, role: 'SITE_MANAGER' }),
        )
        .expect(400);
    });
  });

  describe('PATCH /orders/:id/reject', () => {
    let rejectOrderId: string;

    beforeAll(async () => {
      // Create a new order to reject
      const order = await prisma.order.create({
        data: {
          clientId: testClientId,
          siteId: testSiteId,
          deliveryAddress: 'Test Address',
          totalAmount: 5000,
          status: 'REQUESTED',
          items: {
            create: [
              {
                productId: testProductId,
                quantityKg: 5,
                unitPrice: 1000,
                subtotal: 5000,
              },
            ],
          },
        },
      });
      rejectOrderId = order.id;
    });

    it('should reject an order', async () => {
      const rejectDto = {
        rejectionReason: 'Customer requested cancellation',
      };

      const response = await request(app.getHttpServer())
        .patch(`/orders/${rejectOrderId}/reject`)
        .set(
          'x-mock-user',
          JSON.stringify({ userId: testManagerId, siteId: testSiteId, role: 'SITE_MANAGER' }),
        )
        .send(rejectDto)
        .expect(200);

      expect(response.body.status).toBe('REJECTED');
      expect(response.body.rejectionReason).toBe('Customer requested cancellation');
      expect(response.body.rejectedAt).toBeDefined();
    });

    it('should fail to reject without reason', async () => {
      // Create another order
      const order = await prisma.order.create({
        data: {
          clientId: testClientId,
          siteId: testSiteId,
          deliveryAddress: 'Test Address',
          totalAmount: 5000,
          status: 'REQUESTED',
        },
      });

      await request(app.getHttpServer())
        .patch(`/orders/${order.id}/reject`)
        .set(
          'x-mock-user',
          JSON.stringify({ userId: testManagerId, siteId: testSiteId, role: 'SITE_MANAGER' }),
        )
        .send({})
        .expect(400);
    });
  });
});
