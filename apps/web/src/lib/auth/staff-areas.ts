import type { FileRoutesByTo } from '~/routeTree.gen';
import type { Permissions } from '~/lib/auth/access';
import { hasPermission } from '~/lib/auth/access';

export type StaffLink<T extends string> = {
	id: T;
	label: string;
	to: keyof FileRoutesByTo;
	permissions: Permissions;
};

export type StaffArea = StaffLink<'review' | 'admin'>;

export type StaffSectionId = 'review' | 'users' | 'addons';

export type StaffSection = StaffLink<StaffSectionId>;

/** The staff sections linked from the account menu, each shown only to roles granting its permissions. */
export const STAFF_AREAS: StaffArea[] = [
	{ id: 'review', label: 'Review', to: '/review', permissions: { submission: ['review'] } },
	{ id: 'admin', label: 'Admin', to: '/admin', permissions: { user: ['ban'] } },
];

/** The pages of the staff sidebar, in order; a page opens only for roles granting its permissions. */
export const STAFF_SECTIONS: Record<StaffSectionId, StaffSection> = {
	review: {
		id: 'review',
		label: 'Review Queue',
		to: '/review',
		permissions: { submission: ['review'] },
	},
	users: { id: 'users', label: 'Users', to: '/admin/users', permissions: { user: ['list'] } },
	addons: {
		id: 'addons',
		label: 'Addons',
		to: '/admin/addons',
		permissions: { addon: ['delist'] },
	},
};

/**
 * @description Picks the staff sections a role may open, by permission rather than role name.
 * @param role The user's `role` column, possibly comma-separated or unset.
 * @returns The sections to link, in menu order.
 */
export function getStaffAreas(role: string | null | undefined): StaffArea[] {
	return STAFF_AREAS.filter((area) => hasPermission(role, area.permissions));
}

/**
 * @description Picks the staff sidebar pages a role may open, by permission rather than role name.
 * @param role The user's `role` column, possibly comma-separated or unset.
 * @returns The pages to link, in sidebar order.
 */
export function getStaffSections(role: string | null | undefined): StaffSection[] {
	return Object.values(STAFF_SECTIONS).filter((section) =>
		hasPermission(role, section.permissions),
	);
}

export default { STAFF_AREAS, STAFF_SECTIONS, getStaffAreas, getStaffSections };
