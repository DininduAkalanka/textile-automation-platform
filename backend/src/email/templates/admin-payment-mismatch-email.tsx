import { Heading, Section, Text } from '@react-email/components';
import { EmailLayout } from './components/email-layout';

/**
 * Admin alert: a PayHere webhook arrived with a VALID signature but the WRONG
 * amount — either tampering or a gateway misconfiguration. Previously this was
 * only a server log line that nobody read.
 */
export function AdminPaymentMismatchEmail({
  orderNumber,
  expectedAmount,
  receivedAmount,
  currency,
  transactionId,
}: {
  orderNumber: string;
  expectedAmount: string;
  receivedAmount: string;
  currency: string;
  transactionId: string;
}) {
  return (
    <EmailLayout preview={`⚠ Payment amount mismatch on order ${orderNumber}`}>
      <Heading style={heading}>⚠ Payment amount mismatch</Heading>
      <Text style={paragraph}>
        A correctly-signed PayHere notification arrived for order{' '}
        <strong>{orderNumber}</strong>, but the paid amount does not match the
        order total. The payment was <strong>NOT</strong> marked completed.
      </Text>
      <Section style={detailBox}>
        <Text style={detail}>
          Expected: {currency} {expectedAmount}
        </Text>
        <Text style={detail}>
          Received: {currency} {receivedAmount}
        </Text>
        <Text style={detail}>Gateway transaction: {transactionId}</Text>
      </Section>
      <Text style={paragraph}>
        Review this order in Admin → Payments before taking any manual action.
      </Text>
    </EmailLayout>
  );
}

const heading = { fontSize: '20px', color: '#991b1b', margin: '16px 0 8px' };
const paragraph = { fontSize: '15px', color: '#444444', lineHeight: '22px' };
const detailBox = {
  backgroundColor: '#fef2f2',
  border: '1px solid #fecaca',
  borderRadius: '12px',
  padding: '12px 20px',
  margin: '16px 0',
};
const detail = {
  fontSize: '14px',
  color: '#7f1d1d',
  margin: '4px 0',
  fontFamily: 'Consolas, Menlo, monospace',
};
