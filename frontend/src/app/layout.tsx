import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "./providers";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://nandanatextile.lk";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "Nandana Textile — Premium Textiles & Uniforms | Sri Lanka",
    template: "%s | Nandana Textile",
  },
  description: "Sri Lanka's trusted textile and uniform specialist with 15+ years experience. Government & private school uniforms, office workwear, tailored garments, silks & sarees. Islandwide delivery.",
  keywords: [
    "Nandana Textile",
    "Nandana Textile Sri Lanka",
    "nandanatextile.lk",
    "school uniforms Sri Lanka",
    "government school uniform fabric",
    "custom uniform tailoring Sri Lanka",
    "office workwear Colombo",
    "sarees and dress materials",
    "buy textiles online Sri Lanka",
    "Veyangoda textile shop",
  ],
  authors: [{ name: "Nandana Textile" }],
  creator: "Nandana Textile",
  publisher: "Nandana Textile",
  formatDetection: {
    email: false,
    address: true,
    telephone: true,
  },
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title: "Nandana Textile — Premium Textiles & Uniforms | Sri Lanka",
    description: "Sri Lanka's trusted textile and uniform specialist. Shop school uniforms, custom tailoring, and quality fabrics online with fast islandwide delivery.",
    url: siteUrl,
    siteName: "Nandana Textile",
    locale: "en_LK",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Nandana Textile — Premium Textiles & Uniforms",
    description: "Order school uniforms, custom tailored clothing, and premium fabrics online in Sri Lanka.",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
};

const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "ClothingStore",
      "@id": `${siteUrl}/#organization`,
      "name": "Nandana Textile",
      "url": siteUrl,
      "logo": `${siteUrl}/logo.png`,
      "image": `${siteUrl}/logo.png`,
      "description": "Sri Lanka's premier textile and uniform supplier specializing in custom tailoring, school uniforms, and quality fabrics.",
      "telephone": "+94332288445",
      "priceRange": "LKR 500 - 25000",
      "address": {
        "@type": "PostalAddress",
        "streetAddress": "50 Main St",
        "addressLocality": "Veyangoda",
        "addressRegion": "Western Province",
        "postalCode": "11100",
        "addressCountry": "LK"
      },
      "geo": {
        "@type": "GeoCoordinates",
        "latitude": 7.1561,
        "longitude": 80.0573
      },
      "openingHoursSpecification": [
        {
          "@type": "OpeningHoursSpecification",
          "dayOfWeek": ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"],
          "opens": "08:30",
          "closes": "19:30"
        }
      ],
      "sameAs": [
        "https://www.facebook.com/nandanatextile",
        "https://www.instagram.com/nandanatextile"
      ]
    },
    {
      "@type": "WebSite",
      "@id": `${siteUrl}/#website`,
      "url": siteUrl,
      "name": "Nandana Textile Online Store",
      "publisher": { "@id": `${siteUrl}/#organization` },
      "potentialAction": {
        "@type": "SearchAction",
        "target": `${siteUrl}/products?search={search_term_string}`,
        "query-input": "required name=search_term_string"
      }
    }
  ]
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning data-scroll-behavior="smooth">
      <body suppressHydrationWarning>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
