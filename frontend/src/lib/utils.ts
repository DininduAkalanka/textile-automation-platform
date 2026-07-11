import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/** Merge Tailwind classes so a later class wins over an earlier conflicting one. */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
