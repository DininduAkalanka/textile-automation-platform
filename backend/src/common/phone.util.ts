import { registerDecorator, ValidationOptions } from 'class-validator';

/**
 * Sri Lankan mobile numbers in canonical E.164 form: `+94` followed by a
 * 9-digit subscriber number that always starts with `7` (the mobile prefix).
 * Landlines (011…, 081…, etc.) deliberately fail — a contact used for SMS OTP
 * must be a mobile.
 */
export const LK_PHONE_RE = /^\+947\d{8}$/;

/**
 * Fold every way a customer might type their mobile into ONE canonical string
 * so the `phone @unique` constraint is meaningful. Without this, the same
 * person entering `0771234567`, `+94771234567`, and `94 77 123 4567` would
 * become three different-looking values and could register three times.
 *
 * Accepts: `0771234567` (local), `+94771234567` / `94771234567` (with country
 * code), and a bare `771234567`. Returns `+94771234567`, or `null` for
 * anything that isn't a valid LK mobile.
 */
export function normalizeLkPhone(
  input: string | null | undefined,
): string | null {
  if (!input) return null;

  let s = input.trim().replace(/[\s\-()]/g, '');

  if (/^0\d{9}$/.test(s)) {
    s = '+94' + s.slice(1); // 0771234567 -> +94771234567
  } else if (/^94\d{9}$/.test(s)) {
    s = '+' + s; // 94771234567 -> +94771234567
  } else if (/^7\d{8}$/.test(s)) {
    s = '+94' + s; // 771234567 -> +94771234567
  }
  // else: leave as-is; the regex test below rejects anything non-canonical.

  return LK_PHONE_RE.test(s) ? s : null;
}

/**
 * class-validator decorator: passes when the value normalizes to a valid LK
 * mobile. It only VALIDATES — normalization to the canonical form happens at
 * the service layer before persisting, so the stored value is always `+947…`.
 */
export function IsLkPhone(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      name: 'isLkPhone',
      target: object.constructor,
      propertyName,
      options: validationOptions,
      validator: {
        validate(value: unknown) {
          return typeof value === 'string' && normalizeLkPhone(value) !== null;
        },
        defaultMessage() {
          return 'phone must be a valid Sri Lankan mobile number (e.g. 0771234567 or +94771234567)';
        },
      },
    });
  };
}
