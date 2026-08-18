import http from 'k6/http';
import { check, group, sleep } from 'k6';
import { Counter, Rate, Trend } from 'k6/metrics';

// Custom metrics for Nandana Textile performance audit (NFR-001)
const errorRate = new Rate('errors');
const browseTrend = new Trend('browse_duration');
const detailTrend = new Trend('detail_duration');
const checkoutTrend = new Trend('checkout_duration');

export const options = {
  stages: [
    { duration: '30s', target: 25 },  // Warmup ramp to 25 VUs
    { duration: '1m', target: 50 },   // Moderate traffic ramp to 50 VUs
    { duration: '2m', target: 100 },  // Peak load: 100 concurrent Virtual Users (NFR-001)
    { duration: '1m', target: 100 },  // Sustained peak load
    { duration: '30s', target: 0 },   // Ramp down
  ],
  thresholds: {
    // NFR-001 requirement: 95th percentile response time must be under 2000ms
    http_req_duration: ['p(95)<2000', 'p(99)<3000'],
    // Error rate must remain under 1% under full load
    errors: ['rate<0.01'],
    http_req_failed: ['rate<0.01'],
  },
};

const BASE_URL = __ENV.API_URL || 'http://localhost:3001/api/v1';

export default function () {
  const rand = Math.random();

  // Scenario 1: 70% of users browse the product catalog & categories
  if (rand < 0.70) {
    group('Catalog Browse (70%)', function () {
      const page = Math.floor(Math.random() * 3) + 1;
      const res = http.get(`${BASE_URL}/products?page=${page}&limit=12`);
      
      browseTrend.add(res.timings.duration);
      const ok = check(res, {
        'status is 200': (r) => r.status === 200,
        'has products array': (r) => {
          try {
            const body = JSON.parse(r.body);
            return Array.isArray(body.data?.products || body.products);
          } catch {
            return false;
          }
        },
      });
      errorRate.add(!ok);
    });
  } 
  // Scenario 2: 20% of users view specific product details & reviews
  else if (rand < 0.90) {
    group('Product Details & Reviews (20%)', function () {
      // First fetch product list to get a valid product ID
      const listRes = http.get(`${BASE_URL}/products?limit=5`);
      let productId = null;
      try {
        const body = JSON.parse(listRes.body);
        const prods = body.data?.products || body.products || [];
        if (prods.length > 0) {
          productId = prods[Math.floor(Math.random() * prods.length)].id;
        }
      } catch {}

      if (productId) {
        const detailRes = http.get(`${BASE_URL}/products/${productId}`);
        detailTrend.add(detailRes.timings.duration);
        const ok = check(detailRes, {
          'detail status is 200': (r) => r.status === 200,
        });
        errorRate.add(!ok);

        // Fetch reviews for that product
        const reviewsRes = http.get(`${BASE_URL}/reviews/product/${productId}`);
        check(reviewsRes, {
          'reviews status is 200': (r) => r.status === 200,
        });
      }
    });
  } 
  // Scenario 3: 10% of users perform authentication and cart/order checkout quote
  else {
    group('Checkout & Auth Flow (10%)', function () {
      const loginPayload = JSON.stringify({
        identifier: 'customer@example.com',
        password: 'Customer@123456',
      });

      const loginRes = http.post(`${BASE_URL}/auth/login`, loginPayload, {
        headers: { 'Content-Type': 'application/json' },
      });

      checkoutTrend.add(loginRes.timings.duration);
      const loginOk = check(loginRes, {
        'login status is 200/201': (r) => r.status === 200 || r.status === 201,
      });
      errorRate.add(!loginOk);

      let token = null;
      try {
        const body = JSON.parse(loginRes.body);
        token = (body.data || body).accessToken;
      } catch {}

      if (token) {
        const ordersRes = http.get(`${BASE_URL}/orders?limit=5`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        check(ordersRes, {
          'orders query status is 200': (r) => r.status === 200,
        });
      }
    });
  }

  // Think time between actions (1-3 seconds)
  sleep(Math.random() * 2 + 1);
}
