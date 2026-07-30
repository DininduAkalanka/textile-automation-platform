import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';
import { InvoiceData, buildInvoiceDocument } from './invoice-pdf';

const PAYMENT_METHOD_LABEL: Record<string, string> = {
  PAYHERE: 'Card (PayHere)',
  COD: 'Cash on Delivery',
  STRIPE: 'Card',
  INSTALLMENT: 'Instalment plan',
};
const PAYMENT_STATUS_LABEL: Record<string, string> = {
  COMPLETED: 'Paid',
  PENDING: 'Pending',
  FAILED: 'Failed',
  REFUNDED: 'Refunded',
};

// Everything the invoice needs from the order, in one query.
const ORDER_INCLUDE = {
  user: {
    select: { firstName: true, lastName: true, email: true, phone: true },
  },
  items: {
    include: {
      product: {
        select: { name: true, sku: true, fabricType: true, color: true },
      },
    },
  },
  payment: { select: { method: true, status: true } },
} satisfies Prisma.OrderInclude;

type InvoiceOrder = Prisma.OrderGetPayload<{ include: typeof ORDER_INCLUDE }>;

@Injectable()
export class InvoiceService {
  private readonly logger = new Logger(InvoiceService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  /** Load an order and render its invoice PDF. Null if the order is gone. */
  async generateForOrder(
    orderId: string,
  ): Promise<{ buffer: Buffer; filename: string } | null> {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: ORDER_INCLUDE,
    });
    if (!order) return null;
    const buffer = await this.render(this.buildData(order));
    return { buffer, filename: `invoice-${order.orderNumber}.pdf` };
  }

  /** Render prepared invoice data to a PDF buffer. @react-pdf/renderer is a
   *  pure-ESM package, so it is reached through a dynamic import() — the only
   *  way our CommonJS build can load it under Node 20. */
  async render(data: InvoiceData): Promise<Buffer> {
    const pdf = await import('@react-pdf/renderer');
    return pdf.renderToBuffer(buildInvoiceDocument(pdf, data));
  }

  // ─── data shaping ─────────────────────────────────────────────────────────

  buildData(order: InvoiceOrder): InvoiceData {
    return {
      business: this.business(),
      orderNumber: order.orderNumber,
      date: order.createdAt.toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      }),
      customerName:
        `${order.user.firstName} ${order.user.lastName ?? ''}`.trim(),
      customerEmail: order.user.email ?? '',
      customerPhone: order.user.phone ?? '',
      shipTo: this.addressLines(order.shippingAddress),
      paymentMethod: order.payment
        ? (PAYMENT_METHOD_LABEL[order.payment.method] ?? order.payment.method)
        : '—',
      paymentStatus: order.payment
        ? (PAYMENT_STATUS_LABEL[order.payment.status] ?? order.payment.status)
        : '—',
      items: order.items.map((item) => ({
        name: item.product.name,
        description: this.itemSubtitle(item),
        quantity: item.quantity,
        unitPrice: this.lkr(item.unitPrice),
        amount: this.lkr(item.totalPrice),
      })),
      subtotal: this.lkr(order.subtotal),
      shipping: this.lkr(order.shippingCost),
      tax: this.lkr(order.tax),
      total: this.lkr(order.total),
    };
  }

  private business() {
    return {
      name: this.config.get<string>('SHOP_BRAND') ?? 'Nandana Textile',
      address: this.config.get<string>('SHOP_ADDRESS') ?? '50 Main St, Veyangoda',
      landline: this.config.get<string>('SHOP_LANDLINE') ?? '033 228 8445',
      whatsapp: this.config.get<string>('SHOP_WHATSAPP') ?? '071 708 8445',
      // Optional, shown only when configured (blank by default — never faked).
      regNo: this.config.get<string>('SHOP_REG_NO') ?? '',
      bank: this.config.get<string>('SHOP_BANK') ?? '',
    };
  }

  /** A compact, human-friendly second line for a table row: fabric, colour,
   *  any variant chosen at checkout (e.g. Size: L), then the SKU. Empty when
   *  the product carries none of these — the template hides it in that case. */
  private itemSubtitle(item: InvoiceOrder['items'][number]): string {
    const parts: string[] = [];
    if (item.product.fabricType) parts.push(item.product.fabricType);
    if (item.product.color) parts.push(item.product.color);

    const attrs = item.selectedAttributes;
    if (attrs && typeof attrs === 'object' && !Array.isArray(attrs)) {
      for (const [key, value] of Object.entries(
        attrs as Record<string, unknown>,
      )) {
        if (value === null || value === undefined || value === '') continue;
        const label = key.charAt(0).toUpperCase() + key.slice(1);
        parts.push(`${label}: ${String(value)}`);
      }
    }
    if (item.product.sku) parts.push(item.product.sku);
    return parts.join('  ·  ');
  }

  private addressLines(shippingAddress: Prisma.JsonValue): string[] {
    if (!shippingAddress || typeof shippingAddress !== 'object' || Array.isArray(shippingAddress)) {
      return ['—'];
    }
    const a = shippingAddress as Record<string, unknown>;
    const str = (k: string) => (typeof a[k] === 'string' ? (a[k] as string).trim() : '');
    const cityLine = [str('city'), str('postalCode')].filter(Boolean).join(' ');
    return [
      str('fullName'),
      str('addressLine1'),
      str('addressLine2'),
      cityLine,
      str('phone') ? `Tel: ${str('phone')}` : '',
    ].filter(Boolean);
  }

  private lkr(value: Prisma.Decimal | number | string): string {
    const n = Number(value);
    const safe = Number.isFinite(n) ? n : 0;
    return `Rs ${safe.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  }
}
