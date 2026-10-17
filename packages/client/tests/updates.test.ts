import {
	checkUpdatesEndpoint,
	createTestContext,
	manifest,
	seedApprovedAddon,
	seedVersion,
	serveEndpoints,
	signInWithDiscord,
} from '@unbound-app/web/testing';
import { afterAll, beforeAll, beforeEach, describe, expect, spyOn, test } from 'bun:test';
import { updatesRequestSchema } from '@unbound-app/contracts/updates';
import type { Addon } from '@unbound-app/types';

import { checkForUpdates } from '~/lib/updates';

import { FakeAddons, makeInstance, makeManifest, resetDevice, writes } from './helpers/addons';

const CLIENT_VERSION = '1.0.0';

// The CDN: real bytes over HTTP, keyed by path, standing in for the public bucket.
const files = new Map<string, string>();
const cdn = Bun.serve({
	port: 0,
	fetch(request) {
		const body = files.get(new URL(request.url).pathname);

		return body === undefined ? new Response('Not found', { status: 404 }) : new Response(body);
	},
});

const web = createTestContext({ CDN_URL: cdn.url.origin });
const api = serveEndpoints(web.ctx, { 'POST /api/v1/updates': checkUpdatesEndpoint });

// Bound and stopped up front, so nothing is listening on its port.
const closed = Bun.serve({ port: 0, fetch: () => new Response() });
const unreachableUrl = closed.url.origin;

closed.stop(true);

afterAll(() => {
	api.stop(true);
	cdn.stop(true);
	web.close();
});

function sha256(bundle: string): string {
	return new Bun.CryptoHasher('sha256').update(bundle).digest('hex');
}

// Publishes `version` of `id` on the CDN and approves it with the digest of `published`, which is
// the served bundle unless a test wants the two to differ.
async function release(
	ownerId: string,
	id: string,
	version: string,
	served: string,
	published: string = served,
) {
	const next = manifest(id, version);

	files.set(`/addons/${id}/${version}/manifest.json`, JSON.stringify(next));
	files.set(`/addons/${id}/${version}/index.js`, served);

	await seedVersion(web.ctx, ownerId, next, sha256(published));
}

beforeAll(async () => {
	const { userId } = await signInWithDiscord(web.ctx, {
		id: '80351110224678920',
		name: 'Owner',
		email: 'owner@example.com',
	});

	for (const id of ['up.applied', 'up.disabled', 'up.tampered', 'up.current']) {
		await seedApprovedAddon(web.ctx, userId, manifest(id, '1.0.0'));
	}

	await release(userId, 'up.applied', '1.1.0', 'applied-1.1.0');
	await release(userId, 'up.disabled', '1.1.0', 'disabled-1.1.0');
	await release(userId, 'up.tampered', '1.1.0', 'tampered-served', 'tampered-reviewed');
});

beforeEach(resetDevice);

function seed(manager: FakeAddons, id: string, started: boolean, version: string = '1.0.0') {
	manager.seed({
		id,
		data: makeManifest(id, version),
		bundle: 'old',
		instance: started ? makeInstance('old', manager.log) : null,
		started,
		failed: false,
	});
}

function recordEvents(manager: FakeAddons): string[] {
	const events: string[] = [];
	const record = (name: string) => (entity: Addon) => void events.push(`${name}:${entity.id}`);

	manager.on('reloaded', record('reloaded'));
	manager.on('updated', record('updated'));
	manager.on('update-error', record('update-error'));

	return events;
}

// Runs a check and returns the bodies of the updates requests it sent.
async function check(managers: FakeAddons[], baseUrl: string = api.url.origin) {
	const requests = spyOn(globalThis, 'fetch');

	try {
		await checkForUpdates(managers, { baseUrl, clientVersion: CLIENT_VERSION });

		const sent = requests.mock.calls
			.map(([input, init]) => new Request(input, init))
			.filter((request) => new URL(request.url).pathname === '/api/v1/updates');

		return Promise.all(
			sent.map(async (request) => updatesRequestSchema.parse(await request.json())),
		);
	} finally {
		requests.mockRestore();
	}
}

