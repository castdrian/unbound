import type { CommandDefinition } from '@unbound-app/debugger-protocol/registry';
import { DEFAULT_BRIDGE_PORT } from '@unbound-app/debugger-protocol';
import { z } from 'zod';

import { bundleFreshnessCode, reloadCode } from '~/lib/navigation';
import { evaluateOnDevice, NOT_CONNECTED } from '~/lib/device';
import { waitForDevice } from '~/lib/context';
import { formatResult } from '~/lib/format';

/** How often the reload command probes for the fresh bundle. */
const RELOAD_POLL_MS = 500;

const schema = z.object({
	timeout: z
		.number()
		.default(60_000)
		.describe('How long to wait for the reloaded app to reconnect, in milliseconds.'),
	port: z
		.number()
		.default(DEFAULT_BRIDGE_PORT)
		.describe('The port the debugger bridge listens on.'),
});

const reloadCommand: CommandDefinition<typeof schema> = {
	name: 'reload',
	description:
		'Reload the JavaScript bundle on the connected device and wait until the fresh bundle ' +
		'reconnects to the debugger. The fresh bundle is told apart by a token the old one carried.',
	surfaces: { cli: true, mcp: true },
	schema,
	async handler({ timeout }, { client }) {
		const token = crypto.randomUUID();
		const started = Date.now();
		const result = await evaluateOnDevice(client, reloadCode(token));

		if (!result) {
			return NOT_CONNECTED;
		}

		if (!result.ok) {
			return { ok: false, text: formatResult(result) };
		}

		while (Date.now() - started < timeout) {
			await Bun.sleep(RELOAD_POLL_MS);
			await waitForDevice(client, RELOAD_POLL_MS);

			if (!client.isDeviceConnected) {
				continue;
			}

			const probe = await client.evaluate(bundleFreshnessCode(token));

			if (probe.ok && probe.value === 'fresh') {
				return { ok: true, text: `Reloaded in ${Date.now() - started}ms.` };
			}
		}

		return { ok: false, text: `The app did not reconnect within ${timeout}ms of reloading.` };
	},
};

export default reloadCommand;
