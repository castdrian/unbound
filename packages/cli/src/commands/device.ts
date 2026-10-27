import type { CommandDefinition } from '@unbound-app/debugger-protocol/registry';
import { z } from 'zod';

import { listSnapshots, resetDevice, restoreSnapshot, saveSnapshot } from '~/lib/device-state';

const schema = z.object({
	action: z
		.enum(['reset', 'save', 'restore', 'list'])
		.describe(
			'reset moves Unbound aside for a fresh start, save and restore snapshots, list shows them.',
		),
	name: z.string().default('').describe('The snapshot to save or restore.'),
	serial: z
		.string()
		.optional()
		.describe('The adb serial of the Android device, when several are attached.'),
	ios: z
		.boolean()
		.default(false)
		.describe('Act on a jailbroken iPhone through jb-p1lot instead of over adb.'),
	udid: z
		.string()
		.optional()
		.describe('The UDID of the iPhone, when several are connected. Implies --ios.'),
	restart: z.boolean().default(false).describe('Relaunch Discord afterwards.'),
});

const deviceCommand: CommandDefinition<typeof schema> = {
	name: 'device',
	description:
		"Reset, snapshot or restore Discord's Unbound state on a rooted Android device or a jailbroken " +
		'iPhone. `reset` moves the Unbound folder aside so Discord starts fresh; `save <name>` keeps a copy ' +
		'on this computer; `restore <name>` puts one back, keeping the replaced folder on the device; ' +
		'`list` shows the saved snapshots. Nothing on the device is deleted.',
	surfaces: { cli: 'root', mcp: true },
	schema,
	cli: { positionals: ['action', 'name'] },
	async handler({ action, name, ...options }) {
		switch (action) {
			case 'reset':
				return resetDevice(options);
			case 'save':
				return saveSnapshot(name, options);
			case 'restore':
				return restoreSnapshot(name, options);
			case 'list':
				return listSnapshots();
		}
	},
};

export default deviceCommand;
