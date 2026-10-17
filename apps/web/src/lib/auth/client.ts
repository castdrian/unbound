import { adminClient, deviceAuthorizationClient } from 'better-auth/client/plugins';
import { apiKeyClient } from '@better-auth/api-key/client';
import type { ReactAuthClient } from 'better-auth/react';
import { createAuthClient } from 'better-auth/react';

import { ac, roles } from '~/lib/auth/access';

type AdminClientOptions = {
	ac: typeof ac;
	roles: typeof roles;
};

// Named so declaration emit can reference it; the inferred client type cannot be serialized.
type AuthClientOptions = {
	plugins: [
		ReturnType<typeof deviceAuthorizationClient>,
		ReturnType<typeof apiKeyClient>,
		ReturnType<typeof adminClient<AdminClientOptions>>,
	];
};

/** The browser-side Better Auth client; it targets `/api/auth` on the page's own origin. */
const authClient: ReactAuthClient<AuthClientOptions> = createAuthClient({
	plugins: [deviceAuthorizationClient(), apiKeyClient(), adminClient({ ac, roles })],
});

export default authClient;
