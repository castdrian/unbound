import { createPatcher as createPossessPatcher } from 'possess';

export * from 'possess';

function trackPatches<T extends (...args: any[]) => () => void>(
	method: T,
	unpatches: Set<() => void>,
): T {
	function register(...args: Parameters<T>): () => void {
		const unpatch = method(...args);
		let active = true;
		function remove(): void {
			if (!active) return;
			active = false;
			unpatches.delete(remove);
			unpatch();
		}
		unpatches.add(remove);
		return remove;
	}
	return register as T;
}

export function createPatcher(
	defaultOptions: Parameters<typeof createPossessPatcher>[0],
): ReturnType<typeof createPossessPatcher> {
	const patcher = createPossessPatcher(defaultOptions);
	const unpatches = new Set<() => void>();
	return {
		after: trackPatches(patcher.after, unpatches),
		before: trackPatches(patcher.before, unpatches),
		instead: trackPatches(patcher.instead, unpatches),
		unpatchAll(): void {
			for (const unpatch of unpatches) unpatch();
		},
	};
}
