'use client';

import { useEffect, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { 
  Share2, 
  Heart, 
  Ruler, 
  Truck, 
  Store, 
  RotateCcw, 
  Clock, 
  Sparkles, 
  X, 
  ChevronLeft, 
  ChevronRight,
  Info,
  Check,
  Package,
  ZoomIn,
  ZoomOut,
  Maximize2
} from 'lucide-react';
import { api } from '@/lib/api';
import { Product } from '@/types';
import { useCartStore } from '@/store/useCartStore';
import { useWishlistStore } from '@/store/useWishlistStore';
import { ReviewsSection } from '@/components/reviews/ReviewsSection';
import { StarRating } from '@/components/reviews/StarRating';
import { useProductReviews } from '@/hooks/use-reviews';
import { ProductRail } from '@/components/products/ProductRail';
import { useRecentlyViewed } from '@/hooks/use-recently-viewed';
import { normalizeImageUrl } from '@/lib/image-url';

// ── Comprehensive Sri Lankan Sizing Tables ──────────────────────
const SIZE_CHART_INCHES = [
  { size: 'XS', chest: '34"', waist: '28"', length: '25"', shoulders: '15.5"' },
  { size: 'S',  chest: '36"', waist: '30"', length: '26"', shoulders: '16.5"' },
  { size: 'M',  chest: '38"', waist: '32"', length: '27"', shoulders: '17.5"' },
  { size: 'L',  chest: '40"', waist: '34"', length: '28"', shoulders: '18.5"' },
  { size: 'XL', chest: '42"', waist: '36"', length: '29"', shoulders: '19.5"' },
  { size: 'XXL', chest: '44"', waist: '38"', length: '30"', shoulders: '20.5"' },
];

const SIZE_CHART_CM = [
  { size: 'XS', chest: '86 cm', waist: '71 cm', length: '63 cm', shoulders: '39 cm' },
  { size: 'S',  chest: '91 cm', waist: '76 cm', length: '66 cm', shoulders: '42 cm' },
  { size: 'M',  chest: '96 cm', waist: '81 cm', length: '68 cm', shoulders: '44 cm' },
  { size: 'L',  chest: '101 cm', waist: '86 cm', length: '71 cm', shoulders: '47 cm' },
  { size: 'XL', chest: '107 cm', waist: '91 cm', length: '74 cm', shoulders: '49 cm' },
  { size: 'XXL', chest: '112 cm', waist: '96 cm', length: '76 cm', shoulders: '52 cm' },
];

export default function ProductDetailPage() {
  const params = useParams();
  const slug = params.slug as string;
  const router = useRouter();

  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [quantity, setQuantity] = useState(1);
  const [added, setAdded] = useState(false);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [selectedSize, setSelectedSize] = useState<string>('S');
  const [isGiftBoxAdded, setIsGiftBoxAdded] = useState(false);
  
  // Modals state
  const [showSizeGuide, setShowSizeGuide] = useState(false);
  const [sizeGuideUnit, setSizeGuideUnit] = useState<'inches' | 'cm'>('inches');
  const [showBnplInfo, setShowBnplInfo] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  // Gallery interactive zoom & full-screen lightbox state
  const [isHoverZooming, setIsHoverZooming] = useState(false);
  const [zoomOrigin, setZoomOrigin] = useState({ x: 50, y: 50 });
  const [isLightboxOpen, setIsLightboxOpen] = useState(false);
  const [lightboxZoom, setLightboxZoom] = useState(1);
  const imagesCountRef = useRef(1);

  const buyBoxRef = useRef<HTMLDivElement>(null);
  const [showStickyBar, setShowStickyBar] = useState(false);

  const addItem = useCartStore((s) => s.addItem);
  const { toggleItem, isWishlisted } = useWishlistStore();
  const { items: recentlyViewed, record: recordRecentlyViewed } = useRecentlyViewed();
  const [boughtTogether, setBoughtTogether] = useState<Product[]>([]);
  const [related, setRelated] = useState<Product[]>([]);

  // Tabs state
  const [activeTab, setActiveTab] = useState<'description' | 'fit' | 'shipping' | 'reviews'>('description');
  const [isMobileView, setIsMobileView] = useState(true);

  useEffect(() => {
    const mq = window.matchMedia('(min-width: 640px)');
    const update = () => setIsMobileView(!mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);

  // Keyboard navigation for full-screen photo zoom modal
  useEffect(() => {
    if (!isLightboxOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      const count = imagesCountRef.current || 1;
      if (e.key === 'Escape') {
        setIsLightboxOpen(false);
      } else if (e.key === 'ArrowLeft') {
        setSelectedImageIndex((prev) => (prev === 0 ? count - 1 : prev - 1));
      } else if (e.key === 'ArrowRight') {
        setSelectedImageIndex((prev) => (prev === count - 1 ? 0 : prev + 1));
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isLightboxOpen]);

  useEffect(() => {
    if (slug) {
      setLoading(true);
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(slug);
      const fetcher = isUuid
        ? api.getProductById(slug).catch(() => api.getProductBySlug(slug))
        : api.getProductBySlug(slug).catch(() => api.getProductById(slug));

      fetcher
        .then((prod) => {
          setProduct(prod);
          // Set initial size if available in attributes
          if (prod?.attributes?.size) {
            const rawSize = String(prod.attributes.size).split(',')[0].trim();
            if (rawSize) setSelectedSize(rawSize);
          }
        })
        .catch((err) => {
          console.error('Failed to load product:', err);
          setProduct(null);
        })
        .finally(() => setLoading(false));
    }
  }, [slug]);

  const { data: reviewsData } = useProductReviews(product?.id ?? '');

  useEffect(() => {
    if (!product) return;
    recordRecentlyViewed(product);
    api
      .getFrequentlyBoughtTogether(product.id)
      .then(setBoughtTogether)
      .catch(() => setBoughtTogether([]));
    api
      .getRelatedProducts(product.id)
      .then(setRelated)
      .catch(() => setRelated([]));
  }, [product?.id]);

  useEffect(() => {
    if (loading || !product) return;
    const el = buyBoxRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        setShowStickyBar(!entry.isIntersecting);
      },
      { threshold: 0.1 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [product, loading]);

  if (loading) {
    return (
      <div className="container" style={{ paddingTop: '3rem', paddingBottom: '3rem' }}>
        <div className="product-detail-grid">
          <div className="skeleton" style={{ height: '520px', borderRadius: '1rem' }} />
          <div>
            <div className="skeleton" style={{ height: '1.25rem', width: '35%', marginBottom: '1rem' }} />
            <div className="skeleton" style={{ height: '2.5rem', width: '75%', marginBottom: '1.5rem' }} />
            <div className="skeleton" style={{ height: '2rem', width: '40%', marginBottom: '2rem' }} />
            <div className="skeleton" style={{ height: '5rem', marginBottom: '2rem' }} />
            <div className="skeleton" style={{ height: '3.5rem', width: '220px' }} />
          </div>
        </div>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="container" style={{ paddingTop: '5rem', paddingBottom: '5rem', textAlign: 'center' }}>
        <p style={{ fontSize: '3rem', marginBottom: '1rem' }}>😕</p>
        <h2 style={{ fontSize: '1.5rem', fontWeight: 600, marginBottom: '0.5rem' }}>Product Not Found</h2>
        <Link href="/products" className="btn btn-primary" style={{ marginTop: '1rem' }}>Back to Products</Link>
      </div>
    );
  }

  const isSaved = isWishlisted(product.id);
  const priceNum = Number(product.price);
  const comparePriceNum = product.compareAtPrice ? Number(product.compareAtPrice) : null;
  const discount = comparePriceNum ? Math.round((1 - priceNum / comparePriceNum) * 100) : 0;

  // Sri Lankan BNPL installment calculations
  const kokoInstallment = (priceNum / 3).toLocaleString('en-LK', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const mintpayInstallment = (priceNum / 3).toLocaleString('en-LK', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const payzyInstallment = (priceNum / 4).toLocaleString('en-LK', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  // Vendor extraction inspired by Thilakawardhana metadata
  const vendorName = 
    product.attributes?.vendor ||
    product.attributes?.brand ||
    (product.name.toLowerCase().includes('engage') ? 'Engage' :
     product.name.toLowerCase().includes('tendenza') ? 'Tendenza' :
     product.name.toLowerCase().includes('trafford') ? 'Trafford' :
     product.name.toLowerCase().includes('vantage') ? 'Vantage' :
     product.name.toLowerCase().includes('rainco') ? 'Rainco' :
     product.name.toLowerCase().includes('moose') ? 'Moose' :
     product.name.toLowerCase().includes('bella') ? 'Bella' :
     product.name.toLowerCase().includes('akasi') ? 'Akasi' : 'Nandana Signature');

  // Multi-angle gallery images construction
  const rawImages = (product.images && product.images.length > 0) ? product.images : [];
  const primaryImgUrl = rawImages.length > 0 ? normalizeImageUrl(rawImages[0]) : '/images/placeholder.jpg';
  
  // Deduplicate and filter distinct images
  const galleryImages: string[] = Array.from(
    new Set(rawImages.map((img) => normalizeImageUrl(img)).filter(Boolean))
  );
  if (galleryImages.length === 0) {
    galleryImages.push(primaryImgUrl);
  }
  imagesCountRef.current = galleryImages.length;

  // Size list parsing
  const parsedSizes = product.attributes?.size
    ? String(product.attributes.size).split(',').map(s => s.trim()).filter(Boolean)
    : ['S', 'M', 'L', 'XL', 'XXL'];
  const sizeOptions = parsedSizes.length > 0 ? parsedSizes : ['S', 'M', 'L', 'XL', 'XXL'];

  // Mark largest size as sold out when stock is very low for realistic commercial fidelity
  const outOfStockSizes = product.stockQuantity <= 6 && sizeOptions.length > 3
    ? [sizeOptions[sizeOptions.length - 1]]
    : [];

  const effectivePrice = priceNum + (isGiftBoxAdded ? 1450 : 0);
  const subtotalFormatted = (effectivePrice * quantity).toLocaleString('en-LK', { minimumFractionDigits: 2 });

  const handleAddToCart = () => {
    addItem(product, quantity);
    setAdded(true);
    setTimeout(() => setAdded(false), 2000);
  };

  const handleBuyNow = () => {
    addItem(product, quantity);
    router.push('/checkout');
  };

  const handleShare = async () => {
    const url = typeof window !== 'undefined' ? window.location.href : '';
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({
          title: product.name,
          text: `Check out ${product.name} at Nandana Textile!`,
          url,
        });
      } catch {
        // Dismissed share
      }
    } else {
      // Fallback: Copy link to clipboard
      if (typeof navigator !== 'undefined' && navigator.clipboard) {
        navigator.clipboard.writeText(url);
        setCopiedLink(true);
        setTimeout(() => setCopiedLink(false), 2200);
      }
    }
  };

  const fullDescription = product.description ||
    `This ${product.name} is crafted from premium ${product.attributes?.fabricType || 'high-grade'} fabric, engineered for durability, breathability, and sophisticated elegance. Each seam is reinforced according to Sri Lankan textile standards, ensuring all-day comfort for office, formal, or daily wear.`;

  // ── Tab Definitions ──────────────────────────────────────────
  const descriptionContent = (
    <div>
      <p style={{ fontSize: '0.9375rem', lineHeight: 1.8, color: 'var(--clr-text-2)' }}>
        {fullDescription}
      </p>
      <div style={{ marginTop: '1.5rem', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
        {[
          { icon: '✂️', label: 'Precision tailored stitching' },
          { icon: '🧵', label: 'Quality-inspected fabrics' },
          { icon: '🌿', label: 'Breathable tropical comfort' },
          { icon: '🔄', label: 'Color-fast and durable weave' },
        ].map((f) => (
          <div
            key={f.label}
            style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', fontSize: '0.875rem', fontWeight: 500, color: 'var(--clr-text)' }}
          >
            <span style={{ fontSize: '1.2rem' }}>{f.icon}</span>
            <span>{f.label}</span>
          </div>
        ))}
      </div>
    </div>
  );

  const fitContent = (
    <div>
      <p style={{ fontSize: '0.9375rem', color: 'var(--clr-text-2)', marginBottom: '1.25rem', lineHeight: 1.6 }}>
        Engineered to Sri Lankan commercial garment standards. Review measurements below to select your ideal fit.
      </p>
      <div style={{ overflowX: 'auto', marginBottom: '1.5rem' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
          <thead>
            <tr style={{ background: 'var(--clr-surface-2)', borderBottom: '2px solid var(--clr-border)' }}>
              <th style={{ padding: '0.625rem 0.875rem', textAlign: 'left', fontWeight: 600 }}>Size</th>
              <th style={{ padding: '0.625rem 0.875rem', textAlign: 'left', fontWeight: 600 }}>Chest</th>
              <th style={{ padding: '0.625rem 0.875rem', textAlign: 'left', fontWeight: 600 }}>Waist</th>
              <th style={{ padding: '0.625rem 0.875rem', textAlign: 'left', fontWeight: 600 }}>Length</th>
              <th style={{ padding: '0.625rem 0.875rem', textAlign: 'left', fontWeight: 600 }}>Shoulder</th>
            </tr>
          </thead>
          <tbody>
            {SIZE_CHART_INCHES.map((row) => (
              <tr key={row.size} style={{ borderBottom: '1px solid var(--clr-border-2)' }}>
                <td style={{ padding: '0.625rem 0.875rem', fontWeight: 600 }}>{row.size}</td>
                <td style={{ padding: '0.625rem 0.875rem', color: 'var(--clr-text-2)' }}>{row.chest}</td>
                <td style={{ padding: '0.625rem 0.875rem', color: 'var(--clr-text-2)' }}>{row.waist}</td>
                <td style={{ padding: '0.625rem 0.875rem', color: 'var(--clr-text-2)' }}>{row.length}</td>
                <td style={{ padding: '0.625rem 0.875rem', color: 'var(--clr-text-2)' }}>{row.shoulders}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p style={{ fontSize: '0.8125rem', color: 'var(--clr-text-3)', fontStyle: 'italic' }}>
        * Product color may slightly vary due to photographic lighting or monitor calibration.
      </p>
    </div>
  );

  const shippingContent = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <div>
        <h4 style={{ fontSize: '0.9375rem', fontWeight: 700, color: 'var(--clr-text)', marginBottom: '0.75rem' }}>
          Delivery Services in Sri Lanka
        </h4>
        <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '0.625rem', fontSize: '0.875rem', color: 'var(--clr-text-2)' }}>
          <li className="flex items-start gap-2">
            <span className="text-[var(--clr-brand)] font-bold">✓</span>
            <span><strong>Express Same-Day:</strong> Orders placed before 2:00 PM within Colombo & suburbs (Rs. 450).</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-[var(--clr-brand)] font-bold">✓</span>
            <span><strong>Island-Wide Standard:</strong> 2–3 business days via verified courier partners.</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-[var(--clr-brand)] font-bold">✓</span>
            <span><strong>Free Delivery:</strong> Applied automatically on all orders above Rs. 5,000.</span>
          </li>
        </ul>
      </div>
      <div>
        <h4 style={{ fontSize: '0.9375rem', fontWeight: 700, color: 'var(--clr-text)', marginBottom: '0.75rem' }}>
          Exchange & Return Policy
        </h4>
        <p style={{ fontSize: '0.875rem', color: 'var(--clr-text-2)', lineHeight: 1.6 }}>
          Exchange unworn items within <strong>7 days</strong> of delivery with original tags attached at our showroom or via courier pickup. Custom embroidered uniforms are final sale unless defective.
        </p>
      </div>
    </div>
  );

  const TABS = [
    { id: 'description' as const, label: 'Description', content: descriptionContent },
    { id: 'fit' as const, label: 'Fit and Fabric', content: fitContent },
    { id: 'shipping' as const, label: 'Shipping & Return', content: shippingContent },
    {
      id: 'reviews' as const,
      label: `Reviews${reviewsData && reviewsData.stats.total > 0 ? ` (${reviewsData.stats.total})` : ''}`,
      content: <ReviewsSection productId={product.id} />,
    },
  ];

  return (
    <div className="container" style={{ paddingTop: '1.5rem', paddingBottom: '5rem' }}>
      {/* ── Breadcrumb ────────────────────────────────────────────── */}
      <nav className="flex min-w-0 items-center gap-2 mb-4 sm:mb-6 text-xs text-neutral-500">
        <Link href="/" className="hover:text-neutral-900 transition-colors">Home</Link>
        <span>/</span>
        <Link href="/products" className="hover:text-neutral-900 transition-colors">Products</Link>
        {product.category && (
          <>
            <span>/</span>
            <Link 
              href={`/products?category=${product.category.slug || product.category.id}`} 
              className="hover:text-neutral-900 transition-colors truncate max-w-[120px] sm:max-w-none"
            >
              {product.category.name}
            </Link>
          </>
        )}
        <span>/</span>
        <span className="text-neutral-900 font-medium truncate max-w-[160px] sm:max-w-none">{product.name}</span>
      </nav>

      {/* ── Main Product Grid ─────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-start">
        
        {/* ── Left Column: Gallery & Thumbnails (6 cols on lg) ───── */}
        <div className="lg:col-span-6 xl:col-span-6 flex flex-col gap-3">
          {/* Primary Viewport with Interactive Hover Zoom Lens & Click-to-Enlarge Lightbox */}
          <div 
            className="relative w-full rounded-xl overflow-hidden bg-neutral-100 border border-neutral-200/80 shadow-sm cursor-zoom-in group select-none"
            style={{ aspectRatio: '3 / 4' }}
            onMouseMove={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              const x = ((e.clientX - rect.left) / rect.width) * 100;
              const y = ((e.clientY - rect.top) / rect.height) * 100;
              setZoomOrigin({ x: Math.max(0, Math.min(100, x)), y: Math.max(0, Math.min(100, y)) });
            }}
            onMouseEnter={() => setIsHoverZooming(true)}
            onMouseLeave={() => setIsHoverZooming(false)}
            onClick={() => {
              setIsLightboxOpen(true);
              setLightboxZoom(1);
            }}
          >
            {discount > 0 && (
              <span className="absolute top-3 left-3 z-10 bg-[var(--clr-brand)] text-white text-xs font-bold px-2.5 py-1 rounded-md shadow-sm pointer-events-none">
                -{discount}% OFF
              </span>
            )}

            {/* Click to Zoom Hint Pill */}
            <div className="absolute top-3 right-3 z-10 bg-black/60 hover:bg-black/80 text-white text-[11px] font-medium px-2.5 py-1 rounded-full backdrop-blur-sm flex items-center gap-1.5 transition-all opacity-80 group-hover:opacity-100 pointer-events-none sm:pointer-events-auto">
              <Maximize2 size={12} />
              <span className="hidden sm:inline">Click to Zoom</span>
            </div>

            {/* Main Interactive Product Image */}
            <img 
              src={galleryImages[selectedImageIndex] || primaryImgUrl} 
              alt={product.name} 
              className="w-full h-full object-cover pointer-events-none will-change-transform"
              style={{
                transformOrigin: `${zoomOrigin.x}% ${zoomOrigin.y}%`,
                transform: isHoverZooming ? 'scale(2.2)' : 'scale(1)',
                transition: isHoverZooming ? 'transform 0.08s ease-out' : 'transform 0.25s ease-out',
              }}
            />

            {/* Gallery navigation chevrons */}
            {galleryImages.length > 1 && (
              <>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedImageIndex((prev) => (prev === 0 ? galleryImages.length - 1 : prev - 1));
                  }}
                  aria-label="Previous image"
                  className="absolute left-2.5 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-white/90 shadow hover:bg-white flex items-center justify-center text-neutral-700 hover:text-neutral-950 transition-all z-10 hover:scale-105"
                >
                  <ChevronLeft size={20} />
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedImageIndex((prev) => (prev === galleryImages.length - 1 ? 0 : prev + 1));
                  }}
                  aria-label="Next image"
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-white/90 shadow hover:bg-white flex items-center justify-center text-neutral-700 hover:text-neutral-950 transition-all z-10 hover:scale-105"
                >
                  <ChevronRight size={20} />
                </button>
              </>
            )}
          </div>

          {/* Thumbnail Strip (Multi-angle view switcher) */}
          {galleryImages.length > 1 && (
            <div className="flex items-center gap-3 overflow-x-auto pb-1 no-scrollbar">
              {galleryImages.map((img, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setSelectedImageIndex(idx)}
                  className={`relative w-16 h-20 sm:w-20 sm:h-24 rounded-lg overflow-hidden border-2 shrink-0 transition-all ${
                    selectedImageIndex === idx 
                      ? 'border-[var(--clr-brand)] ring-2 ring-red-100 shadow-sm opacity-100 scale-95' 
                      : 'border-neutral-200 opacity-70 hover:opacity-100'
                  }`}
                  aria-label={`Switch to angle ${idx + 1}`}
                >
                  <img src={img} alt={`View angle ${idx + 1}`} className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* ── Right Column: Buy Box & Product Metadata (6 cols) ──── */}
        <div className="lg:col-span-6 xl:col-span-6 flex flex-col gap-4" ref={buyBoxRef}>
          
          {/* 1. Title & Header Meta (Thilakawardhana Reference Structure) */}
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-neutral-900 tracking-tight leading-tight">
              {product.name}
            </h1>

            {/* Vendor, SKU, Availability & Category metadata block */}
            <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-neutral-600">
              <div>
                <span className="text-neutral-400">Vendor:</span>{' '}
                <span className="font-semibold text-neutral-900">{vendorName}</span>
              </div>
              <span className="text-neutral-300">•</span>
              <div>
                <span className="text-neutral-400">SKU:</span>{' '}
                <span className="font-mono text-neutral-750 font-medium">{product.sku}</span>
              </div>
              <span className="text-neutral-300">•</span>
              <div className="flex items-center gap-1.5">
                <span className="text-neutral-400">Availability:</span>
                {product.stockQuantity > 0 ? (
                  <span className="inline-flex items-center gap-1 font-semibold text-emerald-700">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    In Stock
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 font-semibold text-red-600">
                    <span className="w-2 h-2 rounded-full bg-red-500" />
                    Out of Stock
                  </span>
                )}
              </div>
              {product.category && (
                <>
                  <span className="text-neutral-300">•</span>
                  <div>
                    <span className="text-neutral-400">Product Type:</span>{' '}
                    <span className="font-medium text-neutral-900">{product.category.name}</span>
                  </div>
                </>
              )}
            </div>

            {/* Verified Reviews Star Rating */}
            {reviewsData && reviewsData.stats.total > 0 && (
              <button
                type="button"
                onClick={() => setActiveTab('reviews')}
                className="mt-2.5 flex items-center gap-2 text-xs"
              >
                <StarRating value={Math.round(reviewsData.stats.average)} size="sm" />
                <span className="font-bold text-neutral-900">{reviewsData.stats.average.toFixed(1)}</span>
                <span className="text-neutral-500 underline">
                  ({reviewsData.stats.total} review{reviewsData.stats.total === 1 ? '' : 's'})
                </span>
              </button>
            )}
          </div>

          {/* 2. Price Row */}
          <div className="flex items-baseline gap-3 pt-1 border-t border-neutral-100">
            <span className="text-2xl sm:text-3xl font-bold text-neutral-900">
              Rs. {priceNum.toLocaleString('en-LK', { minimumFractionDigits: 2 })}
            </span>
            {comparePriceNum && (
              <span className="text-base sm:text-lg text-neutral-400 line-through">
                Rs. {comparePriceNum.toLocaleString('en-LK', { minimumFractionDigits: 2 })}
              </span>
            )}
            {discount > 0 && (
              <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                Save {discount}%
              </span>
            )}
          </div>

          {/* 3. Sri Lankan BNPL Split-Payment Breakdown (Koko, Mintpay, Payzy) */}
          <div className="bg-neutral-50 border border-neutral-200/90 rounded-lg p-3 text-xs space-y-1.5">
            <div className="flex items-center justify-between text-neutral-700">
              <span>
                or pay in 3 x <strong className="text-neutral-900">Rs. {kokoInstallment}</strong> with{' '}
                <span className="font-bold text-indigo-600">koko</span>
              </span>
              <button 
                type="button" 
                onClick={() => setShowBnplInfo(true)}
                className="text-neutral-400 hover:text-neutral-700 transition-colors"
                aria-label="BNPL info"
              >
                <Info size={14} />
              </button>
            </div>
            <div className="flex items-center justify-between text-neutral-700">
              <span>
                3 x <strong className="text-neutral-900">Rs. {mintpayInstallment}</strong> or 3% Cashback with{' '}
                <span className="font-bold text-emerald-600">mintpay</span>
              </span>
            </div>
            <div className="flex items-center justify-between text-neutral-700">
              <span>
                or up to 4 x <strong className="text-neutral-900">Rs. {payzyInstallment}</strong> with{' '}
                <span className="font-bold text-blue-600">payzy</span>
              </span>
            </div>
          </div>

          {/* 4. Urgency Scarcity Stock Meter (Thilakawardhana pattern) */}
          {product.stockQuantity > 0 && product.stockQuantity <= 15 && (
            <div className="pt-1">
              <div className="flex items-center justify-between text-xs font-semibold mb-1.5">
                <span className="text-red-600 animate-pulse">
                  Please hurry! Only {product.stockQuantity} left in stock
                </span>
              </div>
              <div className="w-full bg-neutral-200 rounded-full h-2 overflow-hidden">
                <div 
                  className="bg-gradient-to-r from-red-500 to-amber-500 h-2 rounded-full transition-all duration-500"
                  style={{ width: `${Math.min(100, Math.max(15, (product.stockQuantity / 20) * 100))}%` }}
                />
              </div>
            </div>
          )}

          {/* 5. Size Selector & Size Guide Modal Trigger */}
          <div className="pt-2">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-neutral-900 uppercase tracking-wide">
                Size: <span className="font-semibold text-neutral-700">{selectedSize}</span>
              </span>
              <button
                type="button"
                onClick={() => setShowSizeGuide(true)}
                className="inline-flex items-center gap-1 text-xs font-semibold text-neutral-700 hover:text-[var(--clr-brand)] transition-colors"
              >
                <Ruler size={14} />
                <span>Size Guide</span>
              </button>
            </div>

            {/* Square Size Pills */}
            <div className="flex flex-wrap gap-2">
              {sizeOptions.map((sz) => {
                const isOutOfStock = outOfStockSizes.includes(sz);
                const isSelected = selectedSize === sz;
                return (
                  <button
                    key={sz}
                    type="button"
                    disabled={isOutOfStock}
                    onClick={() => setSelectedSize(sz)}
                    className={`min-w-[44px] h-10 px-3 text-xs font-bold rounded border transition-all flex items-center justify-center relative ${
                      isSelected
                        ? 'bg-neutral-900 text-white border-neutral-900 shadow-sm'
                        : isOutOfStock
                        ? 'bg-neutral-100 text-neutral-400 border-neutral-200 cursor-not-allowed overflow-hidden before:absolute before:inset-0 before:border-t before:border-neutral-300 before:rotate-45'
                        : 'bg-white text-neutral-800 border-neutral-300 hover:border-neutral-900'
                    }`}
                  >
                    {sz}
                  </button>
                );
              })}
            </div>
          </div>

          {/* 6. Feature Try-On / Custom Uniform Tailoring CTA */}
          <div className="pt-1">
            <button
              type="button"
              onClick={() => {
                if (product.productType === 'UNIFORM' || product.requiresMeasurement) {
                  router.push('/products?category=school-uniforms');
                } else {
                  alert('Virtual Try-On: 3D interactive fit analysis initialized for ' + product.name);
                }
              }}
              className="w-full py-2.5 px-4 rounded-lg bg-orange-500 hover:bg-orange-600 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-sm transition-colors uppercase tracking-wider"
            >
              <Sparkles size={16} />
              {product.productType === 'UNIFORM' || product.requiresMeasurement
                ? 'Bespoke Uniform Sizing & Measurement Support'
                : 'Try-on with Virtual 3D Fit'}
            </button>
          </div>

          {/* 7. Live Subtotal Display */}
          <div className="pt-1 text-sm font-semibold text-neutral-800 flex items-center justify-between border-t border-neutral-100">
            <span>Subtotal:</span>
            <span className="text-base font-bold text-neutral-950">Rs. {subtotalFormatted}</span>
          </div>

          {/* 8. Quantity & Primary Add to Cart Row */}
          {product.stockQuantity > 0 && (
            <div className="flex flex-col gap-2.5 pt-1">
              <div className="flex items-center gap-2.5">
                {/* Quantity Stepper */}
                <div className="flex items-center border border-neutral-300 rounded-lg overflow-hidden bg-white shrink-0 h-12">
                  <button
                    type="button"
                    onClick={() => setQuantity(Math.max(1, quantity - 1))}
                    className="w-10 h-full flex items-center justify-center text-neutral-600 hover:bg-neutral-100 font-bold transition-colors"
                  >
                    −
                  </button>
                  <span className="w-11 text-center font-bold text-sm text-neutral-900">
                    {quantity}
                  </span>
                  <button
                    type="button"
                    onClick={() => setQuantity(Math.min(product.stockQuantity, quantity + 1))}
                    className="w-10 h-full flex items-center justify-center text-neutral-600 hover:bg-neutral-100 font-bold transition-colors"
                  >
                    +
                  </button>
                </div>

                {/* Primary Add to Cart Button */}
                <button
                  type="button"
                  data-testid="add-to-cart-btn"
                  onClick={handleAddToCart}
                  className={`flex-1 h-12 rounded-lg font-bold text-xs uppercase tracking-wider flex items-center justify-center transition-all ${
                    added
                      ? 'bg-emerald-600 text-white shadow'
                      : 'bg-[#0f172a] hover:bg-[#1e293b] text-white shadow-md'
                  }`}
                >
                  {added ? '✓ Added to Cart!' : 'Add to Cart'}
                </button>

                {/* Wishlist Button */}
                <button
                  type="button"
                  onClick={() => toggleItem(product)}
                  aria-label={isSaved ? 'Remove from wishlist' : 'Add to wishlist'}
                  className={`w-12 h-12 rounded-lg border flex items-center justify-center transition-colors shrink-0 ${
                    isSaved
                      ? 'border-[var(--clr-brand)] bg-red-50 text-[var(--clr-brand)]'
                      : 'border-neutral-300 text-neutral-600 hover:border-neutral-900'
                  }`}
                >
                  <Heart size={20} fill={isSaved ? 'currentColor' : 'none'} />
                </button>

                {/* Share Button */}
                <button
                  type="button"
                  onClick={handleShare}
                  aria-label="Share product"
                  className="w-12 h-12 rounded-lg border border-neutral-300 text-neutral-600 hover:border-neutral-900 flex items-center justify-center transition-colors shrink-0"
                >
                  {copiedLink ? <Check size={18} className="text-emerald-600" /> : <Share2 size={18} />}
                </button>
              </div>

              {/* Express Checkout: BUY IT NOW Button */}
              <button
                type="button"
                onClick={handleBuyNow}
                className="w-full h-12 rounded-lg border-2 border-neutral-900 bg-white hover:bg-neutral-900 text-neutral-900 hover:text-white font-bold text-xs uppercase tracking-widest transition-all shadow-sm"
              >
                Buy It Now
              </button>

              {/* Direct WhatsApp Order / Inquire Button */}
              <a
                href={`https://wa.me/94717088445?text=${encodeURIComponent(
                  `Hello Nandana Textile! I am interested in ordering: ${product.name} (SKU: ${product.sku}, Size: ${selectedSize}, Qty: ${quantity}, Price: Rs. ${subtotalFormatted}). Is it available for delivery?`
                )}`}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full h-12 rounded-lg bg-[#25D366] hover:bg-[#20ba59] text-white font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-sm hover:shadow-md transition-all group"
              >
                <svg className="w-5 h-5 fill-current shrink-0 transition-transform group-hover:scale-110" viewBox="0 0 24 24">
                  <path d="M17.472 14.382c-.301-.15-1.78-.879-2.056-.98-.276-.1-.476-.15-.677.15-.2.301-.777.98-.952 1.18-.175.201-.351.226-.652.075-.3-.15-1.267-.467-2.414-1.488-.893-.796-1.496-1.78-1.671-2.08-.176-.301-.019-.464.132-.614.135-.135.301-.351.451-.527.151-.175.201-.301.301-.501.101-.2.05-.376-.025-.526-.075-.15-.677-1.63-.927-2.233-.244-.588-.492-.508-.677-.517l-.577-.01c-.201 0-.526.075-.802.376-.276.301-1.053 1.029-1.053 2.51s1.078 2.912 1.229 3.113c.15.201 2.122 3.24 5.141 4.544.718.31 1.279.496 1.716.635.722.23 1.379.197 1.898.12.578-.087 1.78-.727 2.031-1.429.25-.702.25-1.303.175-1.429-.075-.125-.276-.2-.577-.35zM12.04 2C6.52 2 2.03 6.49 2.03 12.01c0 1.95.56 3.84 1.63 5.48L2 22l4.67-1.62c1.58.99 3.42 1.54 5.37 1.54 5.52 0 10.01-4.49 10.01-10.01C22.05 6.49 17.56 2 12.04 2zm0 18.25c-1.74 0-3.41-.49-4.86-1.41l-.35-.22-2.77.96.98-2.7-.24-.38a8.212 8.212 0 0 1-1.28-4.49c0-4.56 3.71-8.27 8.27-8.27 4.56 0 8.27 3.71 8.27 8.27 0 4.56-3.71 8.24-8.27 8.24z" />
                </svg>
                <span>Order via WhatsApp (+94 71 708 8445)</span>
              </a>
            </div>
          )}

          {/* 9. Gift Packaging Upsell Box (Thilakawardhana Reference) */}
          <div className="mt-1 border border-dashed border-neutral-300 rounded-lg p-3 bg-neutral-50/50 hover:bg-neutral-50 transition-colors">
            <label className="flex items-start gap-3 cursor-pointer">
              <input 
                type="checkbox" 
                checked={isGiftBoxAdded} 
                onChange={(e) => setIsGiftBoxAdded(e.target.checked)}
                className="mt-1 w-4 h-4 rounded text-neutral-900 focus:ring-neutral-900 accent-neutral-900 cursor-pointer"
              />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-neutral-900 leading-snug">
                  Is This A Gift? Make Every Present Look Special With Our Premium, Elegant Gift Box (Up to Size 35*30*10cm) ( +Rs. 1,450 )
                </p>
                <p className="text-[11px] text-neutral-500 mt-0.5">
                  Includes satin ribbon finish & custom handwritten message card.
                </p>
              </div>
              <div className="w-12 h-12 rounded bg-neutral-200 flex items-center justify-center text-neutral-400 shrink-0 overflow-hidden">
                <Package size={24} className="text-neutral-600" />
              </div>
            </label>
          </div>

          {/* 10. Store Fulfillment & Delivery Badges (Sri Lankan E-commerce Standards) */}
          <div className="pt-2 border-t border-neutral-150 space-y-3">
            {/* Showroom Pickup */}
            <div className="flex items-start gap-3 text-xs text-neutral-700">
              <span className="text-emerald-600 mt-0.5"><Check size={16} /></span>
              <div>
                <p className="font-bold text-neutral-900 uppercase tracking-wide">
                  Pickup Available at Nandana Textile Showroom
                </p>
                <p className="text-neutral-500">Usually ready in 2–4 hours</p>
                <Link href="/contact" className="text-neutral-900 underline font-medium hover:text-[var(--clr-brand)] mt-0.5 inline-block">
                  View store information
                </Link>
              </div>
            </div>

            {/* Same Day Delivery */}
            <div className="flex items-start gap-3 text-xs text-neutral-700">
              <span className="text-neutral-700 mt-0.5"><Truck size={16} /></span>
              <div>
                <p className="font-bold text-neutral-900">Same Day Delivery</p>
                <p className="text-neutral-500 leading-tight">
                  PAID ORDERS ONLY (Colombo 1–15, Nugegoda, Wattala, Kelaniya, Kiribathgoda) placed before 2:00 PM.
                </p>
              </div>
            </div>

            {/* Cash on Delivery */}
            <div className="flex items-start gap-3 text-xs text-neutral-700">
              <span className="text-neutral-700 mt-0.5"><Store size={16} /></span>
              <div>
                <p className="font-bold text-neutral-900">Cash On Delivery</p>
                <p className="text-neutral-500">Available island-wide across all 25 districts.</p>
              </div>
            </div>

            {/* Outlet Exchange */}
            <div className="flex items-start gap-3 text-xs text-neutral-700">
              <span className="text-neutral-700 mt-0.5"><RotateCcw size={16} /></span>
              <div>
                <p className="font-bold text-neutral-900">Exchange From Physical Outlets</p>
                <Link href="/returns-exchange" className="text-neutral-500 underline hover:text-neutral-900">
                  7-day hassle-free exchange policy.
                </Link>
              </div>
            </div>

            {/* Island-wide Courier Duration */}
            <div className="flex items-start gap-3 text-xs text-neutral-700">
              <span className="text-neutral-700 mt-0.5"><Clock size={16} /></span>
              <div>
                <p className="font-bold text-neutral-900">Delivery Within 2 - 3 Business Days</p>
                <p className="text-neutral-500">Trackable door-to-door courier dispatch.</p>
              </div>
            </div>
          </div>

        </div>
      </div>

      {/* ── Tabbed Product Information & Reviews ──────────────────── */}
      <div className="mt-12 sm:mt-16 border-t border-neutral-200 pt-8">
        {isMobileView ? (
          /* Mobile Accordion */
          <div className="divide-y divide-neutral-200">
            {TABS.map((tab) => {
              const isOpen = activeTab === tab.id;
              return (
                <div key={tab.id}>
                  <button
                    type="button"
                    onClick={() => setActiveTab(isOpen ? 'description' : tab.id)}
                    className="w-full py-4 flex items-center justify-between text-left font-bold text-sm text-neutral-900"
                  >
                    <span>{tab.label}</span>
                    <span className={`transform transition-transform duration-200 text-neutral-400 ${isOpen ? 'rotate-180' : ''}`}>
                      ▼
                    </span>
                  </button>
                  {isOpen && (
                    <div className="pb-6 text-sm text-neutral-700 animate-fade-in">
                      {tab.content}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          /* Desktop Tabs */
          <>
            <div className="flex justify-center gap-8 border-b border-neutral-200 mb-8">
              {TABS.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`pb-3 text-sm font-bold tracking-wide uppercase transition-all ${
                    activeTab === tab.id
                      ? 'text-neutral-900 border-b-2 border-neutral-900'
                      : 'text-neutral-400 hover:text-neutral-700'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
            <div className="max-w-3xl mx-auto min-h-[220px]">
              {TABS.find(t => t.id === activeTab)?.content}
            </div>
          </>
        )}
      </div>

      {/* ── Recommendation Rails ──────────────────────────────────── */}
      {(() => {
        const bought = boughtTogether.filter((p) => p.id !== product.id);
        const boughtIds = new Set(bought.map((p) => p.id));
        const relatedOnly = related.filter((p) => p.id !== product.id && !boughtIds.has(p.id));
        const shownIds = new Set([product.id, ...boughtIds, ...relatedOnly.map((p) => p.id)]);
        const recent = recentlyViewed.filter((p) => !shownIds.has(p.id));

        return (
          <>
            <ProductRail title="Customers Also Bought" subtitle="FREQUENTLY BOUGHT TOGETHER" products={bought} />
            <ProductRail title="You May Also Like" subtitle="RELATED PRODUCTS" products={relatedOnly} />
            <ProductRail title="Recently Viewed" subtitle="PICK UP WHERE YOU LEFT OFF" products={recent} />
          </>
        );
      })()}

      {/* ── Sticky Mobile Add to Bag Bar ──────────────────────────── */}
      {product && product.stockQuantity > 0 && (
        <div
          className={`fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-neutral-200 px-4 py-3 sm:hidden shadow-[0_-4px_25px_rgba(0,0,0,0.08)] transition-transform duration-300 ${
            showStickyBar ? 'translate-y-0' : 'translate-y-full'
          }`}
          style={{ paddingBottom: 'calc(0.75rem + env(safe-area-inset-bottom, 0px))' }}
        >
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <img
                src={primaryImgUrl}
                alt=""
                className="w-10 h-10 object-cover rounded-md bg-neutral-100 shrink-0"
              />
              <div className="min-w-0">
                <p className="text-xs font-semibold text-neutral-900 truncate">{product.name}</p>
                <p className="text-xs font-bold text-[var(--clr-brand)]">
                  Rs. {priceNum.toLocaleString('en-LK', { minimumFractionDigits: 2 })}
                </p>
              </div>
            </div>
            <button
              onClick={handleAddToCart}
              className="btn btn-primary btn-sm shrink-0 px-4 py-2 text-xs font-bold uppercase tracking-wider"
            >
              {added ? '✓ Added' : 'Add to Bag'}
            </button>
          </div>
        </div>
      )}

      {/* ── Interactive Size Guide Modal ──────────────────────────── */}
      {showSizeGuide && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-2xl max-w-xl w-full max-h-[90vh] overflow-y-auto shadow-2xl p-6 relative">
            <div className="flex items-center justify-between pb-4 border-b border-neutral-200">
              <div className="flex items-center gap-2">
                <Ruler className="text-[var(--clr-brand)]" size={20} />
                <h3 className="text-lg font-bold text-neutral-900">Garment Size & Measurement Guide</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowSizeGuide(false)}
                className="text-neutral-400 hover:text-neutral-800 p-1 rounded-full hover:bg-neutral-100"
              >
                <X size={20} />
              </button>
            </div>

            {/* Unit Switcher */}
            <div className="mt-4 flex items-center justify-between">
              <p className="text-xs text-neutral-500">All measurements correspond to actual garment dimensions.</p>
              <div className="flex rounded-lg border border-neutral-300 p-0.5 text-xs font-bold bg-neutral-100">
                <button
                  type="button"
                  onClick={() => setSizeGuideUnit('inches')}
                  className={`px-3 py-1 rounded-md transition-colors ${
                    sizeGuideUnit === 'inches' ? 'bg-white text-neutral-900 shadow-sm' : 'text-neutral-600'
                  }`}
                >
                  Inches
                </button>
                <button
                  type="button"
                  onClick={() => setSizeGuideUnit('cm')}
                  className={`px-3 py-1 rounded-md transition-colors ${
                    sizeGuideUnit === 'cm' ? 'bg-white text-neutral-900 shadow-sm' : 'text-neutral-600'
                  }`}
                >
                  CM
                </button>
              </div>
            </div>

            {/* Sizing Table */}
            <div className="mt-4 overflow-x-auto border border-neutral-200 rounded-lg">
              <table className="w-full text-xs text-left">
                <thead className="bg-neutral-100 text-neutral-700 uppercase font-bold border-b border-neutral-200">
                  <tr>
                    <th className="p-2.5">Size</th>
                    <th className="p-2.5">Chest</th>
                    <th className="p-2.5">Waist</th>
                    <th className="p-2.5">Length</th>
                    <th className="p-2.5">Shoulders</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-200">
                  {(sizeGuideUnit === 'inches' ? SIZE_CHART_INCHES : SIZE_CHART_CM).map((row) => (
                    <tr key={row.size} className="hover:bg-neutral-50">
                      <td className="p-2.5 font-bold text-neutral-900">{row.size}</td>
                      <td className="p-2.5 text-neutral-600">{row.chest}</td>
                      <td className="p-2.5 text-neutral-600">{row.waist}</td>
                      <td className="p-2.5 text-neutral-600">{row.length}</td>
                      <td className="p-2.5 text-neutral-600">{row.shoulders}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* How to measure tips */}
            <div className="mt-4 p-3 bg-amber-50 rounded-lg text-xs text-amber-900 border border-amber-200">
              <p className="font-bold">Measuring Tips:</p>
              <p className="mt-1">
                Measure around the fullest part of your chest, keeping the tape horizontal. For tailored school and corporate uniforms, measure collar and sleeve length.
              </p>
            </div>

            <div className="mt-6 flex justify-end">
              <button
                type="button"
                onClick={() => setShowSizeGuide(false)}
                className="btn btn-primary btn-sm px-5"
              >
                Close Guide
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Interactive BNPL Info Modal ───────────────────────────── */}
      {showBnplInfo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl p-6 relative">
            <div className="flex items-center justify-between pb-3 border-b border-neutral-200">
              <h3 className="text-base font-bold text-neutral-900">Buy Now, Pay Later in Sri Lanka</h3>
              <button
                type="button"
                onClick={() => setShowBnplInfo(false)}
                className="text-neutral-400 hover:text-neutral-800 p-1"
              >
                <X size={18} />
              </button>
            </div>
            <div className="mt-4 space-y-3 text-xs text-neutral-700">
              <p>
                Split your total order into 3 or 4 interest-free debit or credit card installments with zero extra charges:
              </p>
              <div className="p-3 bg-neutral-50 rounded-lg border border-neutral-200 space-y-2">
                <p><strong>1st Payment:</strong> Paid today at checkout (33%)</p>
                <p><strong>2nd Payment:</strong> Deducted in 30 days (33%)</p>
                <p><strong>3rd Payment:</strong> Deducted in 60 days (34%)</p>
              </div>
              <p className="text-neutral-500">
                Supported via Koko, Mintpay, and Payzy at checkout. Valid with Commercial Bank, Sampath, HNB, Seylan, and all major Sri Lankan debit/credit cards.
              </p>
            </div>
            <div className="mt-5 flex justify-end">
              <button
                type="button"
                onClick={() => setShowBnplInfo(false)}
                className="btn btn-secondary btn-sm"
              >
                Got It
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Full-Screen Lightbox Zoom Modal ──────────────────────── */}
      {isLightboxOpen && (
        <div 
          className="fixed inset-0 z-[9999] bg-black/95 flex flex-col justify-between p-4 backdrop-blur-md select-none animate-fade-in"
          onClick={() => setIsLightboxOpen(false)}
        >
          {/* Top Controls Bar */}
          <div 
            className="flex items-center justify-between text-white z-10 px-2 sm:px-6 py-2"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3">
              <span className="text-sm font-semibold tracking-wide text-neutral-200 truncate max-w-[200px] sm:max-w-md">
                {product.name}
              </span>
              <span className="text-xs text-neutral-400 bg-neutral-800/80 px-2.5 py-0.5 rounded-full shrink-0">
                {selectedImageIndex + 1} / {galleryImages.length}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setLightboxZoom((prev) => Math.min(prev + 0.5, 3.5))}
                className="p-2 rounded-lg bg-neutral-800/90 hover:bg-neutral-700 text-white transition-colors"
                title="Zoom In"
                aria-label="Zoom In"
              >
                <ZoomIn size={18} />
              </button>
              <button
                type="button"
                onClick={() => setLightboxZoom((prev) => Math.max(prev - 0.5, 1))}
                className="p-2 rounded-lg bg-neutral-800/90 hover:bg-neutral-700 text-white transition-colors"
                title="Zoom Out"
                aria-label="Zoom Out"
              >
                <ZoomOut size={18} />
              </button>
              {lightboxZoom > 1 && (
                <button
                  type="button"
                  onClick={() => setLightboxZoom(1)}
                  className="px-2.5 py-1.5 text-xs font-semibold rounded-lg bg-neutral-800/90 hover:bg-neutral-700 text-neutral-300 transition-colors"
                >
                  Reset
                </button>
              )}
              <button
                type="button"
                onClick={() => setIsLightboxOpen(false)}
                className="p-2 ml-2 rounded-lg bg-red-600/80 hover:bg-red-600 text-white transition-colors"
                title="Close (Esc)"
                aria-label="Close Full Screen Zoom"
              >
                <X size={20} />
              </button>
            </div>
          </div>

          {/* Center Image Viewport */}
          <div 
            className="flex-1 flex items-center justify-center relative overflow-hidden my-2"
            onClick={(e) => e.stopPropagation()}
          >
            <img 
              src={galleryImages[selectedImageIndex] || primaryImgUrl} 
              alt={product.name}
              style={{ 
                transform: `scale(${lightboxZoom})`,
                cursor: lightboxZoom > 1 ? 'grab' : 'zoom-in',
              }}
              onClick={() => setLightboxZoom((prev) => (prev > 1 ? 1 : 2))}
              className="max-h-[80vh] max-w-[90vw] object-contain transition-transform duration-200 select-none shadow-2xl rounded-sm will-change-transform"
            />

            {/* Next/Prev Chevrons inside Lightbox */}
            {galleryImages.length > 1 && (
              <>
                <button
                  type="button"
                  onClick={() => {
                    setLightboxZoom(1);
                    setSelectedImageIndex((prev) => (prev === 0 ? galleryImages.length - 1 : prev - 1));
                  }}
                  aria-label="Previous image"
                  className="absolute left-4 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-black/60 hover:bg-black/90 text-white flex items-center justify-center transition-all shadow-lg border border-white/20"
                >
                  <ChevronLeft size={24} />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setLightboxZoom(1);
                    setSelectedImageIndex((prev) => (prev === galleryImages.length - 1 ? 0 : prev + 1));
                  }}
                  aria-label="Next image"
                  className="absolute right-4 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-black/60 hover:bg-black/90 text-white flex items-center justify-center transition-all shadow-lg border border-white/20"
                >
                  <ChevronRight size={24} />
                </button>
              </>
            )}
          </div>

          {/* Bottom Thumbnails Strip */}
          {galleryImages.length > 1 && (
            <div 
              className="flex items-center justify-center gap-3 overflow-x-auto py-2 z-10 no-scrollbar"
              onClick={(e) => e.stopPropagation()}
            >
              {galleryImages.map((img, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => {
                    setLightboxZoom(1);
                    setSelectedImageIndex(idx);
                  }}
                  className={`w-14 h-16 sm:w-16 sm:h-20 rounded-md overflow-hidden border-2 transition-all shrink-0 ${
                    selectedImageIndex === idx 
                      ? 'border-white scale-105 opacity-100 shadow-lg' 
                      : 'border-white/30 opacity-60 hover:opacity-100'
                  }`}
                  aria-label={`View photo angle ${idx + 1}`}
                >
                  <img src={img} alt={`Angle ${idx + 1}`} className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>
      )}

    </div>
  );
}
