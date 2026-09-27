/**
 * k6 Load Test — Nandana Textile Platform
 *
 * Stages: ramp up → sustain → ramp down
 *
 * Run (PowerShell from project root):
 *   docker run --rm -i `
 *     --add-host host.docker.internal:host-gateway `
 *     -v "${PWD}/tests/k6:/scripts" `
 *     grafana/k6 run /scripts/load-test.js
 */

import http from 'k6/http';
import { check, group, sleep } from 'k6';
import { Rate, Trend, Counter } from 'k6/metrics';

// ─── Custom Metrics ───────────────────────────────────────────────────────────
const errorRate      = new Rate('errors');
const healthTrend    = new Trend('health_duration',    true);
const productsTrend  = new Trend('products_duration',  true);
const metricsTrend   = new Trend('metrics_duration',   true);
const requestsTotal  = new Counter('requests_total');

// ─── Load Test Config ─────────────────────────────────────────────────────────
export const options = {
  stages: [
    { duration: '10s', target: 10  },  // ramp up to 10 VUs
    { duration: '20s', target: 25  },  // ramp up to 25 VUs
    { duration: '30s', target: 50  },  // hold at 50 VUs
    { duration: '10s', target: 0   },  // ramp down
  ],

  thresholds: {
    // Core SLOs
    http_req_failed:           ['rate<0.01'],    // < 1% error rate (proven: 0% baseline)
    http_req_duration:         ['p(95)<1000'],   // 95% of requests under 1s
    'http_req_duration{type:health}':   ['p(95)<200'],  // health < 200ms
    'http_req_duration{type:products}': ['p(95)<800'],  // products < 800ms

    // Custom metrics
    errors:          ['rate<0.05'],
    health_duration: ['p(95)<200'],
  },
};

// ─── Base URL ─────────────────────────────────────────────────────────────────
// host.docker.internal resolves to your Windows host from inside Docker.
// If running k6 natively (not via Docker), change to: http://localhost:3001
const BASE = 'http://host.docker.internal:3001';

// ─── Shared Headers ───────────────────────────────────────────────────────────
const headers = { 'Content-Type': 'application/json' };

// ─── Default Function (runs once per VU per iteration) ───────────────────────
export default function () {

  // 1. Health check — lightweight, should always be fast
  group('health', () => {
    const res = http.get(`${BASE}/api/v1/health`, {
      tags: { type: 'health' },
    });
    healthTrend.add(res.timings.duration);
    requestsTotal.add(1);

    const ok = check(res, {
      'health -> status 200':          (r) => r.status === 200,
      // TransformInterceptor wraps responses: { success, data: { status }, timestamp }
      'health -> has status field':    (r) => {
        try { return JSON.parse(r.body)?.data?.status !== undefined; }
        catch { return false; }
      },
    });
    errorRate.add(!ok);
  });

  sleep(0.5);

  // 2. Public product listing — tests DB query + serialization
  group('products', () => {
    const res = http.get(`${BASE}/api/v1/products?page=1&limit=10`, {
      headers,
      tags: { type: 'products' },
    });
    productsTrend.add(res.timings.duration);
    requestsTotal.add(1);

    const ok = check(res, {
      'products -> status 200 or 401': (r) => [200, 401].includes(r.status),
      'products -> has body':          (r) => r.body.length > 0,
    });
    errorRate.add(!ok);
  });

  sleep(0.5);

  // 3. Root welcome route — zero DB, just JSON response
  group('root', () => {
    const res = http.get(`${BASE}/`, {
      tags: { type: 'root' },
    });
    requestsTotal.add(1);

    check(res, {
      'root -> status 200': (r) => r.status === 200,
    });
  });

  sleep(0.5);

  // 4. Prometheus metrics endpoint — tests MetricsService scrape
  group('metrics', () => {
    const res = http.get(`${BASE}/metrics`, {
      tags: { type: 'metrics' },
    });
    metricsTrend.add(res.timings.duration);
    requestsTotal.add(1);

    check(res, {
      'metrics -> status 200':              (r) => r.status === 200,
      'metrics -> content-type text/plain': (r) => r.headers['Content-Type']?.includes('text/plain'),
      'metrics -> has textile_ prefix':     (r) => r.body.includes('textile_'),
    });
  });

  sleep(1);
}

// ─── Setup (runs once before test) ───────────────────────────────────────────
export function setup() {
  console.log(`Starting load test against ${BASE}`);
  const res = http.get(`${BASE}/api/v1/health`);
  if (res.status !== 200) {
    console.warn(`Health check failed (status ${res.status}) — backend may not be ready`);
  } else {
    console.log('Backend is reachable');
  }
}

// ─── Teardown (runs once after test) ─────────────────────────────────────────
export function teardown() {
  console.log('Load test complete');
}
