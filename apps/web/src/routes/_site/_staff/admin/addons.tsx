import { createFileRoute, redirect, useNavigate } from '@tanstack/react-router';
import { getRequestHeaders } from '@tanstack/react-start/server';
import { createServerFn } from '@tanstack/react-start';

import { pageSearchSchema, toPageSearch } from '~/lib/page-search';
import AddonActions from '~/components/admin/addon-actions';
import SearchForm from '~/components/admin/search-form';
import { STAFF_SECTIONS } from '~/lib/auth/staff-areas';
import { listAdminAddons } from '~/lib/admin-addons';
import { hasPermission } from '~/lib/auth/access';
import { requireCaller } from '~/lib/api/caller';
import Pager from '~/components/admin/pager';
import Text from '~/components/ui/text';
import app from '~/lib/app';

const HEADER_CLASS = 'px-4 py-3 font-medium text-muted-foreground text-sm text-left';

const fetchAddons = createServerFn({ method: 'GET' })
	.validator(pageSearchSchema)
	.handler(async ({ data }) => {
		const caller = await requireCaller(app, getRequestHeaders());

		return listAdminAddons(app, caller, { search: data.search ?? '', page: data.page ?? 1 });
	});

function AddonsPage() {
	const { user: viewer } = Route.useRouteContext();
	const { addons, total, pageSize } = Route.useLoaderData();
	const params = Route.useSearch();
	const navigate = useNavigate({ from: Route.fullPath });
	const search = params.search ?? '';
	const page = params.page ?? 1;
	const canDelist = hasPermission(viewer.role, { addon: ['delist'] });
	const canTransfer = hasPermission(viewer.role, { addon: ['transfer'] });

	return (
		<div className='flex flex-col gap-6'>
			<div className='flex flex-col gap-2'>
				<Text variant='heading-lg'>Addons</Text>
				<Text variant='text-md' color='muted'>
					Delist or relist addons and transfer their ownership.
				</Text>
			</div>

			<SearchForm
				key={search}
				search={search}
				placeholder='Search by id or name...'
				onSearch={(value) => navigate({ search: toPageSearch(value, 1) })}
			/>

			<div className='bg-card border border-border rounded-lg overflow-hidden'>
				<div className='overflow-x-auto'>
					<table className='w-full'>
						<thead className='bg-muted/50 border-b border-border'>
							<tr>
								<th className={HEADER_CLASS}>Addon</th>
								<th className={HEADER_CLASS}>Latest</th>
								<th className={HEADER_CLASS}>Owners</th>
								<th className={HEADER_CLASS}>Status</th>
								<th className={HEADER_CLASS}>
									<span className='sr-only'>Actions</span>
								</th>
							</tr>
						</thead>
						<tbody className='divide-y divide-border'>
							{addons.length === 0 ? (
								<tr>
									<td
										colSpan={5}
										className='px-4 py-8 text-muted-foreground text-center'
									>
										No addons found.
									</td>
								</tr>
							) : (
								addons.map((addon) => (
									<tr key={addon.id} className='hover:bg-muted/30'>
										<td className='px-4 py-3'>
											<div className='flex flex-col min-w-0'>
												<span className='font-medium truncate'>
													{addon.name}
												</span>
												<span className='font-mono text-muted-foreground text-xs'>
													{addon.id}
												</span>
											</div>
										</td>
										<td className='px-4 py-3 text-muted-foreground text-sm'>
											{addon.latestVersion ?? 'None'}
										</td>
										<td className='px-4 py-3 text-sm'>
											{addon.owners.map((owner) => owner.name).join(', ')}
										</td>
										<td className='px-4 py-3 text-sm'>
											{addon.delistedAt ? (
												<span className='text-destructive'>Delisted</span>
											) : (
												<span className='text-green-600 dark:text-green-500'>
													Listed
												</span>
											)}
										</td>
										<td className='px-4 py-3 whitespace-nowrap'>
											<AddonActions
												addon={addon}
												canDelist={canDelist}
												canTransfer={canTransfer}
											/>
										</td>
									</tr>
								))
							)}
						</tbody>
					</table>
				</div>

				<Pager
					page={page}
					pageSize={pageSize}
					total={total}
					noun='addons'
					onPageChange={(next) => navigate({ search: toPageSearch(search, next) })}
				/>
			</div>
		</div>
	);
}

export const Route = createFileRoute('/_site/_staff/admin/addons')({
	head: () => ({ meta: [{ title: 'Unbound | Addons' }] }),
	validateSearch: pageSearchSchema,
	beforeLoad: ({ context }) => {
		if (!hasPermission(context.user.role, STAFF_SECTIONS.addons.permissions)) {
			throw redirect({ to: '/' });
		}
	},
	loaderDeps: ({ search }) => search,
	loader: ({ deps }) => fetchAddons({ data: deps }),
	component: AddonsPage,
});
