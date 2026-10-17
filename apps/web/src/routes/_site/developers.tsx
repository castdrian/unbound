import {
	IconChevronLeft,
	IconChevronRight,
	IconUsers,
	IconX,
	IconZoom,
	IconZoomCancel,
} from '@tabler/icons-react';
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { createServerFn } from '@tanstack/react-start';
import type { ChangeEvent, FormEvent } from 'react';
import debounce from '@unbound-app/utils/debounce';
import { useMemo, useState } from 'react';
import { z } from 'zod';

import {
	Empty,
	EmptyContent,
	EmptyDescription,
	EmptyHeader,
	EmptyMedia,
	EmptyTitle,
} from '~/components/ui/empty';
import { InputGroup, InputGroupAddon, InputGroupInput } from '~/components/ui/input-group';
import DeveloperCard from '~/components/developer-card';
import type { CssVariables } from '~/lib/css-variables';
import { listDevelopers } from '~/lib/developers';
import { Button } from '~/components/ui/button';
import Text from '~/components/ui/text';
import app from '~/lib/app';

type DevelopersSearch = z.infer<typeof developersSearchSchema>;

const SEARCH_DEBOUNCE_MS = 300;

const GRID_STYLE: CssVariables = { '--col-width': '300px' };

const developersSearchSchema = z.object({
	page: z.coerce.number().int().min(1).optional(),
	search: z.string().max(100).optional(),
});

const fetchDevelopers = createServerFn({ method: 'GET' })
	.validator(developersSearchSchema)
	.handler(({ data }) =>
		listDevelopers(app, { search: data.search ?? '', page: data.page ?? 1 }),
	);

// Defaults are left out of the URL so `/developers` stays the canonical first page.
function toSearch(search: string, page: number): DevelopersSearch {
	return { search: search || undefined, page: page > 1 ? page : undefined };
}

function DevelopersContent() {
	const { developers, total, pageSize } = Route.useLoaderData();
	const params = Route.useSearch();
	const navigate = useNavigate({ from: Route.fullPath });
	const search = params.search ?? '';
	const page = params.page ?? 1;
	const totalPages = Math.ceil(total / pageSize);
	const [searchInput, setSearchInput] = useState(search);

	const navigateToSearch = useMemo(
		() =>
			debounce(
				(value: string) => navigate({ search: toSearch(value, 1) }),
				SEARCH_DEBOUNCE_MS,
			),
		[navigate],
	);

	function handleSubmit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		navigate({ search: toSearch(searchInput, 1) });
	}

	function handleChange(event: ChangeEvent<HTMLInputElement>) {
		setSearchInput(event.target.value);
		navigateToSearch(event.target.value);
	}

	function clearSearch() {
		setSearchInput('');
		navigate({ search: toSearch('', 1) });
	}

	function goToPage(next: number) {
		navigate({ search: toSearch(search, next) });
	}

	if (total === 0 && !search) {
		return (
			<Empty className='flex-1 my-auto'>
				<EmptyHeader>
					<EmptyMedia variant='icon'>
						<IconUsers />
					</EmptyMedia>
					<EmptyTitle>No Developers Yet</EmptyTitle>
					<EmptyDescription>
						There are no developers yet. Developers will appear here once they join.
					</EmptyDescription>
				</EmptyHeader>
			</Empty>
		);
	}

	return (
		<div className='flex flex-col flex-1 gap-5 mb-12'>
			<form onSubmit={handleSubmit} className='flex gap-2'>
				<InputGroup className='w-full'>
					<InputGroupAddon>
						<IconZoom />
					</InputGroupAddon>
					<InputGroupInput
						className='h-full'
						placeholder='Search Developers...'
						value={searchInput}
						onChange={handleChange}
					/>
				</InputGroup>
			</form>

			{developers.length === 0 ? (
				<Empty className='flex-1 my-auto'>
					<EmptyHeader>
						<EmptyMedia variant='icon'>
							<IconZoomCancel />
						</EmptyMedia>
						<EmptyTitle>No Developers Found</EmptyTitle>
						<EmptyDescription>
							No developers match your search. Try adjusting your search terms.
						</EmptyDescription>
					</EmptyHeader>
					<EmptyContent>
						<Button onClick={clearSearch}>
							<IconX />
							Clear Search
						</Button>
					</EmptyContent>
				</Empty>
			) : (
				<>
					<div style={GRID_STYLE} className='fill-grid gap-3'>
						{developers.map((developer) => (
							<DeveloperCard developer={developer} key={developer.id} />
						))}
					</div>

					{totalPages > 1 ? (
						<div className='flex items-center justify-between border-t border-border pt-4'>
							<Text variant='text-sm' color='muted'>
								Showing {(page - 1) * pageSize + 1}–
								{Math.min(page * pageSize, total)} of {total} developers
							</Text>
							<div className='flex items-center gap-2'>
								<Button
									variant='outline'
									size='sm'
									onClick={() => goToPage(page - 1)}
									disabled={page <= 1}
								>
									<IconChevronLeft className='size-4' />
									Previous
								</Button>
								<span className='text-sm text-muted-foreground px-2'>
									Page {page} of {totalPages}
								</span>
								<Button
									variant='outline'
									size='sm'
									onClick={() => goToPage(page + 1)}
									disabled={page >= totalPages}
								>
									Next
									<IconChevronRight className='size-4' />
								</Button>
							</div>
						</div>
					) : null}
				</>
			)}
		</div>
	);
}

function DevelopersPage() {
	return (
		<div className='flex flex-col flex-1 gap-4 md:mx-auto px-4 w-full container'>
			<div className='flex flex-col gap-2'>
				<Text variant='heading-lg'>Developers</Text>
				<Text variant='text-md' color='muted'>
					The contributors that make your addon experience possible.
				</Text>
			</div>
			<DevelopersContent />
		</div>
	);
}

export const Route = createFileRoute('/_site/developers')({
	head: () => ({ meta: [{ title: 'Unbound | Developers' }] }),
	validateSearch: developersSearchSchema,
	loaderDeps: ({ search }) => search,
	loader: ({ deps }) => fetchDevelopers({ data: deps }),
	component: DevelopersPage,
});
