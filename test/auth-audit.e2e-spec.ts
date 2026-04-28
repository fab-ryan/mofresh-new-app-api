/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from './../src/app.module';
import { PrismaService } from '../src/database/prisma.service';
import { AuditAction } from '@prisma/client';

jest.setTimeout(60000);

describe('Auth & Audit Logs (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  let clientUserId: string;
  let adminAccessToken: string;
  let adminUserId: string;

  const TEST_PASSWORD = process.env.SEED_PASSWORD || 'Password123!';
  const ADMIN_EMAIL = 'admin@mofresh.rw';
  const CLIENT_EMAIL = 'client1@example.rw';

  beforeAll(async () => {
    process.env.ADMIN_EMAIL = 'irakozeflamanc@gmail.com';
    process.env.EMAIL_PASSWORD = 'jzucekrhpqkuoemc';
    process.env.COMPANY_EMAIL = 'info@mofresh.com';

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe());
    app.setGlobalPrefix('api/v1');
    await app.init();

    prisma = app.get<PrismaService>(PrismaService);
  });

  afterAll(async () => {
    if (prisma) await prisma.$disconnect();
    if (app) await app.close();
  });

  describe('Login & Audit Logs', () => {
    it('should login as client (no OTP) and create an audit log', async () => {
      const loginResponse = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email: CLIENT_EMAIL, password: TEST_PASSWORD })
        .expect(201);

      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const clientAccessToken = loginResponse.body.accessToken;
      clientUserId = loginResponse.body.user.id;

      const auditLog = await prisma.auditLog.findFirst({
        where: { userId: clientUserId, action: AuditAction.UPDATE },
        orderBy: { timestamp: 'desc' },
      });

      expect(auditLog).toBeDefined();
    });

    it('should login as admin and create an audit log', async () => {
      const loginResponse = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email: ADMIN_EMAIL, password: TEST_PASSWORD });

      expect(loginResponse.status).toBe(201);

      if (loginResponse.body.status === 'otp_sent') {
        let otpRecord = null;
        for (let i = 0; i < 15; i++) {
          otpRecord = await prisma.otp.findFirst({
            where: { email: ADMIN_EMAIL },
            orderBy: { createdAt: 'desc' },
          });
          if (otpRecord) break;
          await new Promise((r) => setTimeout(r, 1000));
        }

        const verifyResponse = await request(app.getHttpServer())
          .post('/api/v1/auth/verify-otp')
          .send({ email: ADMIN_EMAIL, code: otpRecord?.code })
          .expect(201);

        adminAccessToken = verifyResponse.body.accessToken;
        adminUserId = verifyResponse.body.user?.id;
      } else {
        adminAccessToken = loginResponse.body.accessToken;
        adminUserId = loginResponse.body.user.id;
      }
      expect(adminAccessToken).toBeDefined();
    }, 45000);
  });

  describe('Sites & Audit Logs', () => {
    it('should create a site and log the action', async () => {
      expect(adminAccessToken).toBeDefined();
      const siteResponse = await request(app.getHttpServer())
        .post('/api/v1/sites')
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .send({ name: `Test Site ${Date.now()}`, location: 'Test Location' })
        .expect(201);

      const auditLog = await prisma.auditLog.findFirst({
        where: { entityId: siteResponse.body.data.id, action: AuditAction.CREATE },
      });
      expect(auditLog).toBeDefined();
    });
  });

  describe('Logout & Audit Logs', () => {
    it('should logout admin and log the action', async () => {
      expect(adminAccessToken).toBeDefined();
      await request(app.getHttpServer())
        .post('/api/v1/auth/logout')
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .expect(201);

      const auditLog = await prisma.auditLog.findFirst({
        where: { userId: adminUserId, action: AuditAction.UPDATE },
        orderBy: { timestamp: 'desc' },
      });
      expect((auditLog?.details as any).action).toBe('LOGOUT');
    });
  });
});
