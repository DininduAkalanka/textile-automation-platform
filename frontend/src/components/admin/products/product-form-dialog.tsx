'use client';

import { useRef, useState } from 'react';
import { Loader2, Plus, UploadCloud, X } from 'lucide-react';
import { toast } from 'sonner';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog';
import { useCategories } from '@/hooks/use-categories';
import { useCreateProduct, useUpdateProduct } from '@/hooks/use-products';
import { categorySelectOptions } from '@/lib/category-tree';
import { cn } from '@/lib/utils';
import { ProductInput } from '@/services/products.service';
import {
  ACCEPTED_IMAGE_TYPES,
  MAX_IMAGE_BYTES,
  uploadsService,
} from '@/services/uploads.service';
import { Product, ProductType } from '@/types';

const PRODUCT_TYPES: { value: ProductType; label: string }[] = [
  { value: 'READY_MADE', label: 'Ready-made' },
  { value: 'UNIFORM', label: 'Uniform' },
  { value: 'CUSTOM', label: 'Custom' },
  { value: 'FABRIC', label: 'Fabric' },
  { value: 'ACCESSORY', label: 'Accessory' },
];

interface FormState {
  name: string;
  sku: string;
  description: string;
  categoryId: string;
  productType: ProductType;
  fabricType: string;
  color: string;
  unit: string;
  requiresMeasurement: boolean;
  price: string;
  compareAtPrice: string;
  costPrice: string;
  stockQuantity: string;
  images: string[];
}

function emptyForm(): FormState {
  return {
    name: '',
    sku: '',
    description: '',
    categoryId: '',
    productType: 'READY_MADE',
    fabricType: '',
    color: '',
    unit: '',
    requiresMeasurement: false,
    price: '',
    compareAtPrice: '',
    costPrice: '',
    stockQuantity: '',
    images: [],
  };
}

function formFromProduct(p: Product): FormState {
  return {
    name: p.name,
    sku: p.sku,
    description: p.description ?? '',
    categoryId: p.categoryId ?? '',
    productType: p.productType ?? 'READY_MADE',
    fabricType: p.fabricType ?? '',
    color: p.color ?? '',
    unit: p.unit ?? '',
    requiresMeasurement: p.requiresMeasurement ?? false,
    price: String(p.price),
    compareAtPrice: p.compareAtPrice != null ? String(p.compareAtPrice) : '',
    costPrice: p.costPrice != null ? String(p.costPrice) : '',
    stockQuantity: String(p.stockQuantity),
    images: p.images ?? [],
  };
}

const inputClass =
  'w-full rounded-lg border border-[#EAE8E1] bg-white px-3 py-2 text-[13px] text-[#0F0F0F] outline-none transition-colors placeholder:text-[#B8B4A8] focus:border-[#0F0F0F]';
const labelClass =
  'mb-1.5 block text-[10px] font-semibold uppercase tracking-[0.14em] text-[#928E82]';

/**
 * Create/edit, one dialog, two steps (plan Session 2.2, task 1). Step 1 is
 * everything that defines what the product IS — including the catalog
 * attributes (productType, requiresMeasurement, fabricType) that BR3 and the
 * D8 production gate read, which had no admin path to set at all before this
 * session. Step 2 is presentation (images) plus nothing-to-decide-in-a-hurry.
 *
 * stockQuantity only appears in create mode: UpdateProductDto omits it on
 * purpose (Phase 5's Inventory page is the only place stock changes after a
 * product exists, so it can go through the ledger, not a bare column write).
 *
 * This outer component owns only the Dialog shell. The form itself lives in
 * ProductFormInner, mounted fresh (keyed by product id) each time it opens —
 * that gives every field its correct starting value with a lazy useState
 * initializer instead of an effect that calls setState on open, which is
 * both an extra render and something this project's lint config treats as
 * an error (react-hooks/set-state-in-effect).
 */
