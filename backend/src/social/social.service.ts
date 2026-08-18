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
          // Instagram can only publish a PUBLICLY reachable image, so a local
          // (localhost) upload doesn't count as having one.
          needsImage: !this.publicImage(product.images),
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
    // Only a publicly reachable image can be posted — Facebook and Instagram
    // FETCH the URL from their own servers, so a localhost upload is unusable.
    // Facebook then posts text-only; Instagram (which requires an image) skips.
    const image = this.publicImage(product.images);

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
          await this.record(
            productId,
            platform,
            SocialPostStatus.SKIPPED,
            caption,
            {
              message: 'Use the WhatsApp share button to post this.',
            },
          ),
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
      return this.record(
        productId,
        SocialPlatform.FACEBOOK,
        SocialPostStatus.SKIPPED,
        caption,
        {
          message:
            'Facebook not connected yet — caption is ready to copy/paste.',
        },
      );
    }
    try {
      const token = await this.pageAccessToken();
      // A photo post when we have an image; a plain text post otherwise.
      const node = image ? 'photos' : 'feed';
      const body: Record<string, string> = image
        ? { url: image, caption }
        : { message: caption };
      const res = await this.graph(`${this.pageId}/${node}`, body, token);
      const externalPostId = res.post_id ?? res.id ?? null;
      return this.record(
        productId,
        SocialPlatform.FACEBOOK,
        SocialPostStatus.POSTED,
        caption,
        {
          message: 'Posted to Facebook.',
          externalPostId,
        },
      );
    } catch (err) {
      return this.record(
        productId,
        SocialPlatform.FACEBOOK,
        SocialPostStatus.FAILED,
        caption,
        {
          message: this.errText(err),
        },
      );
    }
  }

  private async postInstagram(
    productId: string,
    caption: string,
    image: string | null,
  ): Promise<PlatformResult> {
    if (!this.instagramConfigured) {
      return this.record(
        productId,
        SocialPlatform.INSTAGRAM,
        SocialPostStatus.SKIPPED,
        caption,
        {
          message:
            'Instagram not connected yet — caption is ready to copy/paste.',
        },
      );
    }
    if (!image) {
      // Instagram's API cannot publish without an image.
      return this.record(
        productId,
        SocialPlatform.INSTAGRAM,
        SocialPostStatus.SKIPPED,
        caption,
        {
          message: 'Instagram needs at least one product image to post.',
        },
      );
    }
    try {
      const token = await this.pageAccessToken();
      // Two-step publish: create a media container, then publish it.
      const container = await this.graph(
        `${this.igUserId}/media`,
        { image_url: image, caption },
        token,
      );
      if (!container.id) {
        throw new Error('Instagram did not return a media container id.');
      }
      const published = await this.graph(
        `${this.igUserId}/media_publish`,
        { creation_id: container.id },
        token,
      );
      return this.record(
        productId,
        SocialPlatform.INSTAGRAM,
        SocialPostStatus.POSTED,
        caption,
        {
          message: 'Posted to Instagram.',
          externalPostId: published.id ?? null,
        },
      );
    } catch (err) {
      return this.record(
        productId,
        SocialPlatform.INSTAGRAM,
        SocialPostStatus.FAILED,
        caption,
        {
          message: this.errText(err),
        },
      );
    }
  }

  // ─── Meta Graph API ───────────────────────────────────────────────────────

  /**
   * The token configured in META_PAGE_TOKEN can be a Page token, a User token,
   * or (recommended) a never-expiring System User token. Publishing to a Page —
   * and to the Instagram account linked to it — requires the *Page* access
   * token, so we exchange whatever was given for it: GET /{page-id}?fields=
   * access_token returns the Page token for any token with access to the Page.
   * The result is cached for the process lifetime.
   */
  private _pageToken: string | null = null;
  private async pageAccessToken(): Promise<string> {
    if (this._pageToken) return this._pageToken;
    const base = this.token ?? '';
    if (!base || !this.pageId) return base;
    try {
      const res = await fetch(
        `https://graph.facebook.com/${this.graphVersion}/${this.pageId}` +
          `?fields=access_token&access_token=${encodeURIComponent(base)}`,
      );
      const json = (await res.json()) as { access_token?: string };
      this._pageToken = json.access_token || base; // fall back to the given token
    } catch {
      this._pageToken = base;
    }
    return this._pageToken;
  }

  private async graph(
    path: string,
    params: Record<string, string>,
    token: string,
  ): Promise<{ id?: string; post_id?: string }> {
    const url = `https://graph.facebook.com/${this.graphVersion}/${path}`;
    const body = new URLSearchParams({ ...params, access_token: token });

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
      throw new Error(
        json.error?.message ?? `Graph API returned ${res.status}`,
      );
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
      this.logger.warn(
        `social_post_failed platform=${platform} error=${opts.message}`,
      );
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
    return {
      platform,
      status,
      message: opts.message,
      externalPostId: opts.externalPostId,
    };
  }

  private async load(
    productId: string,
  ): Promise<CaptionProduct & { images: unknown }> {
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

  /** The first image, but only if a public URL Meta can actually fetch. */
  private publicImage(images: unknown): string | null {
    const url = this.firstImage(images);
    return url && this.isPublicUrl(url) ? url : null;
  }

  /** A URL Meta's servers can reach — not localhost / a private address. */
  private isPublicUrl(url: string): boolean {
    try {
      const host = new URL(url).hostname.toLowerCase();
      if (
        host === 'localhost' ||
        host.endsWith('.local') ||
        host === '127.0.0.1' ||
        host === '0.0.0.0' ||
        host === '::1' ||
        /^10\./.test(host) ||
        /^192\.168\./.test(host) ||
        /^172\.(1[6-9]|2\d|3[01])\./.test(host)
      ) {
        return false;
      }
      return true;
    } catch {
      return false;
    }
  }

  private errText(err: unknown): string {
    return err instanceof Error
      ? err.message
      : 'Unknown error posting to the platform.';
  }
}
