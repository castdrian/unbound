import type { AddonAttribution } from '~/api/crash-guard';
import { describe, expect, test } from 'bun:test';

const { FakeAddons, makeManifest } = await import('./helpers/addons');
const { currentAddonAttribution, withAddonAttribution } = await import('~/api/crash-guard');
const { before } = await import('~/api/patcher');

class FreezeAddons extends FakeAddons {
	disabled: string[] = [];

	disable(entity: Parameters<FakeAddons['disable']>[0]) {
		this.disabled.push(typeof entity === 'string' ? entity : entity.id);
		super.disable(entity);
	}
}

function recordingAttribution(calls: string[], label: string): AddonAttribution {
	return (method) =>
		(...args) => {
			calls.push(label);

			return method(...args);
		};
}

describe('freeze handling', () => {
	test('tells the user about a first short freeze without disabling the addon', () => {
		const addons = new FreezeAddons();

		addons.load('bundle', makeManifest('freeze.once'));
		addons.handleFreeze({ id: 'plugins:freeze.once', name: 'freeze.once', seconds: 7 });

		expect(addons.disabled).toEqual([]);
	});

	test('disables an addon on its second freeze in a session', () => {
		const addons = new FreezeAddons();

		addons.load('bundle', makeManifest('freeze.twice'));
		addons.handleFreeze({ id: 'plugins:freeze.twice', name: 'freeze.twice', seconds: 7 });
		addons.handleFreeze({ id: 'plugins:freeze.twice', name: 'freeze.twice', seconds: 6 });

		expect(addons.disabled).toEqual(['freeze.twice']);
	});

	test('disables an addon at once after a long freeze', () => {
		const addons = new FreezeAddons();

		addons.load('bundle', makeManifest('freeze.long'));
		addons.handleFreeze({ id: 'plugins:freeze.long', name: 'freeze.long', seconds: 25 });

		expect(addons.disabled).toEqual(['freeze.long']);
	});

	test('ignores freezes of addons it does not manage', () => {
		const addons = new FreezeAddons();

		addons.handleFreeze({ id: 'themes:other', name: 'other', seconds: 30 });

		expect(addons.disabled).toEqual([]);
	});
});

describe('addon attribution', () => {
	test('runs addon code attributed and restores the previous attribution', () => {
		const calls: string[] = [];
		const outer = recordingAttribution(calls, 'outer');
		const inner = recordingAttribution(calls, 'inner');

		expect(currentAddonAttribution()).toBeUndefined();
		const result = withAddonAttribution(outer, () => {
			expect(currentAddonAttribution()).toBe(outer);
			withAddonAttribution(inner, () => expect(currentAddonAttribution()).toBe(inner));
			expect(currentAddonAttribution()).toBe(outer);

			return 42;
		});

		expect(result).toBe(42);
		expect(calls).toEqual(['outer', 'inner']);
		expect(currentAddonAttribution()).toBeUndefined();
	});

	test('attributes patch callbacks to the addon that registered them, keeping this', () => {
		const calls: string[] = [];
		const target = {
			value: 1,
			read(this: { value: number }) {
				return this.value;
			},
		};
		const seen: unknown[] = [];
		const unpatch = withAddonAttribution(recordingAttribution(calls, 'plugin'), () =>
			before(target, 'read', function (this: unknown) {
				seen.push(this);
			}),
		);

		calls.length = 0;
		expect(target.read()).toBe(1);
		expect(calls).toEqual(['plugin']);
		expect(seen).toEqual([target]);
		unpatch();

		const untracked = before(target, 'read', () => {});

		calls.length = 0;
		target.read();
		expect(calls).toEqual([]);
		untracked();
	});
});
