import type { Patch, PatchCallback, PatchContext, PatchOptions, PatchParent } from 'possess';
import { PATCH_SYMBOL, PatchType, instead, patches, before, after } from 'possess';
import type { ForwardedRef, ReactNode } from 'react';
import { createLogger } from '@unbound-app/logger';

import {
	dispatcherKind,
	runUnbudgeted,
	runWithBudget,
	spliceHooks,
	LateHook,
	hookList,
	settle,
} from '~/lib/hot/hooks';
import { ORIGINAL, commit, cut, fits, resolve } from '~/lib/hot/instances';
import { HOOK_FIBERS, reconcile, withAlternates } from '~/lib/hot/refresh';
import type { Decision, Fiber, FiberType } from '~/lib/hot/refresh';
import type { Instance, Layout } from '~/lib/hot/instances';
import type { Budget } from '~/lib/hot/hooks';

/** One patch callback added through Unbound's patcher, wrapped so mounted components pick it up. */
type Live = {
	phase: PatchType;
	parent: PatchParent;
	method: string;
	callback: PatchCallback;
	once: boolean;
	/** The hook objects each of its segments used in its last render, for components that aren't tracked. */
	counts: (number | null)[];
};

/** The hook calls of one wrapper call: one per possess `ctx`. */
type Scope = {
	instance: Instance | null;
	/** Where tracked instances read budgets from; `null` reads each callback's last counts. */
	budgets: Layout | null;
	mount: boolean;
	strict: boolean;
	record: Layout;
	/** How many segments each callback has opened in this call. */
	opened: Map<Live, number>;
	active: Active | null;
	original: Called | null;
};

type Active = {
	live: Live;
	budget: Budget;
	index: number;
};

type Called = { result: ReactNode };

/** What a trampoline is rendering right now. */
type RenderContext = {
	instance: Instance;
	render: Render;
	strict: boolean;
	record: Layout;
	claimed: boolean;
};

/** The patches made since the last flush. */
type Batch = {
	/** Each touched (parent, method) and its value before the batch. */
	touched: Map<PatchParent, Map<string, Renderable>>;
	removed: Set<Live>;
	remounts: Set<Instance>;
};

/** What a flush does, derived from a batch. */
type Plan = {
	swaps: Map<Renderable, Renderable>;
	/** Every value a touched (parent, method) held before or after the batch. */
	values: Set<Renderable>;
	parents: Set<PatchParent>;
	touched: Batch['touched'];
	removed: Set<Live>;
	remounts: Set<Instance>;
};

type Render = (props: Props, secondArg?: SecondArg) => ReactNode;

/** A component's props; the trampoline passes them through unread. */
type Props = { children?: ReactNode };

/** A forwardRef's ref, or a function component's legacy context; passed through unread. */
type SecondArg = ForwardedRef<Element>;

/** A fiber type that is not a host component's name. */
type Renderable = Exclude<FiberType, string>;

type ForwardRef = { $$typeof: symbol; render: Render };

type Patcher = (
	parent: PatchParent,
	method: string,
	callback: PatchCallback,
	options: PatchOptions,
) => () => void;

const FORWARD_REF = Symbol.for('react.forward_ref');
const CLASS = 1;

const PATCHERS: Record<PatchType, Patcher> = {
	[PatchType.Before]: before as Patcher,
	[PatchType.Instead]: instead as Patcher,
	[PatchType.After]: after as Patcher,
};

const logger = createLogger('Patcher', 'Live');

const lives = new WeakMap<PatchCallback, Live>();
const scopes = new WeakMap<PatchContext, Scope>();
const trampolines = new WeakMap<Renderable, Instance>();

// The layout each patched function last rendered with outside a trampoline, keyed by the wrapper.
const untracked = new WeakMap<Renderable, Layout>();

let rendering: RenderContext | null = null;
let batch: Batch | null = null;

/**
 * @description Patches a method so mounted components rendering it pick the patch up in place, hooks included.
 * @param phase When the callback runs.
 * @param parent The object holding the method.
 * @param method The method's key.
 * @param callback The patch callback.
 * @param options possess's patch options.
 * @returns A function removing the patch, again from mounted components too.
 */
