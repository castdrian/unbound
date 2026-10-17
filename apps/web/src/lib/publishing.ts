import type {
	AddonVersion,
	MaintainedAddon,
	MyAddonsResponse,
} from '@unbound-app/contracts/addons';
import { getRequestHeaders } from '@tanstack/react-start/server';
import { createServerFn } from '@tanstack/react-start';

import { requireCaller } from '~/lib/api/caller';
import { listMyAddons } from '~/lib/addons';
import app from '~/lib/app';

export type SubmitOverview = {
	/** Repository-backed submissions need a linked GitHub account with push access. */
	githubLinked: boolean;
};

/** A published version without its manifest, whose passthrough keys a server function cannot serialize. */
export type DashboardVersion = Omit<AddonVersion, 'manifest'> & {
	name: string;
};

export type DashboardAddon = Omit<MaintainedAddon, 'latestVersion'> & {
	latestVersion: DashboardVersion | null;
};

export type Dashboard = Omit<MyAddonsResponse, 'addons'> &
	SubmitOverview & {
		addons: DashboardAddon[];
	};

async function isGitHubLinked(headers: Headers): Promise<boolean> {
	const accounts = await app.auth.api.listUserAccounts({ headers });

	return accounts.some((account) => account.providerId === 'github');
}

function toDashboardVersion({ manifest, ...version }: AddonVersion): DashboardVersion {
	return { ...version, name: manifest.name };
}

/**
 * @description Loads what `/submit` needs for the signed-in user.
 * @returns Whether the user has linked GitHub.
 */
export const getSubmitOverview = createServerFn({ method: 'GET' }).handler(
	async (): Promise<SubmitOverview> => ({
		githubLinked: await isGitHubLinked(getRequestHeaders()),
	}),
);

/**
 * @description Loads `/dashboard` for the signed-in user: their addons with open updates, their open
 * new listings and whether they have linked GitHub, for republishing.
 * @returns The dashboard data.
 */
export const getDashboard = createServerFn({ method: 'GET' }).handler(
	async (): Promise<Dashboard> => {
		const headers = getRequestHeaders();
		const caller = await requireCaller(app, headers);
		const [{ addons, openListings }, githubLinked] = await Promise.all([
			listMyAddons(app, caller),
			isGitHubLinked(headers),
		]);

		return {
			addons: addons.map(({ latestVersion, ...entry }) => ({
				...entry,
				latestVersion: latestVersion ? toDashboardVersion(latestVersion) : null,
			})),
			openListings,
			githubLinked,
		};
	},
);

export default { getSubmitOverview, getDashboard };
