/**
 * @description Escapes the LIKE wildcards in user input so it matches literally under `escape '\'`.
 * @param value The raw search text.
 * @returns The text with `\`, `%` and `_` escaped.
 */
export function escapeLike(value: string): string {
	return value.replaceAll(/[\\%_]/g, (match) => `\\${match}`);
}

export default { escapeLike };
