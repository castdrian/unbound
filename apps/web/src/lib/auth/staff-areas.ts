import type { Permissions } from '~/lib/auth/access';
import { hasPermission } from '~/lib/auth/access';

export type StaffArea = {
	id: 'review' | 'admin';
	label: string;
	href: string;
	permissions: Permissions;
};

/** The staff sections linked from the account menu, each shown only to roles granting its permissions. */
export const STAFF_AREAS: StaffArea[] = [
	{ id: 'review', label: 'Review', href: '/review', permissions: { submission: ['review'] } },
	{ id: 'admin', label: 'Admin', href: '/admin', permissions: { user: ['set-role'] } },
];

/**
 * @description Picks the staff sections a role may open, by permission rather than role name.
 * @param role The user's `role` column, possibly comma-separated or unset.
 * @returns The sections to link, in menu order.
 */
export function getStaffAreas(role: string | null | undefined): StaffArea[] {
	return STAFF_AREAS.filter((area) => hasPermission(role, area.permissions));
}

export default { STAFF_AREAS, getStaffAreas };
