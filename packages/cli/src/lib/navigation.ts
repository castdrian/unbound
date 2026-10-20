/** Route parameters passed to a settings screen, as JSON. */
export type ScreenParams = Record<string, string | number | boolean | null>;

/** Discord's root React Navigation container; settings screens live in its `settings` stack. */
const ROOT_REF = `unbound.metro.findByProps('getRootNavigationRef').getRootNavigationRef()`;

/**
 * @description Builds the device code that opens a settings screen from anywhere in the app. The name
 * resolves against the live `SETTING_RENDERER_CONFIG`: an exact route key first, then an Unbound
 * route whose key matches ignoring case, underscores and the `UNBOUND_` prefix (`Marketplace` →
 * `UNBOUND_MARKETPLACE`), then any Discord route matched the same way.
 * @param screen A `Screens` key such as `Marketplace`, or any settings route key.
 * @param params Route parameters for the screen.
 * @returns The JavaScript to evaluate; it returns the opened route key or throws listing Unbound's.
 */
export function openScreenCode(screen: string, params: ScreenParams = {}): string {
	return `(() => {
	const name = ${JSON.stringify(screen)};
	const config = unbound.metro.findByProps('SETTING_RENDERER_CONFIG').SETTING_RENDERER_CONFIG;
	const keys = Object.keys(config);
	const normalize = (key) => key.toLowerCase().replace(/^unbound_/, '').replace(/[^a-z0-9]/g, '');
	const own = keys.filter((key) => key.startsWith('UNBOUND_'));
	const route = keys.includes(name)
		? name
		: own.find((key) => normalize(key) === normalize(name)) ??
			keys.find((key) => normalize(key) === normalize(name));

	if (!route) {
		throw new Error('No settings screen matches ' + name + '. Unbound screens: ' + own.join(', '));
	}

	${ROOT_REF}.navigate('settings', { screen: route, params: ${JSON.stringify(params)} });

	return route;
})()`;
}

/**
 * @description Builds the device code that reads the focused route and the stack leading to it.
 * @returns The JavaScript to evaluate; it returns `{ name, params, path }` as a JSON string.
 */
export function currentRouteCode(): string {
	return `(() => {
	const ref = ${ROOT_REF};
	const path = [];
	let state = ref.getRootState();

	while (state) {
		const route = state.routes[state.index ?? state.routes.length - 1];

		path.push(route.name);
		state = route.state;
	}

	const { name, params } = ref.getCurrentRoute();

	return JSON.stringify({ name, params: params ?? {}, path });
})()`;
}

/**
 * @description Builds the device code that tags the running bundle with a token, then reloads it once
 * the eval has answered. A fresh bundle no longer carries the token.
 * @param token The marker to set on `globalThis`.
 * @returns The JavaScript to evaluate.
 */
export function reloadCode(token: string): string {
	return `globalThis.__UBD_RELOAD__ = ${JSON.stringify(token)};
setTimeout(() => unbound.native.reload(), 100);
'reloading'`;
}

/**
 * @description Builds the device code that tells the reloaded bundle from the one that was tagged.
 * @param token The marker {@link reloadCode} set.
 * @returns The JavaScript to evaluate; it returns `fresh` once the bundle no longer carries the token.
 */
export function bundleFreshnessCode(token: string): string {
	return `globalThis.__UBD_RELOAD__ === ${JSON.stringify(token)} ? 'stale' : 'fresh'`;
}

export default { openScreenCode, currentRouteCode, reloadCode, bundleFreshnessCode };
