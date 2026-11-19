import { createHash } from 'node:crypto';
import { defineConfig } from 'cypress';

const md5Upper = (value: string) =>
  createHash('md5').update(value, 'utf8').digest('hex').toUpperCase();

export default defineConfig({
  e2e: {
    baseUrl: process.env.CYPRESS_BASE_URL || 'http://localhost:3000',
    viewportWidth: 1280,
    viewportHeight: 800,
    video: false,
    screenshotOnRunFailure: true,
    defaultCommandTimeout: 8000,
    requestTimeout: 8000,
    responseTimeout: 10000,
    retries: {
      runMode: 1,
      openMode: 0,
    },
    setupNodeEvents(on, config) {
      on('task', {
        /**
         * Sign a PayHere server-to-server notify exactly as the gateway does:
         * upper(md5(merchant_id + order_id + amount + currency + status +
         * upper(md5(secret)))). Runs in Node because browsers have no MD5.
         * The secret is the TEST merchant secret of the stack under test
         * (CYPRESS_PAYHERE_SECRET / PAYHERE_MERCHANT_SECRET), never a live one.
         */
        payhereNotifySig(p: {
          merchantId: string;
          orderId: string;
          amount: string;
          currency: string;
          statusCode: string;
        }) {
          const secret =
            process.env.CYPRESS_PAYHERE_SECRET ?? process.env.PAYHERE_MERCHANT_SECRET;
          if (!secret) throw new Error('Set CYPRESS_PAYHERE_SECRET to the test merchant secret');
          return md5Upper(
            p.merchantId + p.orderId + p.amount + p.currency + p.statusCode + md5Upper(secret),
          );
        },
      });
      return config;
    },
  },
  env: {
    apiUrl: process.env.CYPRESS_API_URL || 'http://localhost:3001/api/v1',
    payhereMerchantId:
      process.env.CYPRESS_PAYHERE_MERCHANT_ID || process.env.PAYHERE_MERCHANT_ID || '1221149',
  },
});
