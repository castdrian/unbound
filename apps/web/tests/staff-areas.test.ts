import { describe, expect, test } from 'bun:test';

import { getStaffAreas, getStaffSections } from '~/lib/auth/staff-areas';
import type { Role } from '~/lib/auth/access';

type Case = [role: Role, ids: string[]];

const areaCases: Case[] = [
	['user', []],
	['developer', []],
	['moderator', ['review', 'admin']],
	['admin', ['review', 'admin']],
];

const sectionCases: Case[] = [
	['user', []],
	['developer', []],
	['moderator', ['review', 'users', 'addons']],
	['admin', ['review', 'users', 'addons']],
];

function areaIds(role: string | null | undefined): string[] {
	return getStaffAreas(role).map((area) => area.id);
}

function sectionIds(role: string | null | undefined): string[] {
	return getStaffSections(role).map((section) => section.id);
}

describe('getStaffAreas', () => {
	test.each(areaCases)('%s sees %o', (role, areas) => {
		expect(areaIds(role)).toEqual(areas);
	});

	test('a comma-separated role sees every area any one of its roles grants', () => {
		expect(areaIds('developer,moderator')).toEqual(['review', 'admin']);
	});

	test('an unset or unknown role sees nothing', () => {
		expect(areaIds(null)).toEqual([]);
		expect(areaIds('owner')).toEqual([]);
	});
});

describe('getStaffSections', () => {
	test.each(sectionCases)('%s opens %o', (role, sections) => {
		expect(sectionIds(role)).toEqual(sections);
	});

	test('an unset or unknown role opens nothing', () => {
		expect(sectionIds(undefined)).toEqual([]);
		expect(sectionIds('owner')).toEqual([]);
	});
});
