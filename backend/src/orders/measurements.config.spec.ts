import { ProductType } from '@prisma/client';
import { fieldsFor, validateMeasurements } from './measurements.config';

/**
 * BR3 — "Custom orders require measurement data" (doc 01 §7).
 *
 * The rule only means something if it cannot be bypassed, so these tests spend
 * most of their effort on the ways a client might try to dodge it.
 */
describe('BR3 measurement validation', () => {
  const validUniform = {
    personName: 'Nimal Perera',
    label: 'Son — Grade 5',
    values: {
      chest: 76,
      waist: 66,
      shoulder: 36,
      sleeveLength: 46,
      shirtLength: 60,
      trouserWaist: 66,
      hip: 80,
      trouserLength: 90,
    },
  };

  describe('products that do NOT need measurements', () => {
    it('accepts a ready-made item with no measurements', () => {
      expect(
        validateMeasurements(
          'Cotton Shirt',
          ProductType.READY_MADE,
          false,
          null,
        ),
      ).toEqual([]);
    });

    it('accepts fabric sold by the metre', () => {
      expect(
        validateMeasurements('Cotton Fabric', ProductType.FABRIC, false, null),
      ).toEqual([]);
    });
  });

  describe('products that DO need measurements', () => {
    it('accepts a complete uniform measurement set', () => {
      expect(
        validateMeasurements(
          'School Uniform',
          ProductType.UNIFORM,
          true,
          validUniform,
        ),
      ).toEqual([]);
    });

    it('rejects a uniform ordered with no measurements at all', () => {
      const errors = validateMeasurements(
        'School Uniform',
        ProductType.UNIFORM,
        true,
        null,
      );
      expect(errors).toHaveLength(1);
      expect(errors[0]).toMatch(/requires measurements/i);
    });

    it('rejects a uniform missing a single field', () => {
      const { trouserLength: _trouserLength, ...incomplete } =
        validUniform.values;

      const errors = validateMeasurements(
        'School Uniform',
        ProductType.UNIFORM,
        true,
        { ...validUniform, values: incomplete },
      );

      expect(errors).toHaveLength(1);
      expect(errors[0]).toMatch(/Trouser length is required/i);
    });

    it('rejects measurements with no person name — a task on the floor needs one', () => {
      const errors = validateMeasurements(
        'School Uniform',
        ProductType.UNIFORM,
        true,
        { ...validUniform, personName: '   ' },
      );
      expect(errors[0]).toMatch(/name is required/i);
    });

    it('rejects out-of-range values rather than cutting a 5000cm sleeve', () => {
      const errors = validateMeasurements(
        'School Uniform',
        ProductType.UNIFORM,
        true,
        {
          ...validUniform,
          values: { ...validUniform.values, sleeveLength: 5000 },
        },
      );

      expect(errors).toHaveLength(1);
      expect(errors[0]).toMatch(/Sleeve length must be between/i);
    });

    it('rejects a zero measurement (a plausible empty-input bug)', () => {
      const errors = validateMeasurements(
        'School Uniform',
        ProductType.UNIFORM,
        true,
        {
          ...validUniform,
          values: { ...validUniform.values, chest: 0 },
        },
      );
      expect(errors[0]).toMatch(/Chest must be between/i);
    });

    it('rejects a string where a number is expected ("96" is not 96)', () => {
      const errors = validateMeasurements(
        'School Uniform',
        ProductType.UNIFORM,
        true,
        {
          ...validUniform,
          values: { ...validUniform.values, chest: '96' },
        },
      );
      expect(errors[0]).toMatch(/Chest is required/i);
    });

    it('reports EVERY bad field at once, not just the first', () => {
      const errors = validateMeasurements(
        'School Uniform',
        ProductType.UNIFORM,
        true,
        {
          personName: 'Nimal',
          values: { chest: 76 },
        },
      );

      // 8 uniform fields, one supplied -> 7 outstanding.
      expect(errors).toHaveLength(7);
    });
  });

  describe('bypass attempts', () => {
    it('rejects an empty object dressed up as measurements', () => {
      const errors = validateMeasurements(
        'School Uniform',
        ProductType.UNIFORM,
        true,
        {},
      );
      expect(errors.length).toBeGreaterThan(0);
    });

    it('rejects an array', () => {
      const errors = validateMeasurements(
        'School Uniform',
        ProductType.UNIFORM,
        true,
        [],
      );
      expect(errors[0]).toMatch(/must be an object/i);
    });

    it('rejects an empty values object', () => {
      const errors = validateMeasurements(
        'School Uniform',
        ProductType.UNIFORM,
        true,
        { personName: 'Nimal', values: {} },
      );
      expect(errors.length).toBeGreaterThan(0);
    });

    /**
     * The important one. A product flagged requires_measurement whose type
     * declares no field set (a data-entry slip: someone ticks the box but leaves
     * the type as READY_MADE) must still not sail through with an empty payload.
     */
    it('still demands measurements when the flag is set but the type declares no fields', () => {
      expect(fieldsFor(ProductType.READY_MADE)).toEqual([]);

      const errors = validateMeasurements(
        'Mislabelled Uniform',
        ProductType.READY_MADE,
        true,
        { personName: 'Nimal', values: {} },
      );

      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0]).toMatch(/requires measurements/i);
    });
  });

  describe('field sets', () => {
    it('gives a uniform both shirt and trouser fields', () => {
      const keys = fieldsFor(ProductType.UNIFORM).map((f) => f.key);
      expect(keys).toContain('chest');
      expect(keys).toContain('trouserLength');
      expect(keys).toHaveLength(8);
    });

    it('gives a custom garment the shirt fields only', () => {
      const keys = fieldsFor(ProductType.CUSTOM).map((f) => f.key);
      expect(keys).toContain('chest');
      expect(keys).not.toContain('trouserLength');
    });
  });

  describe('standard ready-to-wear sizes vs custom sizes', () => {
    it('accepts a uniform ordered with a standard numeric size and no custom measurements', () => {
      expect(
        validateMeasurements(
          "Boy's School Uniform Shirt - Short Sleeve",
          ProductType.UNIFORM,
          true,
          null,
          '24',
        ),
      ).toEqual([]);
    });

    it('accepts a uniform ordered with a standard chest range size and no custom measurements', () => {
      expect(
        validateMeasurements(
          "Boy's School Uniform Shirt - Long Sleeve",
          ProductType.UNIFORM,
          true,
          null,
          'Chest 30 to 42',
        ),
      ).toEqual([]);
    });

    it('accepts a uniform ordered with a standard size and valid custom measurements', () => {
      expect(
        validateMeasurements(
          "Boy's School Uniform Shirt - Short Sleeve",
          ProductType.UNIFORM,
          true,
          validUniform,
          '24',
        ),
      ).toEqual([]);
    });

    it('rejects a uniform ordered with size "custom" and no measurements', () => {
      const errors = validateMeasurements(
        'School Uniform',
        ProductType.UNIFORM,
        true,
        null,
        'custom',
      );
      expect(errors).toHaveLength(1);
      expect(errors[0]).toMatch(/requires measurements/i);
    });
  });

  describe('product-specific tailor shop garment requirements', () => {
    it('requires only shirt fields for a uniform shirt (no trouser measurements)', () => {
      const fields = fieldsFor(
        ProductType.UNIFORM,
        "Boy's School Uniform Shirt - Short Sleeve",
      );
      const keys = fields.map((f) => f.key);
      expect(keys).toEqual(['chest', 'waist', 'shoulder', 'sleeveLength', 'shirtLength']);
      expect(keys).not.toContain('trouserLength');
      expect(keys).not.toContain('trouserWaist');
      expect(keys).not.toContain('hip');
    });

    it('requires only short fields for uniform shorts (no shirt measurements)', () => {
      const fields = fieldsFor(
        ProductType.UNIFORM,
        "Boy's School Uniform Short - Elasticated",
      );
      const keys = fields.map((f) => f.key);
      expect(keys).toEqual(['trouserWaist', 'hip', 'trouserLength']);
      expect(keys).not.toContain('chest');
      expect(keys).not.toContain('sleeveLength');
      expect(keys).not.toContain('shoulder');
    });

    it('requires only frock fields for uniform frocks / dresses (no trouser measurements)', () => {
      const fields = fieldsFor(
        ProductType.UNIFORM,
        "Girl's School Uniform Frock (5 Pleat)",
      );
      const keys = fields.map((f) => f.key);
      expect(keys).toEqual(['chest', 'waist', 'shoulder', 'frockLength', 'sleeveLength']);
      expect(keys).not.toContain('trouserLength');
      expect(keys).not.toContain('trouserWaist');
    });

    it('requires only trouser fields for work trousers or formal pants', () => {
      const fields = fieldsFor(
        ProductType.UNIFORM,
        'Industrial Heavy Canvas Work Trousers',
      );
      const keys = fields.map((f) => f.key);
      expect(keys).toEqual(['trouserWaist', 'hip', 'trouserLength']);
      expect(keys).not.toContain('chest');
      expect(keys).not.toContain('shoulder');
    });

    it('requires skirt fields for uniform skirts', () => {
      const fields = fieldsFor(
        ProductType.UNIFORM,
        'Tendenza Front Dart Detailed Pencil Skirt',
      );
      const keys = fields.map((f) => f.key);
      expect(keys).toEqual(['trouserWaist', 'hip', 'trouserLength']);
    });

    it('requires both top and bottom fields for two-piece suits or scrub sets', () => {
      const fields = fieldsFor(
        ProductType.UNIFORM,
        'Clinical Grade Hospital Scrub Set',
      );
      const keys = fields.map((f) => f.key);
      expect(keys).toContain('chest');
      expect(keys).toContain('trouserLength');
      expect(keys).toHaveLength(8);
    });

    it('validates a shirt with only shirt measurements when bespoke size is selected', () => {
      const errors = validateMeasurements(
        "Boy's School Uniform Shirt - Short Sleeve",
        ProductType.UNIFORM,
        true,
        {
          personName: 'Kasun Fernando',
          values: {
            chest: 60,
            waist: 55,
            shoulder: 30,
            sleeveLength: 20,
            shirtLength: 50,
          },
        },
        'custom',
      );
      expect(errors).toEqual([]);
    });
  });
});
