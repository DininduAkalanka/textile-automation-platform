import { createHash } from 'crypto';
import {
  payhereCheckoutHash,
  payhereNotifySig,
  payhereSecretHash,
  formatPayhereAmount,
} from './payhere.util';

const md5 = (s: string) => createHash('md5').update(s, 'utf8').digest('hex');

describe('PayHere hashing', () => {
  const merchantId = '1221149';
  const merchantSecret = 'test-secret';

  it('formats amounts to a fixed 2-decimal string', () => {
    expect(formatPayhereAmount(1000)).toBe('1000.00');
    expect(formatPayhereAmount('9500.5')).toBe('9500.50');
    expect(formatPayhereAmount(0)).toBe('0.00');
  });

  it('secret hash is upper(md5(secret))', () => {
    expect(payhereSecretHash(merchantSecret)).toBe(md5(merchantSecret).toUpperCase());
    expect(payhereSecretHash(merchantSecret)).toMatch(/^[0-9A-F]{32}$/);
  });

  it('checkout hash follows the documented concatenation exactly', () => {
    const amount = '1000.00';
    const currency = 'LKR';
    const orderId = 'TXL-1';
    const expected = md5(
      merchantId + orderId + amount + currency + md5(merchantSecret).toUpperCase(),
    ).toUpperCase();
    expect(
      payhereCheckoutHash({ merchantId, orderId, amount, currency, merchantSecret }),
    ).toBe(expected);
  });

  it('notify signature includes the status code and authenticates a matching callback', () => {
    const sigArgs = {
      merchantId,
      orderId: 'TXL-1',
      payhereAmount: '1000.00',
      payhereCurrency: 'LKR',
      statusCode: '2',
      merchantSecret,
    };
    const sig = payhereNotifySig(sigArgs);
    expect(sig).toMatch(/^[0-9A-F]{32}$/);
    // deterministic
    expect(payhereNotifySig(sigArgs)).toBe(sig);
    // sensitive to a tampered amount
    expect(payhereNotifySig({ ...sigArgs, payhereAmount: '9999.00' })).not.toBe(sig);
    // sensitive to a tampered status
    expect(payhereNotifySig({ ...sigArgs, statusCode: '-1' })).not.toBe(sig);
  });
});
