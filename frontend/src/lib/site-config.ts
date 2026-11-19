/**
 * The shop's public contact details and social links — the ONE place they live.
 *
 * Every page that shows a phone number, WhatsApp link, email or social profile
 * reads it from here. They used to be typed into each page separately, which is
 * how fake numbers (+94 77 000 0000, wa.me/94712345678) ended up on the live
 * Returns page. Change a detail here and the whole site follows.
 *
 * A social profile with an empty URL is simply not shown — never a dead "#" link.
 */

export const SITE_NAME = 'Nandana Textile';

export const PHONE_MOBILE = {
  display: '071 708 8445',
  international: '+94 71 708 8445',
  tel: '+94717088445',
} as const;

export const PHONE_LANDLINE = {
  display: '033 228 8445',
  international: '+94 33 228 8445',
  tel: '+94332288445',
} as const;

/** WhatsApp number in the international form wa.me expects (no "+"). */
export const WHATSAPP_NUMBER = '94717088445';

export const CONTACT_EMAIL = 'info@nandanatextile.lk';

export const SHOWROOMS = [
  {
    name: 'Veyangoda Showroom',
    address: '50 Main Street, Veyangoda',
    mapsUrl: 'https://maps.google.com/?q=50+Main+Street+Veyangoda+Nandana+Textile',
    phone: PHONE_LANDLINE,
  },
  {
    name: 'Kurunegala Showroom',
    address: '145 Main Street, Kurunegala',
    mapsUrl: 'https://maps.google.com/?q=145+Main+Street+Kurunegala+Nandana+Textile',
    phone: PHONE_MOBILE,
  },
] as const;

export type SocialId = 'facebook' | 'instagram' | 'whatsapp' | 'tiktok' | 'youtube';

/** Public social profiles. Leave a URL empty to hide that icon everywhere. */
export const SOCIAL_LINKS: { id: SocialId; label: string; url: string }[] = [
  { id: 'facebook', label: 'Facebook', url: '' },
  { id: 'instagram', label: 'Instagram', url: 'https://www.instagram.com/nandanatextiles/' },
  { id: 'whatsapp', label: 'WhatsApp', url: `https://wa.me/${WHATSAPP_NUMBER}` },
  { id: 'tiktok', label: 'TikTok', url: '' },
  { id: 'youtube', label: 'YouTube', url: '' },
];

export const activeSocialLinks = () => SOCIAL_LINKS.filter((s) => s.url);

/** A wa.me link, optionally with a pre-typed message. */
export function whatsappUrl(message?: string): string {
  const base = `https://wa.me/${WHATSAPP_NUMBER}`;
  return message ? `${base}?text=${encodeURIComponent(message)}` : base;
}
