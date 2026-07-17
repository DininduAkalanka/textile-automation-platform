import { Heading, Section, Text } from '@react-email/components';
import { EmailLayout } from './components/email-layout';

export function VerificationCodeEmail({ code }: { code: string }) {
  return (
    <EmailLayout preview={`Your verification code is ${code}`}>
      <Heading style={heading}>Verify your contact</Heading>
      <Text style={paragraph}>
        Enter this code to finish verifying your TextileShop account:
      </Text>
      <Section style={codeBox}>
        <Text style={codeText}>{code}</Text>
      </Section>
      <Text style={muted}>
        This code expires in 5 minutes. If you didn&apos;t request it, you can
        safely ignore this email.
      </Text>
    </EmailLayout>
  );
}

const heading = { fontSize: '20px', color: '#111111', margin: '16px 0 8px' };
const paragraph = { fontSize: '15px', color: '#444444', lineHeight: '22px' };
const codeBox = {
  backgroundColor: '#f4f4f5',
  borderRadius: '12px',
  padding: '4px 0',
  textAlign: 'center' as const,
  margin: '16px 0',
};
const codeText = {
  fontSize: '32px',
  fontWeight: 700,
  letterSpacing: '8px',
  color: '#111111',
  margin: '12px 0',
};
const muted = { fontSize: '13px', color: '#888888', lineHeight: '20px' };
