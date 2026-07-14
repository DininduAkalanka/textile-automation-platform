import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { PrismaService } from '../prisma/prisma.service';

export interface ChatTurn {
  role: 'user' | 'assistant';
  content: string;
}

export interface ProductCard {
  id: string;
  name: string;
  price: number;
  stock: number;
  image: string | null;
  link: string;
  requiresMeasurement: boolean;
}

export interface ChatReply {
  message: string;
  products: ProductCard[];
  /** False when the answer did not come from the model (fallback or no key). */
  llm: boolean;
}

export interface ChartSpec {
  type: 'line' | 'bar' | 'donut';
  title: string;
  categories: string[];
  series: number[];
}

export interface BusinessReply {
  insight: string;
  /** The raw tool outputs, so every figure the owner sees is auditable. */
  data: Record<string, unknown>;
  recommendation: string | null;
  chartSpec: ChartSpec | null;
  /**
   * False when the AI service caught the model stating a number that appears in
   * no tool's output. The UI must not present such an answer as fact.
   */
  grounded: boolean;
  toolsUsed: string[];
}

/**
 * Gateway to the AI service (plan Session 9.1, task 5).
 *
 * The browser never talks to the Python service directly. It is not on the public
 * internet, it holds the LLM key, and it must not be reachable by anyone who can
 * guess a URL — so the API fronts it, holding the shared INTERNAL_API_KEY.
 *
 * THE FALLBACK IS THE POINT.
 *
 * On a free deploy tier the AI container spins down after ~15 minutes idle and
 * takes 30-50 seconds to wake. During a demo that is a spinner in front of a
 * supervisor. So: if the AI service is slow, cold or dead, this falls back to the
 * ordinary product search and the customer still gets products. The shop is never
 * broken by the AI being asleep — the assistant degrades, the store does not.
 */
@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);
  private readonly baseUrl: string;
  private readonly internalKey: string;
  private readonly timeoutMs: number;

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    this.baseUrl =
      this.config.get<string>('AI_SERVICE_URL') ?? 'http://ai:8000';
    this.internalKey =
      this.config.get<string>('INTERNAL_API_KEY') ?? 'local-dev-internal-key';
    // Long enough for a real answer, short enough that a cold service does not
    // hold the customer hostage — after this we fall back and they get products.
    this.timeoutMs = Number(this.config.get('AI_TIMEOUT_MS') ?? 12_000);
  }

  async customerChat(
    message: string,
    history: ChatTurn[] = [],
  ): Promise<ChatReply> {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), this.timeoutMs);

      const response = await fetch(`${this.baseUrl}/v1/chat/customer`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Internal-Key': this.internalKey,
        },
        body: JSON.stringify({ message, history }),
        signal: controller.signal,
      });

      clearTimeout(timer);

      if (!response.ok) {
        throw new Error(`ai service returned ${response.status}`);
      }

      const body = (await response.json()) as {
        message: string;
        products: Array<{
          id: string;
          name: string;
          price: number;
          stock: number;
          image: string | null;
          link: string;
          requires_measurement: boolean;
        }>;
        llm: boolean;
      };

      return {
        message: body.message,
        products: body.products.map((p) => ({
          id: p.id,
          name: p.name,
          price: p.price,
          stock: p.stock,
          image: p.image,
          link: p.link,
          requiresMeasurement: p.requires_measurement,
        })),
        llm: body.llm,
      };
    } catch (error) {
      // Cold start, timeout, crash, bad key — the customer must not see any of it.
      this.logger.warn(
        `AI service unavailable (${error instanceof Error ? error.message : 'unknown'}); falling back to product search`,
      );
      return this.fallbackSearch(message);
    }
  }

  /**
   * The owner's analyst (Session 9.2, decision D9).
   *
   * The caller's role has ALREADY been verified by RolesGuard on the controller.
   * We forward it as a header, and the AI service trusts it — but only because
   * X-Internal-Key has first established that the caller is this gateway. Without
   * that shared secret, anyone could set X-User-Role: ADMIN and read the shop's
   * revenue.
   *
   * No fallback to a fabricated summary here. If the analyst is unavailable, the
   * owner is TOLD so. Inventing a plausible-looking business figure because the
   * service is cold would be far worse than an error message.
   */
  async businessChat(
    message: string,
    role: string,
    history: ChatTurn[] = [],
  ): Promise<BusinessReply> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await fetch(`${this.baseUrl}/v1/chat/business`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Internal-Key': this.internalKey,
          'X-User-Role': role,
        },
        body: JSON.stringify({ message, history }),
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`ai service returned ${response.status}`);
      }

      return (await response.json()) as BusinessReply;
    } catch (error) {
      this.logger.warn(
        `Business assistant unavailable: ${error instanceof Error ? error.message : 'unknown'}`,
      );

      return {
        insight:
          'The business assistant is not available right now. Your dashboard figures are unaffected.',
        data: {},
        recommendation: null,
        chartSpec: null,
        // Not grounded: there is no data behind this sentence, and the UI should
        // not dress it up as an insight.
        grounded: false,
        toolsUsed: [],
      };
    } finally {
      clearTimeout(timer);
    }
  }

  /**
   * The shop without the assistant: a plain ILIKE search over the catalogue.
   *
   * Deliberately NOT the tsvector query — this path runs precisely when something
   * is already wrong, so it uses the simplest thing that cannot itself fail.
   */
  private async fallbackSearch(message: string): Promise<ChatReply> {
    const term = message.trim().slice(0, 100);

    const products = await this.prisma.product.findMany({
      where: {
        isActive: true,
        OR: [
          { name: { contains: term, mode: 'insensitive' } },
          { description: { contains: term, mode: 'insensitive' } },
          { fabricType: { contains: term, mode: 'insensitive' } },
        ],
      },
      take: 4,
      include: { inventory: true },
    });

    return {
      message: products.length
        ? 'Our assistant is waking up — here are some matches from the catalogue in the meantime.'
        : "I couldn't reach the assistant just now. Try browsing our products, or ask again in a moment.",
      products: products.map((product) => ({
        id: product.id,
        name: product.name,
        price: Number(product.price),
        stock: product.inventory
          ? product.inventory.quantityAvailable -
            product.inventory.quantityReserved
          : 0,
        image: Array.isArray(product.images)
          ? ((product.images as string[])[0] ?? null)
          : null,
        link: `/products/${product.id}`,
        requiresMeasurement: product.requiresMeasurement,
      })),
      llm: false,
    };
  }
}
