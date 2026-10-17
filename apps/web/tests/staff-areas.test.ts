import { describe, expect, test } from 'bun:test';

import { getStaffAreas } from '~/lib/auth/staff-areas';
import type { Role } from '~/lib/auth/access';

type Case = [role: Role, areas: string[]];

const cases: Case[] = [
	['user', []],
	['developer', []],
	['moderator', ['review']],
	['admin', ['review', 'admin']],
];

function areaIds(role: string | null | undefined): string[] {
	return getStaffAreas(role).map((area) => area.id);
}

describe('getStaffAreas', () => {
	test.each(cases)('%s sees %o', (role, areas) => {
		expect(areaIds(role)).toEqual(areas);
	});

	test('a comma-separated role sees every area any one of its roles grants', () => {
		expect(areaIds('developer,moderator')).toEqual(['review']);
	});

	test('an unset or unknown role sees nothing', () => {
		expect(areaIds(null)).toEqual([]);
		expect(areaIds('owner')).toEqual([]);
	});
});
