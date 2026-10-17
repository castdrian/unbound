import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { z } from 'zod';

const schema = z.object({
	/** The API origin the session belongs to; it is never sent to any other origin. */
	apiUrl: z.url(),
	/** The Better Auth session token from the device authorization flow, sent as a bearer token. */
	token: z.string().min(1),
});

/** The session `ubd login` stores. */
export type Credentials = z.infer<typeof schema>;

/**
 * @description Reads the stored credentials, throwing when the file exists but is not valid.
 * @param path The credentials file.
 * @returns The credentials, or `undefined` when nobody is logged in.
 */
export function readCredentials(path: string): Credentials | undefined {
	if (!existsSync(path)) {
		return undefined;
	}

	const parsed = schema.safeParse(JSON.parse(readFileSync(path, 'utf8')));

	if (!parsed.success) {
		throw new Error(`Invalid credentials in ${path}:\n${z.prettifyError(parsed.error)}`);
	}

	return parsed.data;
}

/**
 * @description Stores credentials readable by the current user only.
 * @param path The credentials file.
 * @param credentials The session to store.
 */
export function writeCredentials(path: string, credentials: Credentials): void {
	mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
	// `mode` only applies when the file is created, so replace a file left by an earlier login instead
	// of writing the token into it before its permissions could be tightened.
	rmSync(path, { force: true });
	writeFileSync(path, `${JSON.stringify(credentials, null, '\t')}\n`, { mode: 0o600 });
}

/**
 * @description Deletes the stored credentials.
 * @param path The credentials file.
 * @returns Whether there were credentials to delete.
 */
export function removeCredentials(path: string): boolean {
	if (!existsSync(path)) {
		return false;
	}

	rmSync(path);

	return true;
}

export default { readCredentials, writeCredentials, removeCredentials };
