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

const SHIRT: MeasurementField[] = [
  { key: 'chest', label: 'Chest', min: 20, max: 200 },
  { key: 'waist', label: 'Waist', min: 20, max: 200 },
  { key: 'shoulder', label: 'Shoulder', min: 20, max: 100 },
  { key: 'sleeveLength', label: 'Sleeve length', min: 10, max: 100 },
  { key: 'shirtLength', label: 'Shirt length', min: 20, max: 120 },
];

const TROUSER: MeasurementField[] = [
  { key: 'trouserWaist', label: 'Trouser waist', min: 20, max: 200 },
  { key: 'hip', label: 'Hip', min: 20, max: 200 },
  { key: 'trouserLength', label: 'Trouser length', min: 30, max: 150 },
];

const MEASUREMENT_FIELDS: Record<string, MeasurementField[]> = {
  UNIFORM: [...SHIRT, ...TROUSER],
  CUSTOM: SHIRT,
};

export function fieldsFor(productType?: string): MeasurementField[] {
  return MEASUREMENT_FIELDS[productType ?? ''] ?? [];
}

/** True when this product may not be ordered without measurements. */
export function needsMeasurements(product: Product): boolean {
  return (
    product.requiresMeasurement === true ||
    fieldsFor(product.productType).length > 0
  );
}

/** True when the supplied set covers every field the product requires. */
export function isComplete(
  product: Product,
  set?: MeasurementSet | null,
): boolean {
  if (!needsMeasurements(product)) return true;
  if (!set || !set.personName?.trim()) return false;

  const fields = fieldsFor(product.productType);
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
