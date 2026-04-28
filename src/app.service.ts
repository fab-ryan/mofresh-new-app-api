import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  getRoot(): object {
    return {
      status: 'success',
      message: 'MoFresh API',
      version: '1.0.0',
      documentation: '/api/docs',
      timestamp: new Date().toISOString(),
    };
  }

  getHealth(): object {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: process.env.NODE_ENV || 'development',
    };
  }
}
