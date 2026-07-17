import { ReactNode } from 'react';
import {
  Html,
  Head,
  Preview,
  Body,
  Container,
  Section,
  Text,
  Hr,
} from '@react-email/components';

/**
 * Shared shell for every customer/admin email: brand header, content slot,
 * footer. Inline styles only — email clients ignore stylesheets.
 */
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
          <Section style={header}>
            <Text style={brand}>
              <span style={brandMark}>T</span> TextileShop
            </Text>
          </Section>
          {children}
          <Hr style={hr} />
          <Text style={footer}>
            TextileShop · Nandana Textile, Sri Lanka
            <br />
            This is an automated message — replies are not monitored.
          </Text>
        </Container>
      </Body>
    </Html>
  );
}

const body = {
  backgroundColor: '#f4f4f5',
  fontFamily: "-apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
  margin: 0,
  padding: '24px 12px',
};

const container = {
  backgroundColor: '#ffffff',
  borderRadius: '12px',
  maxWidth: '520px',
  margin: '0 auto',
  padding: '32px',
};

const header = { marginBottom: '8px' };

const brand = {
  fontSize: '18px',
  fontWeight: 700,
  color: '#111111',
  margin: 0,
};

const brandMark = {
  display: 'inline-block',
  backgroundColor: '#4f46e5',
  color: '#ffffff',
  borderRadius: '6px',
  padding: '2px 8px',
  marginRight: '6px',
};

const hr = { borderColor: '#e4e4e7', margin: '28px 0 16px' };

const footer = {
  fontSize: '12px',
  lineHeight: '18px',
  color: '#a1a1aa',
  margin: 0,
};
