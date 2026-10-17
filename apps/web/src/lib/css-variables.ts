import type { CSSProperties } from 'react';

/** Inline styles that also set CSS custom properties, which React's `CSSProperties` does not list. */
export type CssVariables = CSSProperties & Record<`--${string}`, string | number | undefined>;
