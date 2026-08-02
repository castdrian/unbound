import { expect, test } from 'bun:test';

import { markReady } from './loader';

type ReadyState = {
	ready: boolean;
	callbacks: Array<() => void>;
};

test('drains callbacks when the client becomes ready', () => {
	const state = (globalThis as typeof globalThis & { __unboundReady?: ReadyState })
		.__unboundReady;
	if (!state) throw new Error('Readiness state was not installed.');

	let calls = 0;
	state.callbacks.push(() => {
		calls++;
	});

	expect(state.ready).toBe(false);
	markReady();
	expect(state.ready).toBe(true);
	expect(calls).toBe(1);
	expect(state.callbacks).toHaveLength(0);
});