export function patch(
	phase: PatchType,
	parent: PatchParent,
	method: string,
	callback: PatchCallback,
	options: PatchOptions = {},
): () => void {
	const live: Live = { phase, parent, method, callback, once: Boolean(options.once), counts: [] };
	const run = createRun(live);
	const value = Reflect.get(parent, method);
	const unpatch = PATCHERS[phase](parent, method, run, options);

	lives.set(run, live);
	touch(parent, method, value);

	return () => {
		remove(live);
		unpatch();
	};
}

/**
 * @description Records the removal of every registered patch a predicate picks, before possess removes them.
 * @param matches Picks the patches about to be removed.
 */
export function recordRemovals(matches: (patch: Patch) => boolean): void {
	for (const entry of patches) {
		const parent = entry.parent.deref();

		if (!parent) {
			continue;
		}

		for (const set of Object.values(entry.patches)) {
			for (const patch of set) {
				if (!matches(patch)) {
					continue;
				}

				touch(parent, entry.method, Reflect.get(parent, entry.method));

				const live = lives.get(patch.callback);

				if (live) {
					open().removed.add(live);
				}
			}
		}
	}
}

/**
 * @description Applies the patches made since the last flush to every mounted component. Runs on its own once per microtask.
 * @returns How many fibers were re-rendered or remounted.
 */
export function flush(): number {
	const current = batch;

	batch = null;

	if (!current) {
		return 0;
	}

	const plan = createPlan(current);

	try {
		return reconcile((fiber) => visit(fiber, plan));
	} catch (error) {
		logger.error('Failed to apply patches to mounted components:', error);

		return 0;
	} finally {
		// Every fiber that rendered with these layouts is tracked now; later mounts record fresh ones.
		for (const value of plan.values) {
			untracked.delete(value);
		}
	}
}

function createRun(live: Live): PatchCallback {
	return function run(
		// UNKNOWN: possess calls patch callbacks with the patched method's `this`.
		this: unknown,
		ctx: PatchContext,
	) {
		if (live.once) {
			remove(live);
		}

		const kind = dispatcherKind();

		if (kind === 'idle' || kind === 'budgeted') {
			return live.callback.call(this, ctx);
		}

		const scope = scopeOf(ctx, live, kind === 'mount');
		const active: Active = { live, budget: createBudget(scope), index: 0 };
		const previous = scope.active;

		begin(scope, active);
		scope.active = active;

		try {
			return runWithBudget(active.budget, () => {
				try {
					return live.callback.call(this, ctx);
				} catch (error) {
					if (!(error instanceof LateHook)) {
						throw error;
					}

					if (scope.instance) {
						open().remounts.add(scope.instance);
					}

					return live.phase === PatchType.Instead ? originalResult(ctx, scope) : void 0;
				}
			});
		} finally {
			end(scope, active);
			scope.active = previous;
		}
	};
}

function scopeOf(ctx: PatchContext, live: Live, mount: boolean) {
	const existing = scopes.get(ctx);

	if (existing) {
		return existing;
	}

	const wrapper = Reflect.get(live.parent, live.method);
	const context =
		rendering && !rendering.claimed && rendering.render === wrapper ? rendering : null;
	const scope: Scope = {
		instance: context?.instance ?? null,
		budgets: context ? budgetsOf(context) : null,
		mount,
		strict: context?.strict ?? false,
		record: context?.record ?? [],
		opened: new Map(),
		active: null,
		original: null,
	};

	if (context) {
		context.claimed = true;
	} else {
		untracked.set(wrapper, scope.record);
	}

	// The first wrapped callback to run is an `after` one, so the original has already run.
	if (live.phase === PatchType.After) {
		scope.record.push({ owner: ORIGINAL, count: null });
	}

	wrapOriginal(ctx, scope);
	scopes.set(ctx, scope);

	return scope;
}

function budgetsOf(context: RenderContext) {
	const { instance, strict } = context;

	return strict ? (instance.pending?.layout ?? instance.layout) : instance.layout;
}

