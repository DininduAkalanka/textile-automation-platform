import { Controller, Get, Res } from '@nestjs/common';
import type { Response } from 'express';
import { Public } from '../common/decorators/public.decorator';
import { MetricsService } from './metrics.service';

@Public()
@Controller('metrics')
export class MetricsController {
  constructor(private readonly metricsService: MetricsService) {}

  @Get()
  async getMetrics(@Res() response: Response) {
    response.setHeader(
      'Content-Type',
      this.metricsService.getContentType(),
    );

    response.send(await this.metricsService.getMetrics());
  }
}