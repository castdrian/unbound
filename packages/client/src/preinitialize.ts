const mdls = [...globalThis.modules.values()];

let reactNative, react;

for (const m of mdls) {
	const exports = m?.publicModule?.exports ?? m?.exports ?? m;
	const values = [exports, exports?.default, exports?.default?.default];

	for (const value of values) {
		if (!value) continue;

		if (!reactNative && value.AppState && value.NativeModules) reactNative = value;
		if (!react && typeof value.createElement === 'function') react = value;
	}

	if (reactNative && react) break;
}

globalThis.ReactNative = reactNative;
globalThis.React = react;

export {};
