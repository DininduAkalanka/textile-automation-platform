import http from 'k6/http';
import { check } from 'k6';

export const options = {
  scenarios: {
    webhook_burst: {
      executor: 'per-vu-iterations',
      vus: 20,              // 20 concurrent workers
      iterations: 5,        // 100 total webhook requests firing simultaneously
      maxDuration: '30s',
    },
  },
  thresholds: {
    http_req_duration: ['p(95)<1000'],
    http_req_failed: ['rate<0.05'], // Most should succeed or handle gracefully
  },
};

const BASE_URL = __ENV.API_URL || 'http://localhost:3001/api/v1';

export default function () {
  const orderNumber = `SPIKE-ORDER-001`;
  const paymentId = `SPIKE_PAY_${__VU}_${__ITER}`;

  const payload = {
    merchant_id: '1221149',
    order_id: orderNumber,
    payment_id: paymentId,
    payhere_amount: '2500.00',
    payhere_currency: 'LKR',
    status_code: '2', // Completed
    md5sig: 'mock_signature_for_load_test',
    custom_1: 'test_burst_id',
  };

  const params = {
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
  };

  const res = http.post(`${BASE_URL}/payments/payhere/notify`, payload, params);

  check(res, {
    'webhook handled (status 200/201/204/400/404)': (r) =>
      [200, 201, 204, 400, 404].includes(r.status),
  });
}
