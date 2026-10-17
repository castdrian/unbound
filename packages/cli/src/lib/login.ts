import { deviceAuthorizationClient } from 'better-auth/client/plugins';
import { CLI_CLIENT_ID } from '@unbound-app/web/client';
import { createAuthClient } from 'better-auth/client';

import { getCredentialsPath, type Env } from '~/lib/env';
import { writeCredentials } from '~/lib/credentials';

/** The code the user enters on the verification page, and where to enter it. */
export type DeviceCode = {
	userCode: string;
	verificationUri: string;
	verificationUriComplete: string;
};

export type LoginOptions = {
	env: Env;
	/** Waits between polls; injected so tests advance a fake clock instead of sleeping. */
	delay: (ms: number) => Promise<void>;
	/** Shows the user the code to approve. */
	prompt: (code: DeviceCode) => void;
};

/** The grant type of an RFC 8628 device access token request. */
const DEVICE_CODE_GRANT = 'urn:ietf:params:oauth:grant-type:device_code';

/** How much RFC 8628 says to lengthen the polling interval on every `slow_down`. */
const SLOW_DOWN_STEP_MS = 5_000;

/**
 * @description Logs in through Better Auth's device authorization flow: requests a code, shows it,
 * polls at the server's interval until the user approves it on the website, and stores the session.
 * @param options The environment, the polling delay and how to show the code.
 * @returns The path the credentials were stored at.
 */
export async function login({ env, delay, prompt }: LoginOptions): Promise<string> {
	const auth = createAuthClient({
		baseURL: env.UNBOUND_API_URL,
		plugins: [deviceAuthorizationClient()],
	});

	const code = await auth.device.code({ client_id: CLI_CLIENT_ID });

	if (code.error) {
		throw new Error(
			`Could not start the login: ${code.error.error_description} (${code.error.error}).`,
		);
	}

	prompt({
		userCode: code.data.user_code,
		verificationUri: code.data.verification_uri,
		verificationUriComplete: code.data.verification_uri_complete,
	});

	let interval = code.data.interval * 1000;

	while (true) {
		await delay(interval);

		const token = await auth.device.token({
			grant_type: DEVICE_CODE_GRANT,
			device_code: code.data.device_code,
			client_id: CLI_CLIENT_ID,
		});

		if (token.data) {
			const path = getCredentialsPath(env);

			writeCredentials(path, { apiUrl: env.UNBOUND_API_URL, token: token.data.access_token });

			return path;
		}

		if (token.error.error === 'authorization_pending') {
			continue;
		}

		if (token.error.error === 'slow_down') {
			interval += SLOW_DOWN_STEP_MS;
			continue;
		}

		throw new Error(`Login failed: ${token.error.error_description} (${token.error.error}).`);
	}
}

export default login;
