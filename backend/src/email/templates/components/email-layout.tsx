import { ReactNode } from 'react';
import {
  Html,
  Head,
  Preview,
  Body,
  Container,
  Section,
  Row,
  Column,
  Text,
} from '@react-email/components';

/**
 * Shared shell for every customer/admin email: a dark branded header with the
 * NT monogram, the content slot, and a footer carrying the real business
 * details. Inline styles only — email clients ignore stylesheets — and a
 * table-based header so it survives Outlook. Red & black to match the Nandana
 * Textile identity (same as the PDF invoice).
 */

const BRAND = 'Nandana Textile';
const ADDRESS = '50 Main St, Veyangoda, Sri Lanka';
const LANDLINE = '033 228 8445';
const WHATSAPP = '071 708 8445';

export function EmailLayout({
  preview,
  children,
}: {
  preview?: string;
  children: ReactNode;
}) {
  return (
    <Html>
      <Head />
      {preview ? <Preview>{preview}</Preview> : null}
      <Body style={body}>
        <Container style={container}>
          {/* Dark branded header */}
          <Section style={header}>
            <Row>
              <Column style={logoCol}>
                <div style={logoTile}>NT</div>
              </Column>
              <Column>
                <Text style={brandName}>NANDANA TEXTILE</Text>
                <Text style={brandTag}>Premium Textiles · Veyangoda</Text>
              </Column>
            </Row>
          </Section>
          <Section style={redRule} />

          {/* Content */}
          <Section style={content}>{children}</Section>

          {/* Footer */}
          <Section style={footer}>
            <Text style={footerBrand}>{BRAND}</Text>
            <Text style={footerLine}>{ADDRESS}</Text>
            <Text style={footerLine}>
              Landline {LANDLINE}  ·  WhatsApp {WHATSAPP}
            </Text>
            <Text style={footerNote}>
              This is an automated message — replies are not monitored.
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

const body = {
  backgroundColor: '#ece9e4',
  fontFamily: "-apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
  margin: 0,
  padding: '28px 12px',
};

const container = {
  backgroundColor: '#ffffff',
  borderRadius: '14px',
  maxWidth: '560px',
  margin: '0 auto',
  overflow: 'hidden',
  border: '1px solid #e4e1da',
};

const header = {
  backgroundColor: '#141414',
  padding: '22px 32px',
};

const logoCol = { width: '52px', verticalAlign: 'middle' as const };

const logoTile = {
  width: '38px',
  height: '38px',
  borderRadius: '9px',
  backgroundColor: '#CC0000',
  color: '#ffffff',
  fontSize: '15px',
  fontWeight: 700,
  letterSpacing: '0.5px',
  textAlign: 'center' as const,
  lineHeight: '38px',
};

const brandName = {
  fontSize: '16px',
  fontWeight: 700,
  letterSpacing: '1.5px',
  color: '#ffffff',
  margin: 0,
};

const brandTag = {
  fontSize: '11px',
  letterSpacing: '0.4px',
  color: '#b9b4ab',
  margin: '2px 0 0',
};

const redRule = { backgroundColor: '#CC0000', height: '3px', lineHeight: '3px' };

const content = { padding: '28px 32px 8px' };

const footer = {
  backgroundColor: '#faf9f7',
  borderTop: '1px solid #ece9e4',
  padding: '20px 32px 24px',
};

const footerBrand = {
  fontSize: '13px',
  fontWeight: 700,
  color: '#141414',
  margin: '0 0 4px',
};

const footerLine = {
  fontSize: '12px',
  lineHeight: '18px',
  color: '#6b6b6b',
  margin: 0,
};

const footerNote = {
  fontSize: '11px',
  lineHeight: '16px',
  color: '#a1a1aa',
  margin: '10px 0 0',
};
