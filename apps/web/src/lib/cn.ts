import { twMerge } from 'tailwind-merge';
import type { ClassValue } from 'clsx';
import { clsx } from 'clsx';

/**
 * @description Joins class names and lets later Tailwind utilities override conflicting earlier ones.
 * @param inputs Class names, arrays and conditional class maps.
 * @returns The merged class string.
 */
function cn(...inputs: ClassValue[]): string {
	return twMerge(clsx(inputs));
}

export default cn;
