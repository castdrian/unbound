import { createLogger } from '@unbound-app/logger';

import { DEV, DEV_SERVER_URL } from '~/lib/constants';
import { performRefresh } from '~/lib/hot/runtime';
import { reload } from '~/api/native';

/** The dev runtime from `scripts/build/dev-runtime.js`, present only in hot dev builds. */
type DevRuntime = {
	applyPatch(code: string, changedIds: string[]): boolean;
};

type ServerMessage =
	| { type: 'patch'; code: string; filename: string; changedIds: string[] }
	| { type: 'reload' };

declare global {
	var __rolldown_runtime__: DevRuntime | undefined;
}

const Logger = createLogger('HotRefresh');

const RECONNECT_DELAY_MS = 2000;

let ws: WebSocket | null = null;
let stopped = true;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

/** Connects to the dev server and applies each source change in place. */
export function start() {
	stopped = false;
	connect();
}

/** Disconnects from the dev server. */
export function stop() {
	stopped = true;

	if (reconnectTimer) {
		clearTimeout(reconnectTimer);
		reconnectTimer = null;
	}

	ws?.close();
	ws = null;
}

/**
 * @description Whether this is a hot dev build, which bundles the dev runtime.
 * @returns `true` in dev builds made by the dev engine.
 */
export function shouldStart() {
	return DEV && Boolean(globalThis.__rolldown_runtime__);
}

function connect() {
	if (ws || stopped) return;

	const socket = new WebSocket(`${DEV_SERVER_URL.replace(/^http/, 'ws')}/__refresh`);

	socket.addEventListener('open', () => Logger.success('Connected'));
	socket.addEventListener('message', ({ data }) => handle(socket, JSON.parse(data)));
	socket.addEventListener('close', () => {
		ws = null;

		if (stopped || reconnectTimer) return;

		reconnectTimer = setTimeout(() => {
			reconnectTimer = null;
			connect();
		}, RECONNECT_DELAY_MS);
	});

	ws = socket;
}

function handle(socket: WebSocket, message: ServerMessage) {
	if (message.type === 'reload') {
		reload();

		return;
	}

	const started = Date.now();

	try {
		if (!globalThis.__rolldown_runtime__?.applyPatch(message.code, message.changedIds)) {
			Logger.info(`${message.changedIds.join(', ')} can't be patched in place; reloading.`);
			requestReload(socket);

			return;
		}
	} catch (error) {
		Logger.error(`Failed to patch ${message.changedIds.join(', ')}; reloading:`, error);
		requestReload(socket);

		return;
	}

	socket.send(JSON.stringify({ type: 'applied', filename: message.filename }));

	const { count, needsRemount } = performRefresh();

	if (needsRemount) {
		Logger.info('A component changed its hooks; reloading.');
		requestReload(socket);

		return;
	}

	Logger.success(
		`Patched ${message.changedIds.join(', ')}: ${count} fibers in ${Date.now() - started}ms`,
	);
}

// The server answers with a reload once the rebuild is on disk, so the app doesn't fetch the old bundle.
function requestReload(socket: WebSocket) {
	socket.send(JSON.stringify({ type: 'reload' }));
}

export default { start, stop, shouldStart };
