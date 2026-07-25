import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SocialPlatform, SocialPostStatus } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';
import { CaptionProduct, CaptionService } from './caption.service';

/**
 * Social auto-posting orchestrator.
 *
 * Deliberately "optional / never-throws", exactly like the Stripe, AI and
 * email/SMS integrations: if the Meta token isn't configured, posting is
 * SKIPPED (logged, recorded) — never an error. So this feature can ship and be
 * useful (caption + WhatsApp + copy) long before any Meta setup exists, and
 * lights up automatically the day a token is added. It can never break the
 * product-create flow.
 */

export interface PlatformResult {
  platform: SocialPlatform;
  status: SocialPostStatus;
  message: string;
  externalPostId?: string | null;
}

@Injectable()
export class SocialService {
  private readonly logger = new Logger(SocialService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly captions: CaptionService,
  ) {}

  // ─── Configuration (all env-driven, all optional) ─────────────────────────

  private get token() {
    return this.config.get<string>('META_PAGE_TOKEN');
  }
  private get pageId() {
    return this.config.get<string>('META_PAGE_ID');
  }
  private get igUserId() {
    return this.config.get<string>('META_IG_USER_ID');
  }
  private get graphVersion() {
    return this.config.get<string>('META_GRAPH_VERSION') ?? 'v21.0';
  }
  private get facebookConfigured() {
    return Boolean(this.token && this.pageId);
  }
  private get instagramConfigured() {
    return Boolean(this.token && this.igUserId);
  }

  // ─── Public API ───────────────────────────────────────────────────────────

  /** Caption + WhatsApp link + which platforms are ready. Writes nothing. */
  async preview(productId: string) {
    const product = await this.load(productId);
    const caption = this.captions.build(product);
    const image = this.firstImage(product.images);

    return {
      productId,
      caption,
      whatsappUrl: this.captions.whatsappShareUrl(caption),
      image,
      platforms: {
        facebook: { configured: this.facebookConfigured },
        instagram: {
          configured: this.instagramConfigured,
          needsImage: !image,
        },
        whatsapp: { available: true },
      },
      recent: await this.history(productId),
    };
  }

  /**
   * Attempt to post to the requested platforms. Each platform is independent
   * and wrapped so one failure never affects another (or the caller). Every
   * attempt — posted, skipped, or failed — is recorded in social_posts.
   */
  async post(productId: string, platforms: SocialPlatform[]) {
    const product = await this.load(productId);
    const caption = this.captions.build(product);
    const image = this.firstImage(product.images);

    const results: PlatformResult[] = [];
    for (const platform of platforms) {
      if (platform === SocialPlatform.FACEBOOK) {
        results.push(await this.postFacebook(productId, caption, image));
      } else if (platform === SocialPlatform.INSTAGRAM) {
        results.push(await this.postInstagram(productId, caption, image));
      } else {
        // WhatsApp has no server-side post — it's the one-tap wa.me link the
        // UI opens. Record it so the log is complete, without pretending we
        // published anything.
        results.push(
          await this.record(productId, platform, SocialPostStatus.SKIPPED, caption, {
            message: 'Use the WhatsApp share button to post this.',
          }),
        );
      }
    }

    return {
      caption,
      whatsappUrl: this.captions.whatsappShareUrl(caption),
      results,
    };
  }

  /** The most recent share attempts for a product ("already posted ✓"). */
  async history(productId: string) {
    return this.prisma.socialPost.findMany({
      where: { productId },
      orderBy: { createdAt: 'desc' },
      take: 10,
      select: {
        platform: true,
        status: true,
        externalPostId: true,
        createdAt: true,
      },
    });
  }

  // ─── Platform posters (never throw) ───────────────────────────────────────

