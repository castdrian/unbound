import { describe, expect, test } from 'bun:test';

import type { CrashEnvironment } from './crash-report';

import { buildCrashReport } from './crash-report';

const environment: CrashEnvironment = {
	platform: 'ios',
	clientVersion: '1.0.0',
	loaderVersion: '1.0.0',
	discordVersion: '350.0',
	osVersion: '26.0.1',
	deviceModel: 'iPhone12,8',
};

describe('crash reports', () => {
	test('carry only the event and the app, loader and device details', () => {
		const report = buildCrashReport(
			{
				kind: 'freeze',
				phase: 'frozen',
				seconds: 7,
				addon: { id: 'unbound.example', version: '1.0.0', trust: 'unsigned' },
			},
			environment,
		);

		expect(report).toMatchObject({ kind: 'freeze', ...environment });
		expect(Object.keys(report ?? {}).sort()).toEqual(
			[
				'addon',
				'clientVersion',
				'deviceModel',
				'discordVersion',
				'kind',
				'loaderVersion',
				'osVersion',
				'phase',
				'platform',
				'seconds',
			].sort(),
		);
	});

	test('trim long messages, stacks and device details to the limits', () => {
		const report = buildCrashReport(
			{ kind: 'start-failure', message: 'm'.repeat(5_000), stack: 's'.repeat(40_000) },
			{ ...environment, deviceModel: 'd'.repeat(100) },
		);

		expect(report?.message?.length).toBe(2_000);
		expect(report?.stack?.length).toBe(16_000);
		expect(report?.deviceModel.length).toBe(64);
	});

	test('refuse events the API would reject', () => {
		expect(
			buildCrashReport(
				{ kind: 'crash', addon: { id: 'not a valid id!', version: '1', trust: 'signed' } },
				environment,
			),
		).toBeUndefined();
	});
});
