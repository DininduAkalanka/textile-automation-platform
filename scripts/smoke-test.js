/**
 * Production / Staging Post-Deploy Smoke Test
 * Validates live system availability, database connectivity, and AI service health.
 *
 * Usage:
 *   API_URL=https://api.yourdomain.com/api/v1 FRONTEND_URL=https://yourdomain.com node scripts/smoke-test.js
 */

const API_URL = process.env.API_URL || 'http://localhost:3001/api/v1';
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';
const AI_URL = process.env.AI_URL || 'http://localhost:8000';

async function checkEndpoint(name, url, expectedStatus = 200) {
  try {
    const res = await fetch(url);
    if (res.status === expectedStatus || (expectedStatus === 200 && res.ok)) {
      console.log(`  ✅ [${name}] ${url} -> HTTP ${res.status}`);
      return true;
    } else {
      console.error(`  ❌ [${name}] ${url} -> Expected HTTP ${expectedStatus}, got ${res.status}`);
      return false;
    }
  } catch (err) {
    console.error(`  ❌ [${name}] ${url} -> Network Error: ${err.message}`);
    return false;
  }
}

async function runSmokeTests() {
  console.log('🚀 Starting Post-Deployment Smoke Verification...\n');

  let allPassed = true;

  // 1. Frontend Homepage Check
  allPassed = (await checkEndpoint('Frontend Storefront', FRONTEND_URL)) && allPassed;

  // 2. Backend Health Check
  allPassed = (await checkEndpoint('Backend API Health', `${API_URL}/health`)) && allPassed;

  // 3. Products Catalog Availability
  allPassed = (await checkEndpoint('Products Catalog API', `${API_URL}/products?limit=1`)) && allPassed;

  // 4. AI Microservice Health Check
  allPassed = (await checkEndpoint('AI Microservice Health', `${AI_URL}/health`)) && allPassed;

  console.log('\n────────────────────────────────────────────────────────────');
  if (allPassed) {
    console.log('🎉 SMOKE TEST PASSED: All live endpoints are responsive and healthy!');
    process.exitCode = 0;
  } else {
    console.error('💥 SMOKE TEST FAILED: One or more endpoints failed health verification.');
    process.exitCode = 1;
  }
}

runSmokeTests();
