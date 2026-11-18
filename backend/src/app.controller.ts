import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { PrismaService } from './prisma/prisma.service';
import { Public } from './common/decorators/public.decorator';

@Controller()
export class AppController {
  constructor(private readonly prisma: PrismaService) {}

  @Public()
  @Get()
  getHello() {
    return {
      message: 'Welcome to the Smart Textile E-Commerce API',
      status: 'online',
      version: '1.0.0',
    };
  }

  /**
   * GET /api/v1/health
   *
   * Liveness probe. Cheap and non-fatal: returns HTTP 200 so orchestrators
   * (Render, Docker, Kubernetes) do not enter aggressive restart loops if
   * downstream dependencies are temporarily slow or reconnecting.
   */
  @Public()
  @Get('health')
  async getHealth() {
    let database = 'up';

    try {
      await this.prisma.$queryRaw`SELECT 1`;
    } catch {
      database = 'down';
    }

    return {
      status: database === 'up' ? 'ok' : 'degraded',
      database,
      uptime: Math.floor(process.uptime()),
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * GET /api/v1/health/ready
   *
   * Readiness probe (QA-005). Probes database connectivity and returns
   * HTTP 200 OK when ready to serve traffic, or HTTP 503 Service Unavailable
   * when database is disconnected so load balancers avoid routing user traffic.
   */
  @Public()
  @Get('health/ready')
  async getReadiness() {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return {
        status: 'ready',
        database: 'connected',
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      throw new ServiceUnavailableException({
        status: 'not_ready',
        database: 'disconnected',
        message: 'Database connection failed',
        timestamp: new Date().toISOString(),
      });
    }
  }
}
