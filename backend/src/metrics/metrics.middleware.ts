import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { MetricsService } from './metrics.service';

@Injectable()
export class MetricsMiddleware implements NestMiddleware {
  constructor(private readonly metricsService: MetricsService) {}

  use(req: Request, res: Response, next: NextFunction) {
    const start = process.hrtime.bigint();

    this.metricsService.httpRequestsInProgress.inc();

    res.on('finish', () => {
      const end = process.hrtime.bigint();

      const durationInSeconds =
        Number(end - start) / 1_000_000_000;

      const method = req.method;

      const expressReq = req as Request & { route?: { path?: string } };
      const routePath = expressReq.route?.path;
      const route =
        (routePath ? `${req.baseUrl || ''}${routePath}` : req.baseUrl || req.path) ||
        'unknown';

      const statusCode = res.statusCode.toString();

      this.metricsService.httpRequestsTotal.inc({
        method,
        route,
        status_code: statusCode,
      });

      this.metricsService.httpRequestDuration.observe(
        {
          method,
          route,
          status_code: statusCode,
        },
        durationInSeconds,
      );

      this.metricsService.httpRequestsInProgress.dec();
    });

    next();
  }
}