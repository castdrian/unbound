import { deviceAuthorizationClient } from 'better-auth/client/plugins';
import { apiKeyClient } from '@better-auth/api-key/client';
import type { ReactAuthClient } from 'better-auth/react';
import { createAuthClient } from 'better-auth/react';

// Named so declaration emit can reference it; the inferred client type cannot be serialized.
type AuthClientOptions = {
	plugins: [ReturnType<typeof deviceAuthorizationClient>, ReturnType<typeof apiKeyClient>];
};

/** The browser-side Better Auth client; it targets `/api/auth` on the page's own origin. */
const authClient: ReactAuthClient<AuthClientOptions> = createAuthClient({
	plugins: [deviceAuthorizationClient(), apiKeyClient()],
});

export default authClient;
