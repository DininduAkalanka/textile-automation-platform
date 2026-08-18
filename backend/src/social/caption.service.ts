import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma, ProductType } from '@prisma/client';

/**
 * Turns a product into a ready-to-post social caption — the "AI-ish" marketing
 * layer, done as a deterministic template (free, no API key). It mirrors the
 * house style we settled on: a one-emoji hook per product type, a benefit line,
 * clean spec lines, and three action lines (Order / Delivery / Contact), then
 * hashtags for reach. About 3–4 emojis total — professional, not cluttered.
 *
 * Pure and side-effect-free: give it a product, get a string. That makes it
 * trivially testable and means the caption is identical whether it's previewed,
 * posted, or copied by hand.
 */

/** The product fields a caption needs — a subset of the Prisma Product. */
export interface CaptionProduct {
  name: string;
  slug: string;
  description: string | null;
  price: Prisma.Decimal | number | string;
  productType: ProductType;
  fabricType: string | null;
  color: string | null;
  unit: string | null;
  attributes: Prisma.JsonValue;
}

interface Hook {
  emoji: string;
  text: string;
  benefit: string;
}

// One hook per product type. The benefit is the fallback used only when the
// product has no description of its own.
const HOOKS: Record<ProductType, Hook> = {
  READY_MADE: {
    emoji: '✨',
    text: 'New In',
    benefit: 'A standout piece to refresh your wardrobe.',
  },
  UNIFORM: {
    emoji: '👕',
    text: 'Uniform Essentials',
    benefit: 'Smart, durable and comfortable for everyday wear.',
  },
  CUSTOM: {
    emoji: '✂️',
    text: 'Made to Measure',
    benefit: 'Tailored to your exact measurements for the perfect fit.',
  },
  FABRIC: {
    emoji: '🧵',
    text: 'By the Metre',
    benefit: 'Premium quality fabric for your next creation.',
  },
  ACCESSORY: {
    emoji: '✨',
    text: 'Complete the Look',
    benefit: 'The finishing touch that pulls an outfit together.',
  },
};

const HASHTAGS: Record<ProductType, string[]> = {
  READY_MADE: ['#Fashion', '#OOTD'],
  UNIFORM: ['#Uniforms', '#SchoolUniform'],
  CUSTOM: ['#CustomTailoring', '#MadeToMeasure'],
  FABRIC: ['#Fabric', '#SewingMaterial'],
  ACCESSORY: ['#Accessories'],
};

@Injectable()
export class CaptionService {
  constructor(private readonly config: ConfigService) {}

  /** Build the full caption string for a product. */
  build(product: CaptionProduct): string {
    const hook = HOOKS[product.productType] ?? HOOKS.READY_MADE;
    const brand = this.config.get<string>('SHOP_BRAND') ?? 'Nandana Textile';
    const baseUrl = (
      this.config.get<string>('SHOP_BASE_URL') ??
      this.config.get<string>('FRONTEND_URL') ??
      'https://your-shop.lk'
    ).replace(/\/$/, '');
    const whatsapp = this.config.get<string>('SHOP_WHATSAPP');
    const payments = this.config.get<string>('SHOP_PAYMENTS');

    const lines: string[] = [];

    // Hook — one emoji, product name.
    lines.push(`${hook.emoji} ${hook.text} — ${product.name}`);
    lines.push('');

    // Benefit — the product's own words if it has any, else the type fallback.
    lines.push(this.benefitLine(product, hook));
    lines.push('');

    // Specs — clean text, no emoji.
    lines.push(this.priceLine(product));
    const sizes = this.sizesLine(product);
    if (sizes) lines.push(sizes);
    const material = this.materialLine(product);
    if (material) lines.push(material);
    lines.push('');

    // Actions — the three emoji lines that tell people how to buy.
    lines.push(`🛒 Order online: ${baseUrl}/products/${product.slug}`);
    lines.push(
      `🚚 Island-wide Cash on Delivery${payments ? ` · ${payments}` : ''}`,
    );
    if (whatsapp) lines.push(`📞 Call / WhatsApp: ${whatsapp}`);
    lines.push('');

    // Hashtags for reach.
    lines.push(this.hashtags(product, brand).join(' '));

    return lines.join('\n').trim();
  }

  /**
   * A `wa.me` share link with the caption pre-filled. No phone number, so
   * tapping it opens WhatsApp and lets the owner pick a recipient / broadcast
   * list / Status — the honest free path (WhatsApp has no "post to feed" API).
   */
  whatsappShareUrl(caption: string): string {
    return `https://wa.me/?text=${encodeURIComponent(caption)}`;
  }

  // ─── line builders ────────────────────────────────────────────────────────

  private benefitLine(product: CaptionProduct, hook: Hook): string {
    const desc = (product.description ?? '').trim();
    if (!desc) return hook.benefit;
    // First sentence, capped — a caption is a hook, not the full description.
    const firstSentence = desc.split(/(?<=[.!?])\s/)[0];
    const trimmed =
      firstSentence.length > 160
        ? `${firstSentence.slice(0, 157).trimEnd()}…`
        : firstSentence;
    return trimmed;
  }

  private priceLine(product: CaptionProduct): string {
    const price = this.formatLkr(product.price);
    // Fabric sold per unit reads "Rs X / metre".
    const unit = (product.unit ?? '').trim().toLowerCase();
    if (product.productType === 'FABRIC' && unit) {
      return `${price} / ${unit}`;
    }
    return price;
  }

  private sizesLine(product: CaptionProduct): string | null {
    const attrs = product.attributes;
    if (!attrs || typeof attrs !== 'object' || Array.isArray(attrs))
      return null;
    const raw = (attrs as Record<string, unknown>).sizes;
    if (Array.isArray(raw) && raw.length) {
      return `Sizes: ${raw.map((s) => String(s)).join(' · ')}`;
    }
    if (typeof raw === 'string' && raw.trim()) {
      return `Sizes: ${raw.trim()}`;
    }
    return null;
  }

  private materialLine(product: CaptionProduct): string | null {
    const parts = [product.fabricType, product.color]
      .map((p) => (p ?? '').trim())
      .filter(Boolean);
    return parts.length ? parts.join(' · ') : null;
  }

  private hashtags(product: CaptionProduct, brand: string): string[] {
    const brandTag = `#${brand.replace(/[^A-Za-z0-9]/g, '')}`;
    const tags = [
      brandTag,
      ...(HASHTAGS[product.productType] ?? []),
      '#SriLanka',
      '#ShopSriLanka',
    ];
    const fabric = (product.fabricType ?? '').trim();
    if (fabric) {
      tags.splice(2, 0, `#${fabric.replace(/[^A-Za-z0-9]/g, '')}`);
    }
    // De-dupe (case-insensitive) and cap at 6 so it reads clean, not spammy.
    const seen = new Set<string>();
    const unique: string[] = [];
    for (const t of tags) {
      const key = t.toLowerCase();
      if (t.length > 1 && !seen.has(key)) {
        seen.add(key);
        unique.push(t);
      }
    }
    return unique.slice(0, 6);
  }

  private formatLkr(price: Prisma.Decimal | number | string): string {
    const n = Number(price);
    const safe = Number.isFinite(n) ? n : 0;
    return `Rs ${safe.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  }
}