// possess reads `ctx.original` when it calls it, so each call records a segment of the original's hooks
// and splits the running callback's segment around it.
function wrapOriginal(ctx: PatchContext, scope: Scope) {
	const original = ctx.original;

	ctx.original = (...args) => {
		const { active } = scope;

		if (active) {
			end(scope, active);
		}

		scope.record.push({ owner: ORIGINAL, count: null });

		try {
			const result = runUnbudgeted(() => original(...args));

			scope.original = { result };

			return result;
		} finally {
			if (active) {
				begin(scope, active);
			}
		}
	};
}

function originalResult(ctx: PatchContext, scope: Scope) {
	return scope.original ? scope.original.result : ctx.original(...ctx.args);
}

function createBudget(scope: Scope): Budget {
	return { limit: null, used: 0, unknown: false, strict: scope.strict };
}

function begin(scope: Scope, active: Active) {
	const { live, budget } = active;
	const index = scope.opened.get(live) ?? 0;

	scope.opened.set(live, index + 1);
	active.index = index;
	budget.used = 0;
	budget.unknown = false;
	budget.limit = scope.mount ? null : limitOf(scope, live, index);
}

function end(scope: Scope, active: Active) {
	const { live, budget, index } = active;

	settle(budget);

	const count = budget.unknown ? null : budget.used;

	live.counts[index] = count;
	scope.record.push({ owner: live, count });
}

// The hooks this component holds for a callback's nth segment: 0 when it is new to the component.
function limitOf(scope: Scope, live: Live, index: number) {
	if (!scope.budgets) {
		return index < live.counts.length ? live.counts[index] : 0;
	}

	let seen = 0;

	for (const segment of scope.budgets) {
		if (segment.owner !== live) {
			continue;
		}

		if (seen === index) {
			return segment.count;
		}

		seen++;
	}

	return 0;
}

function track(fiber: Fiber, target: Renderable, layout: Layout): Instance {
	const instance: Instance = { fiber, target, layout, pending: null };
	const trampoline = createTrampoline(instance);

	trampolines.set(trampoline, instance);

	for (const node of withAlternates([fiber])) {
		node.type = trampoline;
	}

	return instance;
}

// React copies `type` from the current fiber while `elementType` still matches the parent's element,
// so the trampoline survives the parent's re-renders.
function createTrampoline(instance: Instance): Renderable {
	function render(props: Props, secondArg?: SecondArg) {
		return renderInstance(instance, props, secondArg);
	}

	const target = instance.target;

	Object.defineProperty(render, 'name', { value: renderOf(target)?.name ?? 'Trampoline' });

	if (!isForwardRef(target)) {
		return render;
	}

	const trampoline: ForwardRef = { $$typeof: FORWARD_REF, render };

	return trampoline;
}

function renderInstance(instance: Instance, props: Props, secondArg?: SecondArg) {
	const { fiber } = instance;
	const { alternate } = fiber;
	const render = renderOf(instance.target);

	if (!render) return null;

	// React empties the work-in-progress hook list before the first pass; a re-render pass keeps it.
	const strict = fiber.memoizedState !== null && alternate?.memoizedState != null;
	const work = fiber.memoizedState === null ? fiber : alternate;

	if (!strict) {
		commit(instance, hookList(work === fiber ? alternate : fiber).length);
	}

	const context: RenderContext = { instance, render, strict, record: [], claimed: false };
	const previous = rendering;

	rendering = context;

	try {
		const result = render(props, secondArg);

		if (!strict) {
			const length = hookList(work).length;
			const layout: Layout = context.claimed
				? context.record
				: [{ owner: ORIGINAL, count: null }];

			instance.pending = { layout: resolve(layout, length), length };
		}

		return result;
	} finally {
		rendering = previous;
	}
}