describe('checkForUpdates', () => {
	test('sends one request when nothing is newer and leaves addons untouched', async () => {
		const manager = new FakeAddons();
		const events = recordEvents(manager);

		seed(manager, 'up.current', true);

		const requests = await check([manager]);

		expect(requests).toEqual([
			{ clientVersion: CLIENT_VERSION, addons: [{ id: 'up.current', version: '1.0.0' }] },
		]);
		expect(manager.getEntity('up.current')?.bundle).toBe('old');
		expect(manager.log).toEqual([]);
		expect(writes).toEqual([]);
		expect(events).toEqual([]);
	});

	test('applies updates across managers from one request, keeping enabled state', async () => {
		const plugins = new FakeAddons();
		const others = new FakeAddons();
		const pluginEvents = recordEvents(plugins);
		const otherEvents = recordEvents(others);

		seed(plugins, 'up.applied', true);
		seed(plugins, 'local.addon', true);
		seed(others, 'up.disabled', false);
		seed(others, 'local.unversioned', false, 'dev');

		const requests = await check([plugins, others]);

		expect(requests).toEqual([
			{
				clientVersion: CLIENT_VERSION,
				addons: [
					{ id: 'up.applied', version: '1.0.0' },
					{ id: 'local.addon', version: '1.0.0' },
					{ id: 'up.disabled', version: '1.0.0' },
				],
			},
		]);

		const applied = plugins.getEntity('up.applied');

		expect(applied?.data.version).toBe('1.1.0');
		expect(applied?.bundle).toBe('applied-1.1.0');
		expect(applied?.started).toBe(true);
		expect(plugins.log).toEqual(['stop:old', 'start:applied-1.1.0']);

		const disabled = others.getEntity('up.disabled');

		expect(disabled?.data.version).toBe('1.1.0');
		expect(disabled?.bundle).toBe('disabled-1.1.0');
		expect(disabled?.started).toBe(false);
		expect(others.log).toEqual([]);

		expect(plugins.getEntity('local.addon')?.bundle).toBe('old');
		expect(others.getEntity('local.unversioned')?.bundle).toBe('old');
		expect(writes.toSorted()).toEqual([
			'Unbound/Plugins/up.applied/index.js',
			'Unbound/Plugins/up.applied/manifest.json',
			'Unbound/Plugins/up.disabled/index.js',
			'Unbound/Plugins/up.disabled/manifest.json',
		]);
		expect(pluginEvents).toEqual(['reloaded:up.applied', 'updated:up.applied']);
		expect(otherEvents).toEqual(['reloaded:up.disabled', 'updated:up.disabled']);
	});

	test('rejects a bundle whose SHA-256 does not match and keeps the old version running', async () => {
		const manager = new FakeAddons();
		const events = recordEvents(manager);

		seed(manager, 'up.tampered', true);

		await check([manager]);

		const tampered = manager.getEntity('up.tampered');

		expect(tampered?.data.version).toBe('1.0.0');
		expect(tampered?.bundle).toBe('old');
		expect(tampered?.started).toBe(true);
		expect(manager.log).toEqual([]);
		expect(writes).toEqual([]);
		expect(events).toEqual(['update-error:up.tampered']);
		expect(manager.errors.get('up.tampered')?.message).toBe(
			`Bundle SHA-256 ${sha256('tampered-served')} does not match ${sha256('tampered-reviewed')}.`,
		);
	});

	test('logs and changes nothing when the server is unreachable', async () => {
		const manager = new FakeAddons();
		const events = recordEvents(manager);

		seed(manager, 'up.applied', true);

		expect(await check([manager], unreachableUrl)).toHaveLength(1);
		expect(manager.getEntity('up.applied')?.bundle).toBe('old');
		expect(manager.log).toEqual([]);
		expect(writes).toEqual([]);
		expect(events).toEqual([]);
	});
});
