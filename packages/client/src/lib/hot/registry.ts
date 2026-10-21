import type { Component } from '~/lib/hot/refresh';

/** A component across module re-runs: the stable function React mounts and the latest body it calls. */
type Family = {
	component: Component;
	render: Component;
	signature: string;
};

/** What module re-runs since the last {@link takeUpdates} changed. */
type Updates = {
	components: Set<Component>;
	needsRemount: boolean;
};

const families = new Map<string, Family>();

let updates: Updates = { components: new Set(), needsRemount: false };

/**
 * @description Registers a component under a stable id. The build's refresh transform wraps every top-level component in this call.
 * @param id The module path and export name, unique across the bundle.
 * @param render The component body from the latest run of its module.
 * @param signature The component's hook calls in order; a change means its state no longer lines up.
 * @returns The component's stable function, the same one on every run of its module.
 */
export function register(id: string, render: Component, signature: string): Component {
	const family = families.get(id);

	if (!family) {
		const created: Family = { component: forward(id), render, signature };

		Object.defineProperty(created.component, 'name', { value: render.name });
		families.set(id, created);

		return created.component;
	}

	updates.needsRemount ||= family.signature !== signature;
	updates.components.add(family.component);

	family.render = render;
	family.signature = signature;

	return family.component;
}

/**
 * @description Returns the components changed since the last call and starts a fresh set.
 * @returns The changed components and whether any changed its hooks.
 */
export function takeUpdates(): Updates {
	const taken = updates;

	updates = { components: new Set(), needsRemount: false };

	return taken;
}

// Calls the latest body, so the function React holds (and parents reference) never changes identity.
function forward(id: string): Component {
	return function (...args) {
		return families.get(id)!.render(...args);
	};
}

export default { register, takeUpdates };
