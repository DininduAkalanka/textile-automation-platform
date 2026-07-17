import { Button, Heading, Section, Text } from '@react-email/components';
import { EmailLayout } from './components/email-layout';

export function PaymentRejectedEmail({
  customerName,
  orderNumber,
  orderUrl,
}: {
  customerName: string;
  orderNumber: string;
  orderUrl: string;
}) {
  return (
    <EmailLayout
      preview={`Payment for order ${orderNumber} could not be verified`}
    >
      <Heading style={heading}>Payment could not be verified</Heading>
      <Text style={paragraph}>
        Hi {customerName}, we couldn&apos;t verify the payment for your order{' '}
        <strong>{orderNumber}</strong>, so it has been marked as unpaid. This
        usually happens when a bank transfer slip is unreadable or the amount
        doesn&apos;t match.
      </Text>
      <Text style={paragraph}>
        Your order is still saved — please contact us or submit the payment
        again to continue.
      </Text>
      <Section style={{ textAlign: 'center' as const, margin: '24px 0 8px' }}>
        <Button href={orderUrl} style={button}>
          View your order
        </Button>
      </Section>
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
