/**
 * @description Normalises a thrown value into an `Error`, wrapping anything that is not one.
 * @param error The thrown value.
 * @returns The value itself when it is an `Error`, otherwise an `Error` carrying its string form.
 */
// UNKNOWN: anything can be thrown.
function toError(error: unknown): Error {
	return error instanceof Error ? error : new Error(String(error));
}

export default toError;
