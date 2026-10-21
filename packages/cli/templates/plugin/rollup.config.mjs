import { nodeResolve } from '@rollup/plugin-node-resolve';
import { swc } from 'rollup-plugin-swc3';
import json from '@rollup/plugin-json';

const globals = {
	'@unbound-app/api': 'window.unbound',
	'react': 'window.React',
	'react-native': 'window.ReactNative',
	'react-native-reanimated': 'window.unbound.metro.common.Reanimated',
	'@react-native-clipboard/clipboard': 'window.unbound.metro.common.Clipboard',
	'moment': 'window.unbound.metro.common.Moment',
};

// `ubd dev` sets UNBOUND_HOT, so components register for hot refresh and keep their state on save.
const hot = process.env.UNBOUND_HOT === '1';

/** @type {import('rollup').RollupOptions} */
export default {
	input: 'index.tsx',
	external: Object.keys(globals),
	plugins: [
		nodeResolve(),
		json(),
		swc({
			tsconfig: false,
			jsc: { transform: { react: { refresh: hot, development: hot } } },
		}),
	],
	// Unbound evaluates the bundle as one expression and reads its exports, so the IIFE stays unnamed.
	onLog(level, log, handler) {
		if (log.code !== 'MISSING_NAME_OPTION_FOR_IIFE_EXPORT') {
			handler(level, log);
		}
	},
	output: {
		dir: 'dist',
		format: 'iife',
		compact: true,
		exports: 'named',
		globals,
	},
};
