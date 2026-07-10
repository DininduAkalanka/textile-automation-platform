import { createHash } from 'crypto';

/**
 * PayHere hashing (per PayHere Checkout/Notify spec). The merchant secret is
 * hashed and never leaves the server. NOTE: validate these against a live
 * PayHere sandbox transaction before going to production — the formula is
 * stable but a real round-trip is the only ground truth.
 */

const md5Hex = (input: string): string =>
  createHash('md5').update(input, 'utf8').digest('hex');

/** upper(md5(merchant_secret)) — the shared secret component of every hash. */
export function payhereSecretHash(merchantSecret: string): string {
  return md5Hex(merchantSecret).toUpperCase();
}

/** PayHere requires amounts as a fixed 2-decimal string, no thousands separators. */
export function formatPayhereAmount(amount: number | string): string {
  return Number(amount).toFixed(2);
}

/**
 * Hash the frontend submits with the checkout form:
 * upper(md5(merchant_id + order_id + amount + currency + upper(md5(secret))))
 */
export function payhereCheckoutHash(params: {
  merchantId: string;
  orderId: string;
  amount: string;
  currency: string;
  merchantSecret: string;
}): string {
  const { merchantId, orderId, amount, currency, merchantSecret } = params;
  return md5Hex(
    merchantId + orderId + amount + currency + payhereSecretHash(merchantSecret),
  ).toUpperCase();
}

/**
 * Signature PayHere sends on the server-to-server notify; we recompute and
 * compare to authenticate the callback:
 * upper(md5(merchant_id + order_id + payhere_amount + payhere_currency + status_code + upper(md5(secret))))
 */
export function payhereNotifySig(params: {
  merchantId: string;
  orderId: string;
  payhereAmount: string;
  payhereCurrency: string;
  statusCode: string;
  merchantSecret: string;
}): string {
  const {
    merchantId,
    orderId,
    payhereAmount,
    payhereCurrency,
    statusCode,
    merchantSecret,
  } = params;
  return md5Hex(
    merchantId +
      orderId +
      payhereAmount +
      payhereCurrency +
      statusCode +
      payhereSecretHash(merchantSecret),
  ).toUpperCase();
}
