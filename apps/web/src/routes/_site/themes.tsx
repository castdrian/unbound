import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useCallback } from 'react';

import { fetchMarketplacePage, marketplaceSearchSchema } from '~/lib/marketplace';
import type { MarketplaceSearch } from '~/lib/marketplace';
import AddonListing from '~/components/addon-listing';

function ThemesPage() {
	const page = Route.useLoaderData();
	const search = Route.useSearch();
	const navigate = useNavigate({ from: Route.fullPath });

	const changeSearch = useCallback(
		(next: MarketplaceSearch) => navigate({ search: next }),
		[navigate],
	);

	return <AddonListing type='theme' page={page} search={search} onSearchChange={changeSearch} />;
}

export const Route = createFileRoute('/_site/themes')({
	head: () => ({ meta: [{ title: 'Unbound | Themes' }] }),
	validateSearch: marketplaceSearchSchema,
	loaderDeps: ({ search }) => search,
	loader: ({ deps }) => fetchMarketplacePage({ data: { ...deps, type: 'theme' } }),
	component: ThemesPage,
});
