'use client';

import { useMemo, useState } from 'react';
import { Check, Copy, Loader2, MessageCircle, Send } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog';
import { useSharePost, useSocialPreview } from '@/hooks/use-social';
import { Product, SocialPlatform } from '@/types';

/**
 * "Post this to social?" — shown after a product is created, and re-openable
 * from the row menu.
 *
 * UX contract: the owner makes ONE explicit choice. Tick the channels, then a
 * single primary action ("Share now") does it — or "Skip" leaves the product
 * website-only. Nothing is ever posted without that click. Channels that can't
 * work yet are visibly disabled WITH the reason, never silently missing.
 */
export function ShareProductDialog({
  product,
  open,
  onClose,
}: {
  product: Product | null;
  open: boolean;
  onClose: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="max-w-lg border-[#EAE8E1] p-0">
        {open && product && <ShareInner product={product} onClose={onClose} />}
      </DialogContent>
    </Dialog>
  );
}

function ShareInner({
  product,
  onClose,
}: {
  product: Product;
  onClose: () => void;
}) {
  const { data, isLoading, isError } = useSocialPreview(product.id);
  const share = useSharePost();
  const queryClient = useQueryClient();

  const [edited, setEdited] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  // null = "follow the sensible default"; a Set = the owner has chosen.
  const [picked, setPicked] = useState<Set<SocialPlatform> | null>(null);

  const caption = edited ?? data?.caption ?? '';
  const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(caption)}`;

  // Which channels can actually be used right now.
  const canUse = useMemo(
    () => ({
      FACEBOOK: Boolean(data?.platforms.facebook.configured),
      INSTAGRAM: Boolean(
        data?.platforms.instagram.configured &&
          !data?.platforms.instagram.needsImage,
      ),
      WHATSAPP: Boolean(data?.platforms.whatsapp.available),
    }),
    [data],
  );

  // Pre-tick everything usable, so the primary button is meaningful on open.
  const defaultPicked = useMemo(() => {
    const s = new Set<SocialPlatform>();
    (['FACEBOOK', 'INSTAGRAM', 'WHATSAPP'] as SocialPlatform[]).forEach((p) => {
      if (canUse[p]) s.add(p);
    });
    return s;
  }, [canUse]);

  const selected = picked ?? defaultPicked;

  function toggle(platform: SocialPlatform) {
    const next = new Set(selected);
    if (next.has(platform)) next.delete(platform);
    else next.add(platform);
    setPicked(next);
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(caption);
      setCopied(true);
      toast.success('Caption copied');
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error('Could not copy — select the text and copy manually.');
    }
  }

  function shareNow() {
    const picks = [...selected];
    if (!picks.length) return;

    // WhatsApp is a link, not an API call. Opened synchronously inside the
    // click so the browser doesn't treat it as a blocked pop-up.
    if (selected.has('WHATSAPP')) {
      window.open(whatsappUrl, '_blank', 'noopener,noreferrer');
    }

    const apiPlatforms = picks.filter((p) => p !== 'WHATSAPP');
    if (!apiPlatforms.length) {
      // WhatsApp only: we opened a tab, we did NOT publish anything. Say so
      // honestly and leave the dialog open — the owner still has to hit send.
      toast.message('Opening WhatsApp — finish sending it there.');
      return;
    }

    share.mutate(
      { productId: product.id, platforms: apiPlatforms },
      {
        onSuccess: (res) => {
          for (const r of res.results) {
            if (r.status === 'POSTED') toast.success(r.message);
            else if (r.status === 'FAILED') toast.error(r.message);
            else toast.message(r.message);
          }
          void queryClient.invalidateQueries({
            queryKey: ['social', 'preview', product.id],
          });
          // Only dismiss when something genuinely published. If every channel
          // was skipped or failed, keep the dialog open so the owner can still
          // copy the caption instead of being told "done" when nothing was.
          if (res.results.some((r) => r.status === 'POSTED')) onClose();
        },
        onError: (e: Error) => toast.error(e.message),
      },
    );
  }

  return (
    <>
      <div className="border-b border-[#EAE8E1] px-6 pb-4 pt-6">
        <DialogTitle className="text-[15px] font-semibold text-[#0F0F0F]">
          Post “{product.name}” to social media?
        </DialogTitle>
        <DialogDescription className="mt-0.5 text-xs text-[#928E82]">
          Optional. Skip to keep it website-only — you can share any time later
          from the product’s ⋮ menu.
        </DialogDescription>
      </div>

      <div className="max-h-[58vh] space-y-5 overflow-y-auto px-6 py-4">
        {isLoading ? (
          <div className="flex items-center justify-center gap-2 py-10 text-sm text-[#928E82]">
            <Loader2 size={15} className="animate-spin" aria-hidden />
            Writing a caption…
          </div>
        ) : isError ? (
          <p className="py-8 text-center text-sm text-[#CC0000]">
            Couldn’t generate a caption right now. Close this and try again from
            the product’s ⋮ menu.
          </p>
        ) : (
          <>
            {/* ── Caption ── */}
            <section>
              <div className="mb-1.5 flex items-center justify-between">
                <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#928E82]">
                  Caption
                </span>
                <button
                  type="button"
                  onClick={copy}
                  className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-[12px] font-medium text-[#6E6A5E] transition-colors hover:bg-[#F4F3EF] hover:text-[#0F0F0F]"
                >
                  {copied ? (
                    <Check size={13} className="text-[#2F6B49]" aria-hidden />
                  ) : (
                    <Copy size={13} aria-hidden />
                  )}
                  {copied ? 'Copied' : 'Copy'}
                </button>
              </div>
              <textarea
                aria-label="Caption"
                value={caption}
                onChange={(e) => setEdited(e.target.value)}
                rows={8}
                className="w-full resize-y rounded-lg border border-[#EAE8E1] bg-white px-3 py-2 text-[13px] leading-relaxed text-[#0F0F0F] outline-none transition-colors focus:border-[#0F0F0F]"
              />
            </section>

            {/* ── Channel picker ── */}
            <section>
              <span className="mb-1.5 block text-[10px] font-semibold uppercase tracking-[0.14em] text-[#928E82]">
                Where to post
              </span>
              <div className="space-y-2">
                <ChannelChoice
                  badge={<BrandBadge background="#1877F2">f</BrandBadge>}
                  label="Facebook"
                  checked={selected.has('FACEBOOK')}
                  disabled={!canUse.FACEBOOK}
                  hint={
                    canUse.FACEBOOK
                      ? 'Posts to your Page automatically'
                      : 'Not connected — add a Meta token, or use Copy above'
                  }
                  onToggle={() => toggle('FACEBOOK')}
                />
                <ChannelChoice
                  badge={
                    <BrandBadge background="linear-gradient(45deg,#F58529,#DD2A7B,#8134AF)">
                      ◎
                    </BrandBadge>
                  }
                  label="Instagram"
                  checked={selected.has('INSTAGRAM')}
                  disabled={!canUse.INSTAGRAM}
                  hint={
                    canUse.INSTAGRAM
                      ? 'Posts to your Business account automatically'
                      : data?.platforms.instagram.needsImage
                        ? 'Add a product image to enable Instagram'
                        : 'Not connected — add a Meta token, or use Copy above'
                  }
                  onToggle={() => toggle('INSTAGRAM')}
                />
                <ChannelChoice
                  badge={
                    <span
                      aria-hidden
                      className="flex h-[22px] w-[22px] items-center justify-center rounded-[6px] bg-[#25D366] text-white"
                    >
                      <MessageCircle size={13} />
                    </span>
                  }
                  label="WhatsApp"
                  checked={selected.has('WHATSAPP')}
                  disabled={false}
                  hint="Opens WhatsApp with the caption ready to send"
                  onToggle={() => toggle('WHATSAPP')}
                />
              </div>
            </section>
          </>
        )}
      </div>

      {/* ── Actions: one clear "no", one clear "yes" ── */}
      <div className="flex items-center justify-between gap-3 border-t border-[#EAE8E1] bg-[#FAFAF8] px-6 py-4">
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg border border-[#EAE8E1] bg-white px-4 py-2 text-[13px] font-medium text-[#6E6A5E] transition-colors hover:border-[#D5D2C8] hover:text-[#0F0F0F]"
        >
          Skip — website only
        </button>

        <button
          type="button"
          onClick={shareNow}
          disabled={isLoading || isError || selected.size === 0 || share.isPending}
          className="inline-flex items-center gap-2 rounded-lg bg-[#0F0F0F] px-4 py-2 text-[13px] font-semibold text-white transition-all hover:bg-black disabled:cursor-not-allowed disabled:bg-[#D5D2C8]"
        >
          {share.isPending ? (
            <Loader2 size={13} className="animate-spin" aria-hidden />
          ) : (
            <Send size={13} aria-hidden />
          )}
          {selected.size > 1 ? `Share to ${selected.size} channels` : 'Share now'}
        </button>
      </div>
    </>
  );
}

/** A tick-box row: the whole row is the label, so it's an easy click target. */
function ChannelChoice({
  badge,
  label,
  checked,
  disabled,
  hint,
  onToggle,
}: {
  badge: React.ReactNode;
  label: string;
  checked: boolean;
  disabled: boolean;
  hint: string;
  onToggle: () => void;
}) {
  return (
    <label
      className={`flex cursor-pointer items-center gap-3 rounded-lg border px-4 py-3 transition-colors ${
        disabled
          ? 'cursor-not-allowed border-[#EFEDE6] bg-[#FAFAF8] opacity-70'
          : checked
            ? 'border-[#0F0F0F] bg-white'
            : 'border-[#EAE8E1] bg-white hover:border-[#D5D2C8]'
      }`}
    >
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={onToggle}
        className="h-4 w-4 shrink-0 accent-[#0F0F0F]"
      />
      {badge}
      <span className="min-w-0 flex-1">
        <span className="block text-[13px] font-medium text-[#0F0F0F]">
          {label}
        </span>
        <span className="block truncate text-[11px] text-[#928E82]">{hint}</span>
      </span>
    </label>
  );
}

/** lucide dropped brand glyphs, so we render our own tiny brand mark. */
function BrandBadge({
  background,
  children,
}: {
  background: string;
  children: React.ReactNode;
}) {
  return (
    <span
      aria-hidden
      className="flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-[6px] text-[13px] font-bold leading-none text-white"
      style={{ background }}
    >
      {children}
    </span>
  );
}
