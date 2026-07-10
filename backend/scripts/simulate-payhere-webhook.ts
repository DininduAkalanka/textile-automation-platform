/**
 * Simulates PayHere's server-to-server notify so the webhook can be tested
 * without a live PayHere account (plan Session 4.1). Signs payloads with the
 * SAME merchant secret the API uses, so a correctly-signed success is accepted
 * and the tampered/duplicate/bad-signature cases are rejected as they should be.
 *
 * Requires PAYHERE_* env vars to be set (source backend/.env first).
 * Usage: ts-node scripts/simulate-payhere-webhook.ts <orderNumber> <amount>
 */
import { payhereNotifySig } from '../src/payments/payhere.util';

const NOTIFY_URL =
  process.env.PAYHERE_NOTIFY_URL ||
  'http://localhost:3001/api/v1/payments/payhere/notify';
const merchantId = process.env.PAYHERE_MERCHANT_ID ?? '';
const merchantSecret = process.env.PAYHERE_MERCHANT_SECRET ?? '';
const currency = 'LKR';

const orderId = process.argv[2];
const amount = process.argv[3];

if (!orderId || !amount || !merchantId || !merchantSecret) {
  console.error(
    'usage: ts-node scripts/simulate-payhere-webhook.ts <orderNumber> <amount>\n' +
      '(and PAYHERE_MERCHANT_ID / PAYHERE_MERCHANT_SECRET must be set)',
  );
  process.exit(1);
}

const sig = (amt: string, status: string): string =>
  payhereNotifySig({
    merchantId,
    orderId,
    payhereAmount: amt,
    payhereCurrency: currency,
    statusCode: status,
    merchantSecret,
  });

async function post(fields: Record<string, string>): Promise<string> {
  const res = await fetch(NOTIFY_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(fields).toString(),
  });
  return `HTTP ${res.status} ${await res.text()}`;
}

const event = (
  paymentId: string,
  amt: string,
  status: string,
  md5sig?: string,
): Record<string, string> => ({
  merchant_id: merchantId,
  order_id: orderId,
  payment_id: paymentId,
  payhere_amount: amt,
  payhere_currency: currency,
  status_code: status,
  md5sig: md5sig ?? sig(amt, status),
});

async function main() {
  const ts = Date.now();
  const tampered = (Number(amount) + 100).toFixed(2);

  console.log('1) success         ->', await post(event(`SIM-${ts}-ok`, amount, '2')));
  console.log('2) duplicate       ->', await post(event(`SIM-${ts}-ok`, amount, '2')));
  console.log('3) amount mismatch ->', await post(event(`SIM-${ts}-amt`, tampered, '2')));
  console.log(
    '4) bad signature   ->',
    await post(event(`SIM-${ts}-sig`, amount, '2', 'INVALIDSIGNATURE0000000000000000')),
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
