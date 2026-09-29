import { Product } from '@/types';

/**
 * BR3 measurement field sets — MIRROR of backend/src/orders/measurements.config.ts.
 *
 * The server is authoritative: it re-validates every line against the product row
 * and rejects the order if anything is missing, so this copy exists only to render
 * the right inputs and to stop the user reaching checkout with a form it will
 * refuse. Keep the two in step by hand — under decision D1 they would be one file
 * in packages/shared, which does not exist. This duplication is deliberate and
 * documented, not an oversight.
 *
 * Tailored garment requirements are matched specifically to the product type:
 * - Shirts (uniform shirts, business shirts) require chest, waist, shoulder, sleeveLength, shirtLength.
 * - Trousers / pants require trouserWaist, hip, trouserLength.
 * - Shorts require trouserWaist, hip, trouserLength.
 * - Frocks / uniform dresses require chest, waist, shoulder, frockLength, sleeveLength.
 * - Skirts require trouserWaist, hip, trouserLength.
 * - Blazers / coats require chest, waist, shoulder, sleeveLength, shirtLength.
 * - Vests / waistcoats require chest, waist, shoulder, shirtLength.
 * - Blouses require chest, waist, shoulder, shirtLength, sleeveLength.
 * - Full uniform sets (two-piece suits/scrubs) require both top & bottom.
 */

export interface MeasurementField {
  key: string;
  label: string;
  min: number;
  max: number;
}

export interface MeasurementSet {
  personName: string;
  label?: string;
  values: Record<string, number>;
}

export type GarmentType =
  | 'SHIRT'
  | 'TROUSER'
  | 'SHORT'
  | 'FROCK'
  | 'SKIRT'
  | 'BLAZER'
  | 'VEST'
  | 'BLOUSE'
  | 'UNIFORM_SET';

export const SHIRT_FIELDS: MeasurementField[] = [
  { key: 'chest', label: 'Chest', min: 20, max: 200 },
  { key: 'waist', label: 'Waist', min: 20, max: 200 },
  { key: 'shoulder', label: 'Shoulder', min: 20, max: 100 },
  { key: 'sleeveLength', label: 'Sleeve length', min: 10, max: 100 },
  { key: 'shirtLength', label: 'Shirt length', min: 20, max: 120 },
];

export const TROUSER_FIELDS: MeasurementField[] = [
  { key: 'trouserWaist', label: 'Trouser waist', min: 20, max: 200 },
  { key: 'hip', label: 'Hip', min: 20, max: 200 },
  { key: 'trouserLength', label: 'Trouser length', min: 30, max: 150 },
];

export const SHORT_FIELDS: MeasurementField[] = [
  { key: 'trouserWaist', label: 'Waist', min: 20, max: 200 },
  { key: 'hip', label: 'Hip', min: 20, max: 200 },
  { key: 'trouserLength', label: 'Short length', min: 20, max: 80 },
];

export const FROCK_FIELDS: MeasurementField[] = [
  { key: 'chest', label: 'Chest', min: 20, max: 200 },
  { key: 'waist', label: 'Waist', min: 20, max: 200 },
  { key: 'shoulder', label: 'Shoulder', min: 20, max: 100 },
  { key: 'frockLength', label: 'Frock length', min: 30, max: 160 },
  { key: 'sleeveLength', label: 'Sleeve length', min: 10, max: 80 },
];

export const SKIRT_FIELDS: MeasurementField[] = [
  { key: 'trouserWaist', label: 'Waist', min: 20, max: 200 },
  { key: 'hip', label: 'Hip', min: 20, max: 200 },
  { key: 'trouserLength', label: 'Skirt length', min: 20, max: 120 },
];

export const BLAZER_FIELDS: MeasurementField[] = [
  { key: 'chest', label: 'Chest', min: 20, max: 200 },
  { key: 'waist', label: 'Waist', min: 20, max: 200 },
  { key: 'shoulder', label: 'Shoulder', min: 20, max: 100 },
  { key: 'sleeveLength', label: 'Sleeve length', min: 15, max: 100 },
  { key: 'shirtLength', label: 'Coat / Jacket length', min: 30, max: 150 },
];