function visit(fiber: Fiber, plan: Plan): Decision {
	const { type } = fiber;

	if (fiber.tag === CLASS) {
		return typeof type === 'function' && plan.parents.has(type.prototype) ? 'render' : null;
	}

	if (!type || typeof type === 'string' || !HOOK_FIBERS.has(fiber.tag)) return null;

	const length = hookList(fiber).length;
	const existing = trampolines.get(type);

	if (existing) {
		existing.fiber = fiber;
		commit(existing, length);

		if (plan.remounts.has(existing)) {
			return 'remount';
		}

		if (!affects(plan, existing.target)) return null;

		return update(existing, plan, length);
	}

	if (!affects(plan, type)) return null;

	const layout = initialLayout(plan, type, length);

	return layout ? update(track(fiber, type, layout), plan, length) : 'remount';
}

function affects(plan: Plan, type: Renderable) {
	return plan.values.has(type) || plan.parents.has(type);
}

// Untracked fibers mounted with the callbacks their wrapper had then, so its last untracked render
// describes them; a function no wrapped callback rendered in holds only the original's hooks.
function initialLayout(plan: Plan, type: Renderable, length: number): Layout | null {
	const render = isForwardRef(type)
		? (plan.touched.get(type)?.get('render') ?? type.render)
		: type;

	if (typeof render !== 'function' || !(PATCH_SYMBOL in render)) {
		return [{ owner: ORIGINAL, count: length }];
	}

	const recorded = untracked.get(render);

	if (!recorded) {
		return [{ owner: ORIGINAL, count: length }];
	}

	return fits(recorded, length) ? resolve(recorded, length) : null;
}

function update(instance: Instance, plan: Plan, length: number): Decision {
	const removal = cut(instance.layout, (owner) => plan.removed.has(owner as Live), length);

	if (!removal) {
		return 'remount';
	}

	for (const slice of removal.slices) {
		spliceHooks(instance.fiber, slice.start, slice.count);
	}

	instance.layout = removal.layout;
	instance.pending = null;

	const previous = instance.target;
	const next = plan.swaps.get(previous) ?? previous;

	instance.target = next;

	for (const node of withAlternates([instance.fiber])) {
		if (node.elementType === previous) {
			node.elementType = next;
		}
	}

	return 'render';
}

function createPlan(current: Batch): Plan {
	const plan: Plan = {
		swaps: new Map(),
		values: new Set(),
		parents: new Set(),
		touched: current.touched,
		removed: current.removed,
		remounts: current.remounts,
	};

	const changes: Change[] = [];

	for (const [parent, methods] of current.touched) {
		plan.parents.add(parent);

		for (const [method, previous] of methods) {
			const next: Renderable = Reflect.get(parent, method);

			plan.values.add(previous);
			plan.values.add(next);

			if (typeof previous === 'function' && typeof next === 'function' && previous !== next) {
				changes.push({ previous, next, order: orderOf(parent, method) });
			}
		}
	}

	// A function patched under two parents goes to the wrapper possess registered first; a parent that
	// renders the other one makes React remount it, which is safe.
	changes.sort((a, b) => a.order - b.order);

	for (const { previous, next } of changes) {
		if (!plan.swaps.has(previous)) {
			plan.swaps.set(previous, next);
		}
	}

	return plan;
}

type Change = {
	previous: Renderable;
	next: Renderable;
	order: number;
};

function orderOf(parent: PatchParent, method: string) {
	const index = patches.findIndex(
		(entry) => entry.parent.deref() === parent && entry.method === method,
	);

	return ~index ? index : patches.length;
}

function touch(parent: PatchParent, method: string, value: Renderable) {
	const { touched } = open();
	let methods = touched.get(parent);

	if (!methods) {
		methods = new Map();
		touched.set(parent, methods);
	}

	if (!methods.has(method)) {
		methods.set(method, value);
	}
}

function remove(live: Live) {
	touch(live.parent, live.method, Reflect.get(live.parent, live.method));
	open().removed.add(live);
}

function open() {
	if (!batch) {
		batch = { touched: new Map(), removed: new Set(), remounts: new Set() };
		queueMicrotask(flush);
	}

	return batch;
}

function renderOf(type: FiberType): Render | null {
	if (typeof type === 'function') {
		return type as Render;
	}

	return isForwardRef(type) ? type.render : null;
}

function isForwardRef(type: FiberType): type is ForwardRef {
	return typeof type === 'object' && type.$$typeof === FORWARD_REF;
}

export default { patch, recordRemovals, flush };
