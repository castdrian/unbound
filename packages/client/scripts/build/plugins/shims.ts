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
			// Check if this module should be replaced with a global
			if (id in config) {
				return '\0global:' + id;
			}

			return null;
		},

		load(id) {
			// If this is a global module, return the global reference
			if (id.startsWith('\0global:')) {
				// Remove '\0global:' prefix
				const moduleName = id.slice(8);
				const globalName = config[moduleName];

				// Return: module.exports = window.GlobalName (or globalThis.GlobalName)
				return `module.exports = ${globalName};`;
			}

			return null;
		},
	};
}
