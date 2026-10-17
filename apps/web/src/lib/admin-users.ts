import { DEFAULT_ROLE } from '~/lib/auth/access';
import type { AppContext } from '~/lib/context';

export type AdminUsersQuery = {
	/** Matches anywhere in the user's name. */
	search: string;
	/** 1-based. */
	page: number;
};

export type AdminUser = {
	id: string;
	name: string;
	email: string;
	image: string | null;
	role: string;
	banned: boolean;
	banReason: string | null;
	createdAt: Date;
};

export type AdminUsersPage = {
	users: AdminUser[];
	total: number;
	pageSize: number;
};

/**
 * @description Lists one page of users, newest first, through the admin plugin, which requires
 * `user:list` of the signed-in caller.
 * @param ctx The application context.
 * @param headers The caller's request headers.
 * @param query The name filter and page number.
 * @returns The page, the total number of matching users and the page size.
 */
export async function listAdminUsers(
	ctx: AppContext,
	headers: Headers,
	query: AdminUsersQuery,
): Promise<AdminUsersPage> {
	const pageSize = ctx.env.USER_LIST_PAGE_SIZE;
	const result = await ctx.auth.api.listUsers({
		headers,
		query: {
			searchValue: query.search || undefined,
			searchField: 'name',
			searchOperator: 'contains',
			sortBy: 'createdAt',
			sortDirection: 'desc',
			limit: pageSize,
			offset: (query.page - 1) * pageSize,
		},
	});

	const users = result.users.map((entry) => ({
		id: entry.id,
		name: entry.name,
		email: entry.email,
		image: entry.image ?? null,
		role: entry.role ?? DEFAULT_ROLE,
		banned: entry.banned ?? false,
		banReason: entry.banReason ?? null,
		createdAt: entry.createdAt,
	}));

	return { users, total: result.total, pageSize };
}

export default { listAdminUsers };
