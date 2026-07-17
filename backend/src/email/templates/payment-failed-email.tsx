import { Button, Heading, Section, Text } from '@react-email/components';
import { EmailLayout } from './components/email-layout';

export function PaymentFailedEmail({
  customerName,
  orderNumber,
  retryUrl,
}: {
  customerName: string;
  orderNumber: string;
  retryUrl: string;
}) {
  return (
    <EmailLayout preview={`Payment for order ${orderNumber} didn't go through`}>
      <Heading style={heading}>Payment didn&apos;t go through</Heading>
      <Text style={paragraph}>
        Hi {customerName}, the payment for your order{' '}
        <strong>{orderNumber}</strong> was unsuccessful. Nothing was charged,
        and your order is still saved — you can try paying again whenever
        you&apos;re ready.
      </Text>
      <Section style={{ textAlign: 'center' as const, margin: '24px 0 8px' }}>
        <Button href={retryUrl} style={button}>
          View order &amp; retry payment
        </Button>
      </Section>
      <Text style={muted}>
        If you keep having trouble, reply to your order in the app or contact us
        and we&apos;ll help you complete it another way.
      </Text>
    </EmailLayout>
  );
}

const heading = { fontSize: '20px', color: '#991b1b', margin: '16px 0 8px' };
const paragraph = { fontSize: '15px', color: '#444444', lineHeight: '22px' };
const button = {
  backgroundColor: '#4f46e5',
  borderRadius: '10px',
  color: '#ffffff',
  fontSize: '14px',
  fontWeight: 600,
  textDecoration: 'none',
  padding: '12px 24px',
  display: 'inline-block',
};
const muted = { fontSize: '13px', color: '#888888', lineHeight: '20px' };
