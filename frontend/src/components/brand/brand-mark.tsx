import * as React from 'react';

/**
 * The Nandana Textile mark — an NT woven monogram (the same one used for the
 * favicon). The N and T share the central warp thread; a two-tone red weft
 * weaves through. Red and black only.
 *
 * Pure inline SVG so it works in every part of the app (the storefront's
 * inline-style world, the Tailwind admin, the dark auth panels) with no font
 * or asset dependency.
 *
 *  - variant="tile"  → dark rounded tile + red NT (for light backgrounds)
 *  - variant="onDark" → cream + red NT, no tile (for dark backgrounds)
 */
export function BrandMark({
  size = 36,
  variant = 'tile',
  className,
  style,
}: {
  size?: number;
  variant?: 'tile' | 'onDark';
  className?: string;
  style?: React.CSSProperties;
}) {
  const tile = variant === 'tile';
  const warp = tile ? '#E0141B' : '#F4EFE7'; // on dark, the letter goes cream
  const weft = tile ? '#A11015' : '#E0141B';

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 132 132"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="Nandana Textile"
      className={className}
      style={style}
    >
      {tile && <rect width="132" height="132" rx="30" fill="#141014" />}
      {/* N left warp */}
      <rect x="32" y="37" width="14" height="58" fill={warp} />
      {/* crimson weft — over the left warp, under the shared stem */}
      <polygon points="32,37 46,37 86,95 72,95" fill={weft} />
      {/* shared stem (N right / T) */}
      <rect x="72" y="37" width="14" height="58" fill={warp} />
      {/* T crossbar */}
      <rect x="60" y="31" width="38" height="11.5" rx="1.5" fill={warp} />
    </svg>
  );
}