  private async postFacebook(
    productId: string,
    caption: string,
    image: string | null,
  ): Promise<PlatformResult> {
    if (!this.facebookConfigured) {
      return this.record(productId, SocialPlatform.FACEBOOK, SocialPostStatus.SKIPPED, caption, {
        message: 'Facebook not connected yet — caption is ready to copy/paste.',
      });
    }
    try {
      // A photo post when we have an image; a plain text post otherwise.
      const node = image ? 'photos' : 'feed';
      const body: Record<string, string> = image
        ? { url: image, caption }
        : { message: caption };
      const res = await this.graph(`${this.pageId}/${node}`, body);
      const externalPostId = res.post_id ?? res.id ?? null;
      return this.record(productId, SocialPlatform.FACEBOOK, SocialPostStatus.POSTED, caption, {
        message: 'Posted to Facebook.',
        externalPostId,
      });
    } catch (err) {
      return this.record(productId, SocialPlatform.FACEBOOK, SocialPostStatus.FAILED, caption, {
        message: this.errText(err),
      });
    }
  }

  private async postInstagram(
    productId: string,
    caption: string,
    image: string | null,
  ): Promise<PlatformResult> {
    if (!this.instagramConfigured) {
      return this.record(productId, SocialPlatform.INSTAGRAM, SocialPostStatus.SKIPPED, caption, {
        message: 'Instagram not connected yet — caption is ready to copy/paste.',
      });
    }
    if (!image) {
      // Instagram's API cannot publish without an image.
      return this.record(productId, SocialPlatform.INSTAGRAM, SocialPostStatus.SKIPPED, caption, {
        message: 'Instagram needs at least one product image to post.',
      });
    }
    try {
      // Two-step publish: create a media container, then publish it.
      const container = await this.graph(`${this.igUserId}/media`, {
        image_url: image,
        caption,
      });
      if (!container.id) {
        throw new Error('Instagram did not return a media container id.');
      }
      const published = await this.graph(`${this.igUserId}/media_publish`, {
        creation_id: container.id,
      });
      return this.record(productId, SocialPlatform.INSTAGRAM, SocialPostStatus.POSTED, caption, {
        message: 'Posted to Instagram.',
        externalPostId: published.id ?? null,
      });
    } catch (err) {
      return this.record(productId, SocialPlatform.INSTAGRAM, SocialPostStatus.FAILED, caption, {
        message: this.errText(err),
      });
    }
  }

  // ─── Meta Graph API call ──────────────────────────────────────────────────

  private async graph(
    path: string,
    params: Record<string, string>,
  ): Promise<{ id?: string; post_id?: string }> {
    const url = `https://graph.facebook.com/${this.graphVersion}/${path}`;
    const body = new URLSearchParams({ ...params, access_token: this.token ?? '' });

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    });
    const json = (await res.json().catch(() => ({}))) as {
      id?: string;
      post_id?: string;
      error?: { message?: string };
    };
    if (!res.ok) {
      throw new Error(json.error?.message ?? `Graph API returned ${res.status}`);
    }
    return json;
  }

  // ─── helpers ──────────────────────────────────────────────────────────────

  private async record(
    productId: string,
    platform: SocialPlatform,
    status: SocialPostStatus,
    caption: string,
    opts: { message: string; externalPostId?: string | null },
  ): Promise<PlatformResult> {
    if (status === SocialPostStatus.FAILED) {
      this.logger.warn(`social_post_failed platform=${platform} error=${opts.message}`);
    }
    await this.prisma.socialPost.create({
      data: {
        productId,
        platform,
        status,
        caption,
        externalPostId: opts.externalPostId ?? null,
        error: status === SocialPostStatus.FAILED ? opts.message : null,
      },
    });
    return { platform, status, message: opts.message, externalPostId: opts.externalPostId };
  }

  private async load(productId: string): Promise<CaptionProduct & { images: unknown }> {
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
      select: {
        name: true,
        slug: true,
        description: true,
        price: true,
        productType: true,
        fabricType: true,
        color: true,
        unit: true,
        attributes: true,
        images: true,
      },
    });
    if (!product) throw new NotFoundException('Product not found');
    return product;
  }

  private firstImage(images: unknown): string | null {
    if (Array.isArray(images) && typeof images[0] === 'string') {
      const url = images[0].trim();
      return url.startsWith('http') ? url : null;
    }
    return null;
  }

  private errText(err: unknown): string {
    return err instanceof Error ? err.message : 'Unknown error posting to the platform.';
  }
}
