import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useCallback } from 'react';

import { fetchMarketplacePage, marketplaceSearchSchema } from '~/lib/marketplace';
import type { MarketplaceSearch } from '~/lib/marketplace';
import AddonListing from '~/components/addon-listing';

function PluginsPage() {
	const page = Route.useLoaderData();
	const search = Route.useSearch();
	const navigate = useNavigate({ from: Route.fullPath });

	const changeSearch = useCallback(
		(next: MarketplaceSearch) => navigate({ search: next }),
		[navigate],
	);

	return <AddonListing type='plugin' page={page} search={search} onSearchChange={changeSearch} />;
}

export const Route = createFileRoute('/_site/plugins')({
	head: () => ({ meta: [{ title: 'Unbound | Plugins' }] }),
	validateSearch: marketplaceSearchSchema,
	loaderDeps: ({ search }) => search,
	loader: ({ deps }) => fetchMarketplacePage({ data: { ...deps, type: 'plugin' } }),
	component: PluginsPage,
});
