import type { RefreshType } from 'react-refresh/runtime';
import * as Refresh from 'react-refresh/runtime';

import type { Component, FiberType } from '~/lib/hot/refresh';
import { rerender } from '~/lib/hot/refresh';

export { register, createSignatureFunctionForTransform } from 'react-refresh/runtime';

/** What applying the registrations since the last refresh did. */
type RefreshResult = {
	count: number;
	needsRemount: boolean;
};

type MemoType = { $$typeof: symbol; type: RefreshType; compare: RefreshType | null };
type ForwardRefType = { $$typeof: symbol; render: RefreshType };

const MEMO = Symbol.for('react.memo');
const FORWARD_REF = Symbol.for('react.forward_ref');

// The value each component binding is rebound to, and the family id behind it.
const canonicals = new Map<string, RefreshType>();
const ids = new Map<FiberType, string>();

/**
 * @description Returns the value a module's component binding should hold: the same one on every run of
 * the module, so elements made from an earlier run (including Discord's) still render the latest version.
 * @template T The component or `memo` / `forwardRef` object.
 * @param value The component from this run of its module.
 * @param id The family id the refresh transform registered it under.
 * @returns The stable component for this id.
 */
export function canonical<T extends RefreshType>(value: T, id: string): T {
	const existing = canonicals.get(id);

	if (!existing) {
		const stable = isComponent(value) ? forward(id, value) : value;

		canonicals.set(id, stable);
		ids.set(stable, id);

		return stable as T;
	}

	if (isMemo(existing) && isMemo(value)) {
		existing.type = value.type;
		existing.compare = value.compare;
	}

	if (isForwardRef(existing) && isForwardRef(value)) {
		existing.render = value.render;
	}

	return existing as T;
}

/**
 * @description Applies the components registered since the last call to every mounted fiber.
 * @returns How many fibers re-rendered, and whether a component changed its hooks and needs a remount.
 */
export function performRefresh(): RefreshResult {
	const update = Refresh.performReactRefresh();

	if (!update) {
		return { count: 0, needsRemount: false };
	}

	if (update.staleFamilies.size) {
		return { count: 0, needsRemount: true };
	}

	const count = rerender((type) => {
		// Host components (`RCTView`) are named by string and never registered.
		if (typeof type === 'string') return null;

		const id = ids.get(type);
		const family = id ? Refresh.getFamilyByID(id) : Refresh.getFamilyByType(type);

		if (!family || !update.updatedFamilies.has(family)) return null;

		// A stable binding already calls the latest version; anything else takes it directly.
		return id ? type : family.current;
	});

	return { count, needsRemount: false };
}

function forward(id: string, initial: Component): Component {
	function render(...args: Parameters<Component>) {
		const current = Refresh.getFamilyByID(id)?.current;
		const latest = typeof current === 'function' ? current : initial;

		return latest(...args);
	}

	Object.defineProperty(render, 'name', { value: initial.name });

	return render;
}

function isComponent(type: RefreshType): type is Component {
	return typeof type === 'function';
}

function isMemo(type: RefreshType): type is MemoType {
	return typeof type === 'object' && '$$typeof' in type && type.$$typeof === MEMO;
}

function isForwardRef(type: RefreshType): type is ForwardRefType {
	return typeof type === 'object' && '$$typeof' in type && type.$$typeof === FORWARD_REF;
}

export default { canonical, performRefresh };
