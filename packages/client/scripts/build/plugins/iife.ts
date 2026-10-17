import type { Plugin } from 'rolldown';

/**
 * @description Wraps each chunk in an IIFE that runs the preinit code first and alerts on a startup error.
 * @param preinit The code to run before the bundle.
 * @returns A rolldown plugin wrapping every rendered chunk.
 */
export default function iifeWrapper(preinit: Buffer | string): Plugin {
	return {
		name: 'iife-wrapper',
		renderChunk(code) {
			return `(() => {
				try {
					${preinit.toString()}
					${code}
				} catch(error) {
					alert('Unbound failed to initialize: ' + error.stack);
				}
			})();`;
		},
	};
}
