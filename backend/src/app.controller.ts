import { Controller, Get } from '@nestjs/common';
import { PrismaService } from './prisma/prisma.service';

@Controller()
export class AppController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  getHello() {
    return {
      message: 'Welcome to the Smart Textile E-Commerce API',
      status: 'online',
      version: '1.0.0',
    };
  }

  /**
   * GET /api/v1/health (plan Session 0.1).
   *
   * Actually touches the database rather than just returning 200. A process that
   * is up but cannot reach Postgres is not healthy, and a health check unable to
   * tell the difference is worse than none: Phase 10 wires this to health-checked
   * releases and the uptime monitor, so it has to mean something.
   */
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
}
