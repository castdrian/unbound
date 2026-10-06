import { describe, expect, test } from 'bun:test';

import { createPatcher } from '../src/api/patcher';

describe('scoped patch cleanup', () => {
	test('removes a plugin patch without iterator helpers', () => {
		const target = { read: () => 1 };
		const patcher = createPatcher('test-scoped-patcher');
		patcher.after(target, 'read', () => 2);

		const iterator = Object.getPrototypeOf(Object.getPrototypeOf(new Set().values()));
		const filter = Object.getOwnPropertyDescriptor(iterator, 'filter');
		try {
			Object.defineProperty(iterator, 'filter', { configurable: true, value: undefined });
			expect(target.read()).toBe(2);
			expect(() => patcher.unpatchAll()).not.toThrow();
			expect(target.read()).toBe(1);
		} finally {
			if (filter) Object.defineProperty(iterator, 'filter', filter);
		}
	});
});
