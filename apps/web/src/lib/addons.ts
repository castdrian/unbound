import type {
	AddonResponse,
	ListAddonsResponse,
	MaintainersResponse,
	MyAddonsResponse,
	TransferAddonRequest,
} from '@unbound-app/contracts/addons';
import { and, eq, ne } from 'drizzle-orm';

import { OPEN_SUBMISSION_STATUSES, toSubmission } from '~/lib/submissions';
import { addon, addonMaintainer } from '~/db/schema';
import { requirePermission } from '~/lib/api/caller';
import { toAddonVersion } from '~/lib/artifacts';
import type { AppContext } from '~/lib/context';
import type { Caller } from '~/lib/api/caller';
import { ApiError } from '~/lib/api/errors';

export type AddonRow = typeof addon.$inferSelect;

const LATEST_VERSION = { versions: { orderBy: { versionKey: 'desc' }, limit: 1 } } as const;

function toAddon(row: AddonRow): AddonResponse['addon'] {
	return {
		id: row.id,
		createdAt: row.createdAt.toISOString(),
		delistedAt: row.delistedAt?.toISOString() ?? null,
	};
}

async function requireAddon(ctx: AppContext, id: string): Promise<AddonRow> {
	const row = await ctx.db.query.addon.findFirst({ where: { id } });

	if (!row) {
		throw new ApiError('not_found', `Addon ${id} does not exist.`);
	}

	return row;
}

async function requireUser(ctx: AppContext, userId: string) {
	const target = await ctx.db.query.user.findFirst({
		where: { id: userId },
		columns: { id: true },
	});

	if (!target) {
		throw new ApiError('not_found', `User ${userId} does not exist.`);
	}
}

async function requireOwner(ctx: AppContext, caller: Caller, addonId: string) {
	await requireAddon(ctx, addonId);

	const membership = await ctx.db.query.addonMaintainer.findFirst({
		where: { addonId, userId: caller.user.id },
		columns: { role: true },
	});

	if (!membership) {
		throw new ApiError('not_maintainer', `You are not a maintainer of ${addonId}.`);
	}

	if (membership.role !== 'owner') {
		throw new ApiError('forbidden', `Only owners of ${addonId} can manage its maintainers.`);
	}
}

/**
 * @description Lists the addon's maintainers, owners first.
 * @param ctx The application context.
 * @param addonId The addon id.
 * @returns The maintainers.
 */
export async function listMaintainers(
	ctx: AppContext,
	addonId: string,
): Promise<MaintainersResponse> {
	const rows = await ctx.db.query.addonMaintainer.findMany({
		where: { addonId },
		with: { user: { columns: { id: true, name: true, image: true } } },
		orderBy: { role: 'desc', createdAt: 'asc' },
	});

	const maintainers = rows.flatMap((row) =>
		row.user
			? [
					{
						id: row.user.id,
						name: row.user.name,
						image: row.user.image ?? null,
						role: row.role,
						addedAt: row.createdAt.toISOString(),
					},
				]
			: [],
	);

	return { maintainers };
}

/**
 * @description Adds a user as a maintainer of an addon the caller owns. Adding an existing member
 * changes nothing.
 * @param ctx The application context.
 * @param caller An owner of the addon.
 * @param addonId The addon id.
 * @param userId The user to add.
 * @returns The maintainers after the change.
 */
export async function addMaintainer(
	ctx: AppContext,
	caller: Caller,
	addonId: string,
	userId: string,
): Promise<MaintainersResponse> {
	await requireOwner(ctx, caller, addonId);
	await requireUser(ctx, userId);

	await ctx.db
		.insert(addonMaintainer)
		.values({ addonId, userId, role: 'maintainer', createdAt: ctx.now() })
		.onConflictDoNothing();

	return listMaintainers(ctx, addonId);
}

/**
 * @description Removes a maintainer from an addon the caller owns. An owner can only be removed while
 * another owner remains.
 * @param ctx The application context.
 * @param caller An owner of the addon.
 * @param addonId The addon id.
 * @param userId The member to remove.
 * @returns The maintainers after the change.
 */
export async function removeMaintainer(
	ctx: AppContext,
	caller: Caller,
	addonId: string,
	userId: string,
): Promise<MaintainersResponse> {
	await requireOwner(ctx, caller, addonId);

	ctx.db.transaction(
		(tx) => {
			const members = tx
				.select({ userId: addonMaintainer.userId, role: addonMaintainer.role })
				.from(addonMaintainer)
				.where(eq(addonMaintainer.addonId, addonId))
				.all();

			const target = members.find((member) => member.userId === userId);

			if (!target) {
				throw new ApiError('not_found', `${userId} is not a maintainer of ${addonId}.`);
			}

			const owners = members.filter((member) => member.role === 'owner');

			if (target.role === 'owner' && owners.length <= 1) {
				throw new ApiError(
					'last_owner',
					`${addonId} needs another owner before its only owner can leave.`,
				);
			}

			tx.delete(addonMaintainer)
				.where(
					and(eq(addonMaintainer.addonId, addonId), eq(addonMaintainer.userId, userId)),
				)
				.run();
		},
		{ behavior: 'immediate' },
	);

	return listMaintainers(ctx, addonId);
}

/**
 * @description Makes another user the addon's owner. The previous owner stays on as a maintainer
 * unless `keepPreviousOwner` is false. Requires `addon:transfer`.
 * @param ctx The application context.
 * @param caller The administrator.
 * @param addonId The addon id.
 * @param request The new owner and whether to keep the previous one.
 * @returns The maintainers after the transfer.
 */
