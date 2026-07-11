import { ProductType } from '@prisma/client';

/**
 * BR3 — "Custom orders require measurement data" (doc 01 §7).
 *
 * This file is the single source of truth for WHICH measurements a product needs.
 * The server validates against it; the checkout modal renders its fields from the
 * mirror in frontend/src/lib/measurements.ts.
 *
 * The two copies must stay in step. They would be one file under decision D1
 * (packages/shared); that package does not exist, so the duplication is a known,
 * documented deviation rather than an accident. The SERVER copy is authoritative:
 * a tampered client that omits a field is rejected here.
 *
 * All values are centimetres. Ranges are deliberately generous (a 20cm child's
 * chest through a 200cm adult) — the point is to reject nonsense like 0 or 5000,
 * not to police tailoring.
 */

export interface MeasurementField {
  key: string;
  label: string;
  min: number;
  max: number;
}

export interface MeasurementSet {
  personName: string;
  /** Optional free-text, e.g. "Son — Grade 5". */
  label?: string;
  /** cm values, keyed by MeasurementField.key. */
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

/**
 * A uniform is a shirt AND a trouser, so it needs both sets. CUSTOM is
 * shirt-only: a bespoke garment is one piece unless the shop says otherwise.
 */
export const MEASUREMENT_FIELDS: Partial<
  Record<ProductType, MeasurementField[]>
> = {
  UNIFORM: [...SHIRT, ...TROUSER],
  CUSTOM: SHIRT,
};

/** The fields a product needs, or [] when it needs none. */
export function fieldsFor(productType: ProductType): MeasurementField[] {
  return MEASUREMENT_FIELDS[productType] ?? [];
}

/**
 * Validates one line item's measurements. Returns the reasons it is invalid;
 * an empty array means it passed.
 *
 * Note it validates against the PRODUCT's type, never against anything the
 * client asserts, so a client cannot dodge BR3 by claiming a uniform is a
 * READY_MADE.
 */
export function validateMeasurements(
  productName: string,
  productType: ProductType,
  requiresMeasurement: boolean,
  submitted: unknown,
): string[] {
  const fields = fieldsFor(productType);

  // Nothing to check: not a measured product and not flagged as one.
  if (!requiresMeasurement && fields.length === 0) return [];

  if (submitted === null || submitted === undefined) {
    return [`"${productName}" requires measurements`];
  }

  if (typeof submitted !== 'object' || Array.isArray(submitted)) {
    return [`"${productName}": measurements must be an object`];
  }

  const set = submitted as Partial<MeasurementSet>;
  const errors: string[] = [];

  if (
    typeof set.personName !== 'string' ||
    set.personName.trim().length === 0
  ) {
    errors.push(`"${productName}": a name is required for the measurements`);
  }

  const values = set.values;
  if (typeof values !== 'object' || values === null) {
    errors.push(`"${productName}": measurement values are missing`);
    return errors;
  }

  // A product flagged requires_measurement but whose type declares no fields
  // (a data-entry slip) still must not slip through with an empty object.
  if (fields.length === 0 && Object.keys(values).length === 0) {
    errors.push(`"${productName}" requires measurements`);
    return errors;
  }

  for (const field of fields) {
    const value = (values as Record<string, unknown>)[field.key];

    if (typeof value !== 'number' || Number.isNaN(value)) {
      errors.push(`"${productName}": ${field.label} is required`);
      continue;
    }

    if (value < field.min || value > field.max) {
      errors.push(
        `"${productName}": ${field.label} must be between ${field.min} and ${field.max} cm`,
      );
    }
  }

  return errors;
}
