# Nandana Textile — Load Testing Suite (k6)

This directory contains the performance and load testing scripts designed to audit and verify **NFR-001** (response time < 2000ms under 100 concurrent users) and payment webhook burst resilience.

---

## 📊 Test Scenarios

### 1. Mixed E-Commerce Traffic (`scenarios.js`)
Simulates realistic customer distribution over a 5-minute ramp-up curve to 100 concurrent Virtual Users (VUs):
- **70% Catalog Browse** (`GET /api/v1/products`)
- **20% Product Details & Reviews** (`GET /api/v1/products/:id`, `GET /api/v1/reviews/product/:id`)
- **10% Checkout & Authentication** (`POST /api/v1/auth/login`, `GET /api/v1/orders`)

#### Thresholds Verified:
- `p(95)` response time < **2000ms** (NFR-001)
- `p(99)` response time < **3000ms**
- Error rate < **1.0%**

### 2. Payment Webhook Burst (`webhook-spike.js`)
Fires 100 concurrent signed PayHere webhook notifications simultaneously to prove:
- Webhook signature validation throughput
- Row-level database locking (`SELECT ... FOR UPDATE`)
- Ledger idempotency under high concurrency

---

## 🚀 How to Run Locally

### Prerequisites
Install [k6](https://k6.io/docs/get-started/installation/):

```bash
# Windows (winget or choco)
winget install k6 --source winget
# or
choco install k6

# macOS
brew install k6

# Linux
sudo apt-get install k6
```

### Run the Mixed Traffic Scenario:
```bash
k6 run scripts/load/scenarios.js
```

### Run with Custom API URL:
```bash
API_URL=http://localhost:3001/api/v1 k6 run scripts/load/scenarios.js
```

### Run the Webhook Spike Test:
```bash
k6 run scripts/load/webhook-spike.js
```

---

## 📈 Post-Test Invariant Verification
After executing any load test, verify the single source of truth stock ledger remains 100% reconciled:

```bash
cd backend
npm run reconcile
```
