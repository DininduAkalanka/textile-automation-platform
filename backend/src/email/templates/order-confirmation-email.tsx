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
    <EmailLayout preview={`Order ${orderNumber} confirmed — thank you`}>
      <Text style={eyebrow}>ORDER CONFIRMED</Text>
      <Heading style={heading}>Thank you for your order</Heading>
      <Text style={paragraph}>
        Dear {customerName}, your order{' '}
        <span style={orderRef}>{orderNumber}</span> has been confirmed and is
        now moving into production. Your itemised summary is below.
      </Text>

      <Section style={invoiceBox}>
        <Row style={tableHead}>
          <Column style={{ ...colItem, ...headCell }}>
            <Text style={thText}>Item</Text>
          </Column>
          <Column style={{ ...colQty, ...headCell }}>
            <Text style={thText}>Qty</Text>
          </Column>
          <Column style={{ ...colAmount, ...headCell }}>
            <Text style={{ ...thText, textAlign: 'right' as const }}>
              Amount
            </Text>
          </Column>
        </Row>
        {items.map((item, i) => (
          <Row key={i} style={i % 2 === 1 ? tableRowAlt : tableRow}>
            <Column style={colItem}>
              <Text style={tdText}>{item.name}</Text>
            </Column>
            <Column style={colQty}>
              <Text style={tdMuted}>
                {item.quantity} × {item.unitPrice}
              </Text>
            </Column>
            <Column style={colAmount}>
              <Text style={tdAmount}>
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
          </Column>
        </Row>
        <Section style={grandRow}>
          <Row>
            <Column style={colItem}>
              <Text style={grandLabel}>TOTAL</Text>
            </Column>
            <Column style={colAmount}>
              <Text style={grandValue}>
                {currency} {total}
              </Text>
            </Column>
          </Row>
        </Section>
      </Section>

      <Text style={attachNote}>
        A PDF copy of this invoice is attached to this email for your records.
      </Text>

      <Section style={{ textAlign: 'center' as const, margin: '20px 0 6px' }}>
        <Button href={orderUrl} style={button}>
          View your order
        </Button>
      </Section>
      <Text style={muted}>
        We&apos;ll keep you updated as your order moves through production and
        out for delivery. Thank you for choosing Nandana Textile.
      </Text>
    </EmailLayout>
  );
}

const CRIMSON = '#CC0000';
const INK = '#141414';

const eyebrow = {
  fontSize: '11px',
  fontWeight: 700,
  letterSpacing: '1.6px',
  color: CRIMSON,
  margin: '0 0 6px',
};
const heading = {
  fontSize: '22px',
  fontWeight: 700,
  color: INK,
  margin: '0 0 10px',
};
const paragraph = {
  fontSize: '15px',
  color: '#444444',
  lineHeight: '23px',
  margin: '0 0 4px',
};
const orderRef = { color: CRIMSON, fontWeight: 700 };

const invoiceBox = {
  border: '1px solid #e4e1da',
  borderRadius: '12px',
  overflow: 'hidden',
  margin: '20px 0 8px',
};
const tableHead = { backgroundColor: INK };
const headCell = { padding: '9px 14px' };
const tableRow = { backgroundColor: '#ffffff' };
const tableRowAlt = { backgroundColor: '#faf9f7' };
const colItem = { width: '52%', padding: '0 14px' };
const colQty = { width: '26%', padding: '0 14px' };
const colAmount = { width: '22%', padding: '0 14px', textAlign: 'right' as const };
const thText = {
  fontSize: '10px',
  textTransform: 'uppercase' as const,
  letterSpacing: '0.8px',
  fontWeight: 700,
  color: '#ffffff',
  margin: 0,
};
const tdText = { fontSize: '14px', color: INK, margin: '9px 0', fontWeight: 500 };
const tdMuted = { fontSize: '13px', color: '#6b6b6b', margin: '9px 0' };
const tdAmount = {
  fontSize: '14px',
  color: INK,
  margin: '9px 0',
  fontWeight: 600,
  textAlign: 'right' as const,
};
const invoiceHr = { borderColor: '#e4e1da', margin: '4px 14px 8px' };
const totalsLabel = {
  fontSize: '13px',
  color: '#6b6b6b',
  margin: '3px 0',
};
const totalsValue = {
  fontSize: '13px',
  color: '#333333',
  margin: '3px 0',
  textAlign: 'right' as const,
};
const grandRow = {
  backgroundColor: CRIMSON,
  padding: '10px 14px',
  marginTop: '10px',
};
const grandLabel = {
  fontSize: '13px',
  fontWeight: 700,
  letterSpacing: '0.5px',
  color: '#ffffff',
  margin: 0,
};
const grandValue = {
  fontSize: '15px',
  fontWeight: 700,
  color: '#ffffff',
  margin: 0,
  textAlign: 'right' as const,
};
const attachNote = {
  fontSize: '13px',
  color: '#6b6b6b',
  lineHeight: '19px',
  margin: '14px 0 0',
};
const button = {
  backgroundColor: CRIMSON,
  borderRadius: '10px',
  color: '#ffffff',
  fontSize: '14px',
  fontWeight: 600,
  letterSpacing: '0.3px',
  textDecoration: 'none',
  padding: '13px 30px',
  display: 'inline-block',
};
const muted = { fontSize: '13px', color: '#888888', lineHeight: '20px' };
