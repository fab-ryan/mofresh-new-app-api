import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from './../src/app.module';

describe('AppController (e2e)', () => {
  let app: INestApplication;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api/v1');
    await app.init();
  });

  it('/ (GET)', async () => {
    const server = app.getHttpServer() as unknown;
    const response = await request(server as Parameters<typeof request>[0])
      .get('/api/v1')
      .expect(200);

    expect(response.body).toHaveProperty('status', 'success');
  });

  afterAll(async () => {
    await app.close();
  });
});
