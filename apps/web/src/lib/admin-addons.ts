import type { UserSummary } from '@unbound-app/contracts/account';
import type { Addon } from '@unbound-app/contracts/addons';
import { count, sql } from 'drizzle-orm';
import type { SQL } from 'drizzle-orm';

import { requirePermission } from '~/lib/api/caller';
import { likeContains } from '~/lib/like-contains';
import type { AppContext } from '~/lib/context';
import type { Caller } from '~/lib/api/caller';
import { toAddon } from '~/lib/addons';
import { addon } from '~/db/schema';

export type AdminAddonsQuery = {
	/** Matches anywhere in the addon id or name, case-insensitively. */
	search: string;
	/** 1-based. */
	page: number;
};

export type AdminAddon = Addon & {
	name: string;
	/** The newest approved version. */
	latestVersion: string | null;
	owners: UserSummary[];
};

export type AdminAddonsPage = {
	addons: AdminAddon[];
	total: number;
	pageSize: number;
};

function matching(table: typeof addon, search: string): SQL {
	return sql`(${likeContains(table.id, search)} or ${likeContains(table.name, search)})`;
}

/**
 * @description Lists one page of every addon, delisted ones included, ordered by id, with each one's
 * newest version and owners. Requires `addon:delist`.
 * @param ctx The application context.
 * @param caller The moderator.
 * @param query The id or name filter and page number.
 * @returns The page, the total number of matching addons and the page size.
 */
export async function listAdminAddons(
	ctx: AppContext,
	caller: Caller,
	query: AdminAddonsQuery,
): Promise<AdminAddonsPage> {
	requirePermission(caller, { addon: ['delist'] });

	const pageSize = ctx.env.ADDON_LIST_PAGE_SIZE;
	const { search } = query;

	const [rows, [counted]] = await Promise.all([
		ctx.db.query.addon.findMany({
			where: search ? { RAW: (table) => matching(table, search) } : undefined,
			with: {
				versions: { columns: { version: true }, orderBy: { versionKey: 'desc' }, limit: 1 },
				maintainers: {
					where: { role: 'owner' },
					with: { user: { columns: { id: true, name: true, image: true } } },
					orderBy: { createdAt: 'asc' },
				},
			},
			orderBy: { id: 'asc' },
			limit: pageSize,
			offset: (query.page - 1) * pageSize,
		}),
		ctx.db
			.select({ total: count() })
			.from(addon)
			.where(search ? matching(addon, search) : undefined),
	]);

	const addons = rows.map((row) => ({
		...toAddon(row),
		name: row.name,
		latestVersion: row.versions[0]?.version ?? null,
		owners: row.maintainers.flatMap(({ user }) =>
			user ? [{ id: user.id, name: user.name, image: user.image ?? null }] : [],
		),
	}));

	return { addons, total: counted?.total ?? 0, pageSize };
}

export default { listAdminAddons };
