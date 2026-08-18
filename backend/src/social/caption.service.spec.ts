import { ConfigService } from '@nestjs/config';

import { CaptionProduct, CaptionService } from './caption.service';

/**
 * The caption generator is pure — no DB, no network — so it's tested directly
 * with a stub ConfigService. These assertions pin the shape a supervisor (and
 * the shop owner) will judge: the essentials are present, the emoji count is
 * restrained, and thin data degrades gracefully instead of printing blanks.
 */
describe('CaptionService', () => {
  const config = {
    get: (key: string) =>
      ({
        SHOP_BRAND: 'Nandana Textile',
        SHOP_BASE_URL: 'https://nandana.lk',
        SHOP_WHATSAPP: '+94771234567',
        SHOP_PAYMENTS: 'KOKO & Mintpay easy payments',
      })[key],
  } as unknown as ConfigService;

  const service = new CaptionService(config);

  const dress: CaptionProduct = {
    name: 'Wildflower Garden Embroidered Dress',
    slug: 'wildflower-garden-embroidered-dress',
    description: 'Breezy hand-embroidered cotton. Effortless daytime elegance.',
    price: 2995,
    productType: 'READY_MADE',
    fabricType: 'Cotton',
    color: 'White',
    unit: 'piece',
    attributes: { sizes: ['M', 'L', 'XL', 'XXL'] },
  };

  it('includes the name, formatted price, sizes, material, link and contact', () => {
    const caption = service.build(dress);

    expect(caption).toContain('Wildflower Garden Embroidered Dress');
    expect(caption).toContain('Rs 2,995.00');
    expect(caption).toContain('Sizes: M · L · XL · XXL');
    expect(caption).toContain('Cotton · White');
    expect(caption).toContain(
      'https://nandana.lk/products/wildflower-garden-embroidered-dress',
    );
    expect(caption).toContain('Cash on Delivery');
    expect(caption).toContain('+94771234567');
  });

  it('uses the product description as the benefit line, first sentence only', () => {
    const caption = service.build(dress);
    expect(caption).toContain('Breezy hand-embroidered cotton.');
    // The second sentence must not leak in — a caption is a hook, not the blurb.
    expect(caption).not.toContain('Effortless daytime elegance.');
  });

  it('adds relevant hashtags including the brand tag, capped at six', () => {
    const caption = service.build(dress);
    const tags = caption.match(/#[A-Za-z0-9]+/g) ?? [];
    expect(tags).toContain('#NandanaTextile');
    expect(tags).toContain('#Cotton');
    expect(tags.length).toBeLessThanOrEqual(6);
  });

  it('stays restrained on emojis (professional, not spammy)', () => {
    const caption = service.build(dress);
    const emojis = caption.match(/\p{Extended_Pictographic}/gu) ?? [];
    // One hook emoji + three action lines (Order/Delivery/Contact).
    expect(emojis.length).toBeLessThanOrEqual(4);
  });

  it('prices fabric per unit', () => {
    const fabric: CaptionProduct = {
      ...dress,
      name: 'Pure Silk Fabric',
      slug: 'pure-silk-fabric',
      productType: 'FABRIC',
      unit: 'metre',
      attributes: {},
      description: null,
    };
    const caption = service.build(fabric);
    expect(caption).toContain('Rs 2,995.00 / metre');
    // Falls back to the type benefit line when there's no description.
    expect(caption).toContain('Premium quality fabric');
  });

  it('omits optional lines instead of printing blanks when data is thin', () => {
    const bare: CaptionProduct = {
      name: 'Plain Tee',
      slug: 'plain-tee',
      description: null,
      price: 900,
      productType: 'READY_MADE',
      fabricType: null,
      color: null,
      unit: null,
      attributes: {},
    };
    const caption = service.build(bare);
    expect(caption).toContain('Plain Tee');
    expect(caption).toContain('Rs 900.00');
    expect(caption).not.toContain('Sizes:');
    expect(caption).not.toMatch(/\n\s*·\s*\n/); // no empty material line
  });

  it('builds a wa.me share link with the caption url-encoded', () => {
    const caption = service.build(dress);
    const url = service.whatsappShareUrl(caption);
    expect(url.startsWith('https://wa.me/?text=')).toBe(true);
    expect(decodeURIComponent(url.split('text=')[1])).toBe(caption);
  });
});
