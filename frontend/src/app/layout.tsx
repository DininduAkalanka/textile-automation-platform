import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Nandana Textile — Premium Textiles & Uniforms | Sri Lanka",
  description: "Sri Lanka's trusted textile and uniform specialist. School uniforms (government & private), office uniforms, women's fashion, and more. Shop online with island-wide delivery.",
  keywords: "Nandana Textile, school uniforms Sri Lanka, office uniforms, dress materials, sarees, government school uniform, private school uniform, textile shop Sri Lanka",
  openGraph: {
    title: "Nandana Textile — Premium Textiles & Uniforms",
    description: "Sri Lanka's trusted textile and uniform specialist with 15+ years of experience.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