export function ProductFormDialog({
  product,
  open,
  onClose,
  onCreated,
}: {
  product: Product | null;
  open: boolean;
  onClose: () => void;
  /** Called with the new product after a successful CREATE (not edit) — the
   *  products page uses it to open the "share to social" prompt. */
  onCreated?: (product: Product) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="max-w-lg border-[#EAE8E1] p-0">
        {open && (
          <ProductFormInner
            key={product?.id ?? 'create'}
            product={product}
            onClose={onClose}
            onCreated={onCreated}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function ProductFormInner({
  product,
  onClose,
  onCreated,
}: {
  product: Product | null;
  onClose: () => void;
  onCreated?: (product: Product) => void;
}) {
  const [step, setStep] = useState<1 | 2>(1);
  const [form, setForm] = useState<FormState>(() =>
    product ? formFromProduct(product) : emptyForm(),
  );
  const [newImageUrl, setNewImageUrl] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);

  const { data: categories } = useCategories();
  const createProduct = useCreateProduct();
  const updateProduct = useUpdateProduct();

  const isEdit = product !== null;
  const busy = createProduct.isPending || updateProduct.isPending;

  const priceNum = Number.parseFloat(form.price);
  const costNum = form.costPrice ? Number.parseFloat(form.costPrice) : null;
  const margin =
    costNum != null && Number.isFinite(costNum) && priceNum > 0
      ? ((priceNum - costNum) / priceNum) * 100
      : null;

  const stockNum = Number.parseInt(form.stockQuantity, 10);
  const step1Valid =
    form.name.trim() !== '' &&
    form.sku.trim() !== '' &&
    Number.isFinite(priceNum) &&
    priceNum >= 0 &&
    (isEdit || (Number.isFinite(stockNum) && stockNum >= 0));

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function addImage() {
    const url = newImageUrl.trim();
    if (!url) return;
    set('images', [...form.images, url]);
    setNewImageUrl('');
  }

  /**
   * Upload picked/dropped files and append their URLs. Validated client-side
   * first so an oversized file fails instantly with a clear message rather than
   * after a slow round-trip; the API enforces the same limits regardless.
   */
  async function uploadFiles(files: FileList | null) {
    const chosen = Array.from(files ?? []);
    if (!chosen.length) return;

    const valid: File[] = [];
    for (const file of chosen) {
      if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) {
        toast.error(`${file.name}: only JPG, PNG or WebP images are allowed.`);
        continue;
      }
      if (file.size > MAX_IMAGE_BYTES) {
        toast.error(`${file.name} is larger than 2 MB.`);
        continue;
      }
      valid.push(file);
    }
    if (!valid.length) return;

    setUploading(true);
    try {
      const uploaded = await Promise.all(
        valid.map((file) => uploadsService.uploadImage(file)),
      );
      setForm((f) => ({
        ...f,
        images: [...f.images, ...uploaded.map((u) => u.url)],
      }));
      toast.success(
        uploaded.length === 1 ? 'Image uploaded' : `${uploaded.length} images uploaded`,
      );
    } catch (error) {
      toast.error((error as Error).message || 'Upload failed.');
    } finally {
      setUploading(false);
    }
  }

  function removeImage(index: number) {
    set(
      'images',
      form.images.filter((_, i) => i !== index),
    );
  }

  function submit() {
    if (!step1Valid) return;

    // Partial, not ProductInput: stockQuantity is only ever sent on create
    // (UpdateProductDto omits it — stock changes go through Inventory's
    // ledger, never a bare column write), so it can't be a required field on
    // a payload shape shared with the edit path.
    const payload: Partial<ProductInput> = {
      name: form.name.trim(),
      sku: form.sku.trim(),
      description: form.description.trim() || undefined,
      categoryId: form.categoryId || undefined,
      productType: form.productType,
      fabricType: form.fabricType.trim() || undefined,
      color: form.color.trim() || undefined,
      unit: form.unit.trim() || undefined,
      requiresMeasurement: form.requiresMeasurement,
      price: priceNum,
      compareAtPrice: form.compareAtPrice
        ? Number.parseFloat(form.compareAtPrice)
        : undefined,
      costPrice: form.costPrice ? Number.parseFloat(form.costPrice) : undefined,
      images: form.images,
    };
    if (!isEdit) {
      payload.stockQuantity = stockNum;
    }

    if (isEdit) {
      updateProduct.mutate({ id: product.id, data: payload }, { onSuccess: onClose });
    } else {
      // step1Valid already guarantees name/sku/price/stockQuantity are set.
      createProduct.mutate(payload as ProductInput, {
        onSuccess: (created) => {
          onClose();
          onCreated?.(created);
        },
      });
    }
  }

  const categoryOptions = categorySelectOptions(categories ?? []);

  return (
    <>
      <div className="border-b border-[#EAE8E1] px-6 pb-4 pt-6">
        <DialogTitle className="text-[15px] font-semibold text-[#0F0F0F]">
          {isEdit ? `Edit ${product.name}` : 'New product'}
        </DialogTitle>
        <DialogDescription className="mt-0.5 text-xs text-[#928E82]">
          Step {step} of 2 — {step === 1 ? 'Basics' : 'Media'}
        </DialogDescription>
      </div>

        <div className="max-h-[60vh] space-y-4 overflow-y-auto px-6 py-4">
          {step === 1 ? (
            <>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="col-span-1 sm:col-span-2">
                  <label className={labelClass} htmlFor="pf-name">Name</label>
                  <input
                    id="pf-name"
                    autoFocus
                    value={form.name}
                    onChange={(e) => set('name', e.target.value)}
                    className={inputClass}
                    placeholder="Corporate Executive Blazer"
                  />
                </div>

                <div>
                  <label className={labelClass} htmlFor="pf-sku">SKU</label>
                  <input
                    id="pf-sku"
                    value={form.sku}
                    onChange={(e) => set('sku', e.target.value)}
                    className={cn(inputClass, 'font-mono')}
                    placeholder="UNI-COR-001"
                  />
                </div>

                <div>
                  <label className={labelClass} htmlFor="pf-category">Category</label>
                  <select
                    id="pf-category"
                    value={form.categoryId}
                    onChange={(e) => set('categoryId', e.target.value)}
                    className={inputClass}
                  >
                    <option value="">No category</option>
                    {categoryOptions.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="col-span-1 sm:col-span-2">
                  <label className={labelClass} htmlFor="pf-desc">Description</label>
                  <textarea
                    id="pf-desc"
                    value={form.description}
                    onChange={(e) => set('description', e.target.value)}
                    rows={2}
                    className={inputClass}
                  />
                </div>

                <div>
                  <label className={labelClass} htmlFor="pf-type">Type</label>
                  <select
                    id="pf-type"
                    value={form.productType}
                    onChange={(e) => set('productType', e.target.value as ProductType)}
                    className={inputClass}
                  >
                    {PRODUCT_TYPES.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex items-end pb-2">
                  <label className="flex items-center gap-2 text-[13px] text-[#4A4740]">
                    <input
                      type="checkbox"
                      checked={form.requiresMeasurement}
                      onChange={(e) => set('requiresMeasurement', e.target.checked)}
                    />
                    Requires measurements
                  </label>
                </div>

                <div>
                  <label className={labelClass} htmlFor="pf-fabric">Fabric type</label>
                  <input
                    id="pf-fabric"
                    value={form.fabricType}
                    onChange={(e) => set('fabricType', e.target.value)}
                    className={inputClass}
                    placeholder="Cotton twill"
                  />
                </div>

                <div>
                  <label className={labelClass} htmlFor="pf-color">Color</label>
                  <input
                    id="pf-color"
                    value={form.color}
                    onChange={(e) => set('color', e.target.value)}
                    className={inputClass}
                    placeholder="Navy"
                  />
                </div>

                <div>
                  <label className={labelClass} htmlFor="pf-unit">Unit</label>
                  <input
                    id="pf-unit"
                    value={form.unit}
                    onChange={(e) => set('unit', e.target.value)}
                    className={inputClass}
                    placeholder="piece / metre"
                  />
                </div>

                {!isEdit && (
                  <div>
                    <label className={labelClass} htmlFor="pf-stock">
                      Opening stock
                    </label>
                    <input
                      id="pf-stock"
                      type="number"
                      inputMode="numeric"
                      value={form.stockQuantity}
                      onChange={(e) => set('stockQuantity', e.target.value)}
                      className={cn(inputClass, 'tabular-nums')}
                      placeholder="0"
                    />
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 gap-3 border-t border-[#F4F3EF] pt-4 sm:grid-cols-3">
                <div>
                  <label className={labelClass} htmlFor="pf-price">Price (LKR)</label>
                  <input
                    id="pf-price"
                    type="number"
                    inputMode="decimal"
                    value={form.price}
                    onChange={(e) => set('price', e.target.value)}
                    className={cn(inputClass, 'tabular-nums')}
                  />
                </div>

                <div>
                  <label className={labelClass} htmlFor="pf-compare">
                    Compare-at price
                  </label>
                  <input
                    id="pf-compare"
                    type="number"
                    inputMode="decimal"
                    value={form.compareAtPrice}
                    onChange={(e) => set('compareAtPrice', e.target.value)}
                    className={cn(inputClass, 'tabular-nums')}
                  />
                </div>

                <div>
                  <label className={labelClass} htmlFor="pf-cost">Cost price</label>
                  <input
                    id="pf-cost"
                    type="number"
                    inputMode="decimal"
                    value={form.costPrice}
                    onChange={(e) => set('costPrice', e.target.value)}
                    className={cn(inputClass, 'tabular-nums')}
                  />
                  {margin != null && (
                    <p
                      className={cn(
                        'mt-1 text-[11px] font-medium',
                        margin < 0 ? 'text-[#CC0000]' : 'text-[#4A7A4A]',
                      )}
                    >
                      {margin.toFixed(1)}% margin
                    </p>
                  )}
                </div>
              </div>
            </>
          ) : (
            <div>
              <label className={labelClass}>Images</label>

              {/* Click-or-drag upload — the primary path. */}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragging(true);
                }}
                onDragLeave={() => setDragging(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragging(false);
                  void uploadFiles(e.dataTransfer.files);
                }}
                disabled={uploading}
                className={cn(
                  'mb-2 flex w-full flex-col items-center justify-center gap-1.5 rounded-xl border-2 border-dashed px-4 py-7 text-center transition-colors',
                  dragging
                    ? 'border-[#0F0F0F] bg-[#F4F3EF]'
                    : 'border-[#D5D2C8] bg-[#FAFAF8] hover:border-[#0F0F0F] hover:bg-[#F4F3EF]',
                  uploading && 'cursor-wait opacity-70',
                )}
              >
                {uploading ? (
                  <>
                    <Loader2 size={18} className="animate-spin text-[#6E6A5E]" aria-hidden />
                    <span className="text-[13px] font-medium text-[#0F0F0F]">
                      Uploading…
                    </span>
                  </>
                ) : (
                  <>
                    <UploadCloud size={20} className="text-[#6E6A5E]" aria-hidden />
                    <span className="text-[13px] font-medium text-[#0F0F0F]">
                      Click to choose images
                    </span>
                    <span className="text-[11px] text-[#928E82]">
                      or drag &amp; drop · JPG, PNG or WebP · up to 2 MB
                    </span>
                  </>
                )}
              </button>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                multiple
                className="hidden"
                onChange={(e) => {
                  void uploadFiles(e.target.files);
                  e.target.value = ''; // allow re-picking the same file
                }}
              />

              {/* Secondary: paste a URL (e.g. an image already hosted). */}
              <details className="mb-2">
                <summary className="cursor-pointer list-none text-[11px] text-[#928E82] hover:text-[#0F0F0F]">
                  or paste an image URL
                </summary>
                <div className="mt-2 flex gap-2">
                  <input
                    value={newImageUrl}
                    onChange={(e) => setNewImageUrl(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        addImage();
                      }
                    }}
                    placeholder="https://…"
                    className={inputClass}
                  />
                  <button
                    type="button"
                    onClick={addImage}
                    className="flex shrink-0 items-center gap-1 rounded-lg border border-[#EAE8E1] bg-white px-3 py-2 text-[12px] font-medium text-[#0F0F0F] transition-colors hover:border-[#0F0F0F]"
                  >
                    <Plus size={13} aria-hidden />
                    Add
                  </button>
                </div>
              </details>

              {form.images.length === 0 ? (
                <p className="rounded-lg bg-[#FAFAF8] px-3 py-6 text-center text-[12px] text-[#928E82]">
                  No images yet. The product will show a placeholder.
                </p>
              ) : (
                <ul className="space-y-2">
                  {form.images.map((url, i) => (
                    <li
                      key={`${url}-${i}`}
                      className="flex items-center gap-2 rounded-lg border border-[#EAE8E1] p-2"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element --
                          admin-pasted URLs from arbitrary hosts; next/image
                          requires each host allow-listed in next.config.ts,
                          which Cloudinary (still deferred) would replace anyway. */}
                      <img
                        src={url}
                        alt=""
                        className="h-10 w-10 shrink-0 rounded object-cover"
                      />
                      <span className="min-w-0 flex-1 truncate text-[12px] text-[#4A4740]">
                        {url}
                      </span>
                      <button
                        type="button"
                        onClick={() => removeImage(i)}
                        aria-label="Remove image"
                        className="shrink-0 rounded p-1 text-[#928E82] hover:bg-[#F4F3EF] hover:text-[#CC0000]"
                      >
                        <X size={13} aria-hidden />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>

        <div className="flex justify-between border-t border-[#EAE8E1] bg-[#FAFAF8] px-6 py-4">
          <button
            type="button"
            onClick={() => (step === 1 ? onClose() : setStep(1))}
            className="rounded-lg px-4 py-2 text-[13px] font-medium text-[#6E6A5E] transition-colors hover:bg-[#EAE8E1]"
          >
            {step === 1 ? 'Cancel' : 'Back'}
          </button>

          {step === 1 ? (
            <button
              type="button"
              disabled={!step1Valid}
              onClick={() => setStep(2)}
              className="rounded-lg bg-[#0F0F0F] px-4 py-2 text-[13px] font-semibold text-white transition-all hover:bg-black disabled:cursor-not-allowed disabled:bg-[#D5D2C8]"
            >
              Next: Media
            </button>
          ) : (
            <button
              type="button"
              onClick={submit}
              // Blocked while images are still uploading: saving mid-upload
              // would create the product WITHOUT the pictures being added.
              disabled={busy || uploading || !step1Valid}
              className="inline-flex items-center gap-2 rounded-lg bg-[#0F0F0F] px-4 py-2 text-[13px] font-semibold text-white transition-all hover:bg-black disabled:cursor-not-allowed disabled:bg-[#D5D2C8]"
            >
              {(busy || uploading) && (
                <Loader2 size={13} className="animate-spin" aria-hidden />
              )}
              {uploading
                ? 'Uploading images…'
                : isEdit
                  ? 'Save changes'
                  : 'Create product'}
            </button>
          )}
        </div>
    </>
  );
}
