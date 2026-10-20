import type { CommandDefinition } from '@unbound-app/debugger-protocol/registry';
import { DEFAULT_BRIDGE_PORT } from '@unbound-app/debugger-protocol';
import toError from '@unbound-app/utils/to-error';
import { z } from 'zod';

import type { ScreenParams } from '~/lib/navigation';
import { openScreenCode } from '~/lib/navigation';
import { runOnDevice } from '~/lib/device';

const schema = z.object({
	screen: z
		.string()
		.min(1)
		.describe(
			'The settings screen to open: a `Screens` key such as `Marketplace` or `Plugins`, or any ' +
				'`SETTING_RENDERER_CONFIG` route key.',
		),
	params: z
		.string()
		.default('{}')
		.describe('Route parameters for the screen, as a JSON object, e.g. `{"kind":"theme"}`.'),
	port: z
		.number()
		.default(DEFAULT_BRIDGE_PORT)
		.describe('The port the debugger bridge listens on.'),
});

const paramsSchema = z.record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.null()]));

const openCommand: CommandDefinition<typeof schema> = {
	name: 'open',
	description:
		'Open an Unbound (or Discord) settings screen on the connected device from anywhere in the ' +
		'app, through the root navigation ref. Prints the route key it opened.',
	surfaces: { cli: true, mcp: true },
	schema,
	cli: { positionals: ['screen'] },
	async handler({ screen, params }, { client }) {
		let parsed: ScreenParams;

		try {
			parsed = paramsSchema.parse(JSON.parse(params));
		} catch (error) {
			return {
				ok: false,
				text: `params must be a JSON object of plain values: ${toError(error).message}`,
			};
		}

		return runOnDevice(client, openScreenCode(screen, parsed));
	},
};

export default openCommand;