export const VEST_FIELDS: MeasurementField[] = [
  { key: 'chest', label: 'Chest', min: 20, max: 200 },
  { key: 'waist', label: 'Waist', min: 20, max: 200 },
  { key: 'shoulder', label: 'Shoulder', min: 20, max: 100 },
  { key: 'shirtLength', label: 'Vest length', min: 25, max: 100 },
];

export const BLOUSE_FIELDS: MeasurementField[] = [
  { key: 'chest', label: 'Bust / Chest', min: 20, max: 200 },
  { key: 'waist', label: 'Underbust / Waist', min: 20, max: 200 },
  { key: 'shoulder', label: 'Shoulder', min: 20, max: 100 },
  { key: 'shirtLength', label: 'Blouse length', min: 20, max: 100 },
  { key: 'sleeveLength', label: 'Sleeve length', min: 10, max: 80 },
];

export const UNIFORM_SET_FIELDS: MeasurementField[] = [
  ...SHIRT_FIELDS,
  ...TROUSER_FIELDS,
];

export const GARMENT_FIELD_MAP: Record<GarmentType, MeasurementField[]> = {
  SHIRT: SHIRT_FIELDS,
  TROUSER: TROUSER_FIELDS,
  SHORT: SHORT_FIELDS,
  FROCK: FROCK_FIELDS,
  SKIRT: SKIRT_FIELDS,
  BLAZER: BLAZER_FIELDS,
  VEST: VEST_FIELDS,
  BLOUSE: BLOUSE_FIELDS,
  UNIFORM_SET: UNIFORM_SET_FIELDS,
};

export const MEASUREMENT_FIELDS: Record<string, MeasurementField[]> = {
  UNIFORM: UNIFORM_SET_FIELDS,
  CUSTOM: SHIRT_FIELDS,
};

/**
 * Intelligently classifies a product into its precise tailoring garment type
 * based on product attributes, name keywords, and subcategory.
 */
export function detectGarmentType(
  name?: string | null,
  subCategory?: string | null,
  attributes?: any,
): GarmentType | null {
  const explicit = attributes?.garmentType?.toUpperCase?.();
  if (explicit && GARMENT_FIELD_MAP[explicit as GarmentType]) {
    return explicit as GarmentType;
  }

  const text = `${name ?? ''} ${subCategory ?? ''}`.toLowerCase();
  if (!text.trim()) return null;

  // 1. Two-piece sets / Full suits (Top + Bottom combined)
  if (
    text.includes('scrub set') ||
    text.includes('weatherproof suit') ||
    text.includes('industrial suit') ||
    text.includes('uniform set') ||
    text.includes('two-piece') ||
    text.includes('2-piece')
  ) {
    return 'UNIFORM_SET';
  }

  // 2. Frock / Uniform Dress / Tunic ("fork" handling included)
  if (
    text.includes('frock') ||
    text.includes('dress') ||
    text.includes('tunic') ||
    text.includes('fork') ||
    text.includes('gown') ||
    text.includes('kurtha')
  ) {
    return 'FROCK';
  }

  // 3. Skirt
  if (text.includes('skirt')) {
    return 'SKIRT';
  }

  // 4. Shirts & Tops (Checked before 'short' so 'short sleeve shirt' matches SHIRT!)
  if (
    text.includes('shirt') ||
    text.includes('t-shirt') ||
    text.includes('tee') ||
    text.includes('polo')
  ) {
    return 'SHIRT';
  }

  // 5. Shorts (Must NOT be a short-sleeve shirt or top)
  if (
    (text.includes('short') && !text.includes('sleeve')) ||
    text.includes('shorts')
  ) {
    return 'SHORT';
  }

  // 6. Trouser / Pants / Chinos
  if (
    text.includes('trouser') ||
    text.includes('pant') ||
    text.includes('chino') ||
    text.includes('jeans') ||
    text.includes('bottoms')
  ) {
    return 'TROUSER';
  }

  // 7. Vest / Waistcoat
  if (text.includes('vest') || text.includes('waistcoat')) {
    return 'VEST';
  }

  // 8. Blazer / Coat / Jacket / Overcoat
  if (
    text.includes('blazer') ||
    text.includes('coat') ||
    text.includes('overcoat') ||
    text.includes('jacket')
  ) {
    return 'BLAZER';
  }

  // 9. Blouse
  if (text.includes('blouse')) {
    return 'BLOUSE';
  }

  return null;
}

