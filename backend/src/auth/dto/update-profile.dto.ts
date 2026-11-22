import { Transform } from 'class-transformer';
import { IsString, Matches, MaxLength, MinLength } from 'class-validator';

/**
 * A person's name: letters in any script (Sinhala, Tamil, Latin…), with single
 * spaces, apostrophes, hyphens or full stops between them ("De Silva",
 * "O'Neil", "Jean-Luc", "Sr."). No digits or markup.
 */
export const PERSON_NAME = /^[\p{L}\p{M}]+(?:[ .'’-]+[\p{L}\p{M}]+)*\.?$/u;
const NAME_RULE =
  'may contain letters, spaces, apostrophes, hyphens and full stops only';

/** Trims and collapses inner whitespace before the rules run. */
const tidy = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : value;

/**
 * The signed-in person corrects their own name. Only the name: email, phone
 * and role are not accepted here (the global ValidationPipe rejects unknown
 * fields), so this can never change who someone is or what they may do.
 */
export class UpdateProfileDto {
  @Transform(tidy)
  @IsString()
  @MinLength(1, { message: 'First name is required' })
  @MaxLength(50)
  @Matches(PERSON_NAME, { message: `First name ${NAME_RULE}` })
  firstName: string;

  @Transform(tidy)
  @IsString()
  @MinLength(1, { message: 'Last name is required' })
  @MaxLength(50)
  @Matches(PERSON_NAME, { message: `Last name ${NAME_RULE}` })
  lastName: string;
}
