import {
  Button,
  Column,
  Heading,
  Hr,
  Row,
  Section,
  Text,
} from '@react-email/components';
import { EmailLayout } from './components/email-layout';

export interface OrderConfirmationEmailProps {
  customerName: string;
  orderNumber: string;
  orderUrl: string;
  items: {
    name: string;
    quantity: number;
    unitPrice: string;
    totalPrice: string;
  }[];
  subtotal: string;
  shippingCost: string;
  tax: string;
  total: string;
  currency: string;
}

/** The "invoice" email: itemized order summary sent once payment confirms. */
export function OrderConfirmationEmail(props: OrderConfirmationEmailProps) {
  const {
    customerName,
    orderNumber,
    orderUrl,
    items,
    subtotal,
    shippingCost,
    tax,
    total,
    currency,
  } = props;

  return (
    <EmailLayout preview={`Order ${orderNumber} confirmed — thank you!`}>
      <Heading style={heading}>Order confirmed 🎉</Heading>
      <Text style={paragraph}>
        Thank you, {customerName}! Your order <strong>{orderNumber}</strong> is
        confirmed and heading into production. Here&apos;s your summary:
      </Text>

      <Section style={invoiceBox}>
        <Row style={tableHead}>
          <Column style={colItem}>
            <Text style={thText}>Item</Text>
          </Column>
          <Column style={colQty}>
            <Text style={thText}>Qty</Text>
          </Column>
          <Column style={colAmount}>
            <Text style={thText}>Amount</Text>
          </Column>
        </Row>
        {items.map((item, i) => (
          <Row key={i} style={tableRow}>
            <Column style={colItem}>
              <Text style={tdText}>{item.name}</Text>
            </Column>
            <Column style={colQty}>
              <Text style={tdText}>
                {item.quantity} × {item.unitPrice}
              </Text>
            </Column>
            <Column style={colAmount}>
              <Text style={tdText}>
                {currency} {item.totalPrice}
              </Text>
            </Column>
          </Row>
        ))}
        <Hr style={invoiceHr} />
        <Row>
          <Column style={colItem}>
            <Text style={totalsLabel}>Subtotal</Text>
            <Text style={totalsLabel}>Shipping</Text>
            <Text style={totalsLabel}>Tax</Text>
            <Text style={grandTotalLabel}>Total</Text>
          </Column>
          <Column style={colAmount}>
            <Text style={totalsValue}>
              {currency} {subtotal}
            </Text>
            <Text style={totalsValue}>
              {currency} {shippingCost}
            </Text>
            <Text style={totalsValue}>
              {currency} {tax}
            </Text>
            <Text style={grandTotalValue}>
              {currency} {total}
            </Text>
          </Column>
        </Row>
      </Section>

      <Section style={{ textAlign: 'center' as const, margin: '24px 0 8px' }}>
        <Button href={orderUrl} style={button}>
          View your order
        </Button>
      </Section>
      <Text style={muted}>
        We&apos;ll notify you as your order moves through production and out for
        delivery.
      </Text>
    </EmailLayout>
  );
}

const heading = { fontSize: '20px', color: '#111111', margin: '16px 0 8px' };
const paragraph = { fontSize: '15px', color: '#444444', lineHeight: '22px' };
const invoiceBox = {
  backgroundColor: '#fafafa',
  border: '1px solid #e4e4e7',
  borderRadius: '12px',
  padding: '16px 20px',
  margin: '16px 0',
};
const tableHead = { borderBottom: '1px solid #e4e4e7' };
const tableRow = {};
const colItem = { width: '55%' };
const colQty = { width: '20%' };
const colAmount = { width: '25%', textAlign: 'right' as const };
const thText = {
  fontSize: '11px',
  textTransform: 'uppercase' as const,
  letterSpacing: '0.05em',
  color: '#a1a1aa',
  margin: '4px 0',
};
const tdText = { fontSize: '14px', color: '#333333', margin: '6px 0' };
const invoiceHr = { borderColor: '#e4e4e7', margin: '12px 0' };
const totalsLabel = { fontSize: '13px', color: '#71717a', margin: '4px 0' };
const totalsValue = {
  fontSize: '13px',
  color: '#333333',
  margin: '4px 0',
  textAlign: 'right' as const,
};
const grandTotalLabel = {
  fontSize: '15px',
  fontWeight: 700,
  color: '#111111',
  margin: '8px 0 0',
};
const grandTotalValue = {
  fontSize: '15px',
  fontWeight: 700,
  color: '#111111',
  margin: '8px 0 0',
  textAlign: 'right' as const,
};
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
