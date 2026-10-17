/**
 * A string union that keeps `T`'s literals for autocomplete while still accepting any other string,
 * for Discord's open-ended enums (typography variants, colour tokens, sizes).
 */
export type LiteralUnion<T extends string> = T | (string & {});

/** A hexadecimal colour string prefixed with `#`. */
export type HexColor = `#${string}`;
/** An `rgba(...)` colour string. */
export type RgbaColor = `rgba(${string})`;
/** Any supported colour string: a {@link HexColor} or {@link RgbaColor}. */
export type ColorString = HexColor | RgbaColor;

/** The set of all falsy values. */
export type Falsy = false | 0 | '' | null | undefined;
/** The set of all truthy values. */
export type Truthy = true | number | string | object | symbol | bigint;
/** The result of a predicate: any {@link Truthy} or {@link Falsy} value. */
export type PredicateResult = Truthy | false | null | undefined;

/** Widens a literal type to its primitive base (e.g. `'a'` to `string`, `1` to `number`). */
export type Widen<T> = T extends number
	? number
	: T extends string
		? string
		: T extends boolean
			? boolean
			: T;
