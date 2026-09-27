import { Injectable, OnModuleDestroy } from '@nestjs/common';
import {
  Counter,
  Gauge,
  Histogram,
  Registry,
  collectDefaultMetrics,
} from 'prom-client';

@Injectable()
export class MetricsService implements OnModuleDestroy {
  public readonly registry: Registry;

  public readonly httpRequestsTotal: Counter<string>;
  public readonly httpRequestDuration: Histogram<string>;
  public readonly httpRequestsInProgress: Gauge<string>;

  constructor() {
    this.registry = new Registry();

    // Collect Node.js process metrics
    collectDefaultMetrics({
      register: this.registry,
      prefix: 'textile_',
    });

    // Total HTTP requests
    this.httpRequestsTotal = new Counter({
      name: 'textile_http_requests_total',
      help: 'Total number of HTTP requests',
      labelNames: ['method', 'route', 'status_code'],
      registers: [this.registry],
    });

    // HTTP request duration
    this.httpRequestDuration = new Histogram({
      name: 'textile_http_request_duration_seconds',
      help: 'HTTP request duration in seconds',
      labelNames: ['method', 'route', 'status_code'],
      buckets: [
        0.01,
        0.025,
        0.05,
        0.1,
        0.25,
        0.5,
        1,
        2,
        5,
      ],
      registers: [this.registry],
    });

    // Current requests in progress
    this.httpRequestsInProgress = new Gauge({
      name: 'textile_http_requests_in_progress',
      help: 'Number of HTTP requests currently in progress',
      registers: [this.registry],
    });
  }

  async getMetrics(): Promise<string> {
    return this.registry.metrics();
  }

  getContentType(): string {
    return this.registry.contentType;
  }

  onModuleDestroy() {
    this.registry.clear();
  }
}