/**
 * Returns the exact tailored measurement fields required for a product.
 * Supports passing a Product object, or productType with optional name/subcategory/attributes.
 */
export function fieldsFor(
  productOrType?: Product | string | null,
  productName?: string | null,
  subCategory?: string | null,
  attributes?: any,
): MeasurementField[] {
  if (!productOrType) return [];

  let typeStr = '';
  let nameStr = productName ?? '';
  let subCatStr = subCategory ?? '';
  let attrs = attributes;
  let reqMeasure = false;

  if (typeof productOrType === 'object') {
    typeStr = String(productOrType.productType ?? '');
    nameStr = productOrType.name ?? nameStr;
    subCatStr = productOrType.subCategory ?? subCatStr;
    attrs = productOrType.attributes ?? attrs;
    reqMeasure = productOrType.requiresMeasurement === true;
  } else {
    typeStr = String(productOrType);
  }

  const isUniformOrCustom = typeStr === 'UNIFORM' || typeStr === 'CUSTOM';

  // Only products that are UNIFORM, CUSTOM, or explicitly require measurements have measurement fields
  if (!isUniformOrCustom && !reqMeasure) {
    return [];
  }

  // Detect specific garment tailoring requirement
  const detected = detectGarmentType(nameStr, subCatStr, attrs);
  if (detected && GARMENT_FIELD_MAP[detected]) {
    return GARMENT_FIELD_MAP[detected];
  }

  // Fallback to productType defaults
  return MEASUREMENT_FIELDS[typeStr] ?? [];
}

/**
 * Returns true if a size string represents a standard ready-to-wear size
 * (e.g. "20", "24", "Chest 30 to 42", "M", "L", etc.) rather than bespoke / custom tailoring.
 */
export function isStandardSize(size?: string | null): boolean {
  if (!size || typeof size !== 'string') return false;
  const s = size.trim().toLowerCase();
  return (
    s.length > 0 &&
    s !== 'custom' &&
    s !== 'tailored' &&
    s !== 'made-to-measure' &&
    s !== 'bespoke'
  );
}

/**
 * True when this product may not be ordered without measurements.
 * If a standard off-the-shelf size is chosen, measurements are not mandatory.
 */
export function needsMeasurements(product: Product, selectedSize?: string): boolean {
  if (isStandardSize(selectedSize)) return false;
  return (
    product.requiresMeasurement === true ||
    fieldsFor(product).length > 0
  );
}

/** True when the supplied set covers every field the product requires. */
export function isComplete(
  product: Product,
  set?: MeasurementSet | null,
  selectedSize?: string,
): boolean {
  if (!needsMeasurements(product, selectedSize)) return true;
  if (!set || !set.personName?.trim()) return false;

  const fields = fieldsFor(product);
  // A product flagged requires_measurement whose type declares no fields is a
  // data-entry slip; demand at least something rather than waving it through.
  if (fields.length === 0) return Object.keys(set.values ?? {}).length > 0;

  return fields.every((field) => {
    const value = set.values?.[field.key];
    return (
      typeof value === 'number' &&
      !Number.isNaN(value) &&
      value >= field.min &&
      value <= field.max
    );
  });
}