export async function transferAddon(
	ctx: AppContext,
	caller: Caller,
	addonId: string,
	request: TransferAddonRequest,
): Promise<MaintainersResponse> {
	requirePermission(caller, { addon: ['transfer'] });

	await requireAddon(ctx, addonId);
	await requireUser(ctx, request.userId);

	const previous = and(
		eq(addonMaintainer.addonId, addonId),
		eq(addonMaintainer.role, 'owner'),
		ne(addonMaintainer.userId, request.userId),
	);

	ctx.db.transaction(
		(tx) => {
			if (request.keepPreviousOwner) {
				tx.update(addonMaintainer).set({ role: 'maintainer' }).where(previous).run();
			} else {
				tx.delete(addonMaintainer).where(previous).run();
			}

			tx.insert(addonMaintainer)
				.values({ addonId, userId: request.userId, role: 'owner', createdAt: ctx.now() })
				.onConflictDoUpdate({
					target: [addonMaintainer.addonId, addonMaintainer.userId],
					set: { role: 'owner' },
				})
				.run();
		},
		{ behavior: 'immediate' },
	);

	return listMaintainers(ctx, addonId);
}

async function setDelistedAt(
	ctx: AppContext,
	caller: Caller,
	addonId: string,
	delistedAt: Date | null,
): Promise<AddonResponse> {
	requirePermission(caller, { addon: ['delist'] });

	const [updated] = await ctx.db
		.update(addon)
		.set({ delistedAt })
		.where(eq(addon.id, addonId))
		.returning();

	if (!updated) {
		throw new ApiError('not_found', `Addon ${addonId} does not exist.`);
	}

	return { addon: toAddon(updated) };
}

/**
 * @description Hides an addon from listings and update checks. Its published files stay in the
 * public bucket so existing installs keep working. Requires `addon:delist`. Twin of {@link relistAddon}.
 * @param ctx The application context.
 * @param caller The moderator.
 * @param addonId The addon id.
 * @returns The addon.
 */
export function delistAddon(
	ctx: AppContext,
	caller: Caller,
	addonId: string,
): Promise<AddonResponse> {
	return setDelistedAt(ctx, caller, addonId, ctx.now());
}

/**
 * @description Lists a delisted addon again. Requires `addon:delist`. Twin of {@link delistAddon}.
 * @param ctx The application context.
 * @param caller The moderator.
 * @param addonId The addon id.
 * @returns The addon.
 */
export function relistAddon(
	ctx: AppContext,
	caller: Caller,
	addonId: string,
): Promise<AddonResponse> {
	return setDelistedAt(ctx, caller, addonId, null);
}

/**
 * @description Lists one page of addons that are not delisted, ordered by id, with each one's newest
 * version.
 * @param ctx The application context.
 * @param cursor The last addon id of the previous page.
 * @returns The page and the cursor of the next one.
 */
export async function listAddons(ctx: AppContext, cursor?: string): Promise<ListAddonsResponse> {
	const size = ctx.env.ADDON_LIST_PAGE_SIZE;
	const rows = await ctx.db.query.addon.findMany({
		where: { delistedAt: { isNull: true }, ...(cursor ? { id: { gt: cursor } } : {}) },
		with: LATEST_VERSION,
		orderBy: { id: 'asc' },
		limit: size + 1,
	});

	const page = rows.slice(0, size);
	const addons = page.flatMap((row) => {
		const [latest] = row.versions;

		return latest ? [{ id: row.id, latestVersion: toAddonVersion(ctx.env, latest) }] : [];
	});

	return { addons, nextCursor: rows.length > size ? (page.at(-1)?.id ?? null) : null };
}

/**
 * @description Lists the addons the caller maintains with their newest version and open submissions,
 * plus the caller's new listings still in the queue.
 * @param ctx The application context.
 * @param caller The signed-in user.
 * @returns The caller's addons and open listings.
 */
export async function listMyAddons(ctx: AppContext, caller: Caller): Promise<MyAddonsResponse> {
	const userId = caller.user.id;
	const memberships = await ctx.db.query.addonMaintainer.findMany({
		where: { userId },
		with: { addon: { with: LATEST_VERSION } },
		orderBy: { addonId: 'asc' },
	});

	const ids = memberships.map((membership) => membership.addonId);
	const open = await ctx.db.query.submission.findMany({
		where: {
			status: { in: OPEN_SUBMISSION_STATUSES },
			OR: [{ addonId: { in: ids } }, { authorId: userId, kind: 'listing' }],
		},
		orderBy: { createdAt: 'asc' },
	});

	const addons = memberships.flatMap(({ addon: row, role }) => {
		if (!row) {
			return [];
		}

		const [latest] = row.versions;

		return [
			{
				...toAddon(row),
				role,
				latestVersion: latest ? toAddonVersion(ctx.env, latest) : null,
				openSubmissions: open
					.filter((entry) => entry.addonId === row.id && entry.kind === 'update')
					.map(toSubmission),
			},
		];
	});

	const openListings = open.filter((entry) => entry.kind === 'listing').map(toSubmission);

	return { addons, openListings };
}

export default {
	listMaintainers,
	addMaintainer,
	removeMaintainer,
	transferAddon,
	delistAddon,
	relistAddon,
	listAddons,
	listMyAddons,
};
