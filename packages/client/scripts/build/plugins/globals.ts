import type { Plugin } from 'rolldown';

type GlobalsConfig = Record<string, string>;

/**
 * @description Replaces the configured module ids with the global expression each maps to.
 * @param config A map of module id to the global expression that provides it.
 * @returns A rolldown plugin resolving those modules to their globals.
 */
export default function globals(config: GlobalsConfig): Plugin {
	return {
		name: 'globals',
		resolveId(id) {
			if (id in config) {
				return '\0global:' + id;
			}

			return null;
		},
		load(id) {
			if (!id.startsWith('\0global:')) return null;

			const moduleName = id.slice(8);
			const globalExpr = config[moduleName];

			if (!globalExpr) return null;

			return `module.exports = ${globalExpr};`;
		},
	};
}

/**
 * @description Maps each module id to its export on the `#shims#` module.
 * @param modules The module ids to shim.
 * @returns A {@link globals} config resolving each module to its shim.
 */
export function shimmedModules(modules: string[]): GlobalsConfig {
	return modules.reduce<GlobalsConfig>((config, mod) => {
		config[mod] = `require("#shims#").default[${JSON.stringify(mod)}]`;

		return config;
	}, {});
}
