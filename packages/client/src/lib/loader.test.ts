import { expect, test } from 'bun:test';

import deferUntilReady from './loader';

type ReadyState = {
	ready: boolean;
	callbacks: Array<() => void>;
};

function createRequire(handler: (id: number | string) => void): MetroRequire {
	return Object.assign(handler, { importAll: handler });
}

test('releases readiness callbacks after Discord startup resumes', async () => {
	const state = (globalThis as typeof globalThis & { __unboundReady?: ReadyState })
		.__unboundReady;

	if (!state) {
		throw new Error('Readiness state was not installed.');
	}

	const events: string[] = [];

	state.ready = false;
	state.callbacks.splice(0);
	state.callbacks.push(() => events.push('ready'));

	const requireDescriptor = Object.getOwnPropertyDescriptor(globalThis, '__r');
	const defineDescriptor = Object.getOwnPropertyDescriptor(globalThis, '__d');

	Reflect.deleteProperty(globalThis, '__r');
	Reflect.deleteProperty(globalThis, '__d');

	try {
		deferUntilReady(async () => {
			events.push('initialize');
		});

		globalThis.__r = createRequire((id) => {
			events.push(`discord:${id}`);
		});

		globalThis.__r(0);

		await new Promise((resolve) => setTimeout(resolve, 0));

		expect(events).toEqual(['initialize', 'discord:0', 'ready']);
		expect(state.ready).toBe(true);
		expect(state.callbacks).toHaveLength(0);
	} finally {
		Reflect.deleteProperty(globalThis, '__r');
		Reflect.deleteProperty(globalThis, '__d');

		if (requireDescriptor) {
			Object.defineProperty(globalThis, '__r', requireDescriptor);
		}

		if (defineDescriptor) {
			Object.defineProperty(globalThis, '__d', defineDescriptor);
		}

		state.ready = false;
		state.callbacks.splice(0);
	}
});

test('materializes Metro modules before initializing when require already exists', async () => {
	const previousCollector = globalThis.__c;
	const previousModules = globalThis.modules;
	const previousRequire = globalThis.__r;
	const events: string[] = [];

	Reflect.deleteProperty(globalThis, 'modules');

	globalThis.__c = () => {
		events.push('collect');

		return new Map();
	};

	globalThis.__r = createRequire(() => undefined);

	try {
		deferUntilReady(async () => {
			events.push(globalThis.modules ? 'initialize' : 'missing');
		});

		await new Promise((resolve) => setTimeout(resolve, 0));

		expect(events).toEqual(['collect', 'initialize']);
	} finally {
		if (previousCollector) {
			globalThis.__c = previousCollector;
		} else {
			Reflect.deleteProperty(globalThis, '__c');
		}

		if (previousModules) {
			globalThis.modules = previousModules;
		} else {
			Reflect.deleteProperty(globalThis, 'modules');
		}

		if (previousRequire) {
			globalThis.__r = previousRequire;
		} else {
			Reflect.deleteProperty(globalThis, '__r');
		}
	}
});
