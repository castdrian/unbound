import { createFileRoute, redirect, useNavigate } from '@tanstack/react-router';
import { getRequestHeaders } from '@tanstack/react-start/server';
import { IconBan, IconUserCheck } from '@tabler/icons-react';
import { createServerFn } from '@tanstack/react-start';

import { pageSearchSchema, toPageSearch } from '~/lib/page-search';
import UserActions from '~/components/admin/user-actions';
import SearchForm from '~/components/admin/search-form';
import { STAFF_SECTIONS } from '~/lib/auth/staff-areas';
import { listAdminUsers } from '~/lib/admin-users';
import { hasPermission } from '~/lib/auth/access';
import Pager from '~/components/admin/pager';
import Avatar from '~/components/ui/avatar';
import Text from '~/components/ui/text';
import app from '~/lib/app';

// Fixed to UTC so the server render and the hydrated page print the same day.
const DATE_FORMAT = new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeZone: 'UTC' });

const HEADER_CLASS = 'px-4 py-3 font-medium text-muted-foreground text-sm text-left';

const fetchUsers = createServerFn({ method: 'GET' })
	.validator(pageSearchSchema)
	.handler(({ data }) =>
		listAdminUsers(app, getRequestHeaders(), {
			search: data.search ?? '',
			page: data.page ?? 1,
		}),
	);

function UsersPage() {
	const { user: viewer } = Route.useRouteContext();
	const { users, total, pageSize } = Route.useLoaderData();
	const params = Route.useSearch();
	const navigate = useNavigate({ from: Route.fullPath });
	const search = params.search ?? '';
	const page = params.page ?? 1;
	const canSetRole = hasPermission(viewer.role, { user: ['set-role'] });
	const canBan = hasPermission(viewer.role, { user: ['ban'] });

	return (
		<div className='flex flex-col gap-6'>
			<div className='flex flex-col gap-2'>
				<Text variant='heading-lg'>Users</Text>
				<Text variant='text-md' color='muted'>
					Search users, change their roles and ban or unban them.
				</Text>
			</div>

			<SearchForm
				key={search}
				search={search}
				placeholder='Search by name...'
				onSearch={(value) => navigate({ search: toPageSearch(value, 1) })}
			/>

			<div className='bg-card border border-border rounded-lg overflow-hidden'>
				<div className='overflow-x-auto'>
					<table className='w-full'>
						<thead className='bg-muted/50 border-b border-border'>
							<tr>
								<th className={HEADER_CLASS}>User</th>
								<th className={HEADER_CLASS}>Email</th>
								<th className={HEADER_CLASS}>Role</th>
								<th className={HEADER_CLASS}>Status</th>
								<th className={HEADER_CLASS}>Joined</th>
								<th className={HEADER_CLASS}>
									<span className='sr-only'>Actions</span>
								</th>
							</tr>
						</thead>
						<tbody className='divide-y divide-border'>
							{users.length === 0 ? (
								<tr>
									<td
										colSpan={6}
										className='px-4 py-8 text-muted-foreground text-center'
									>
										No users found.
									</td>
								</tr>
							) : (
								users.map((user) => (
									<tr key={user.id} className='hover:bg-muted/30'>
										<td className='px-4 py-3'>
											<div className='flex items-center gap-3'>
												<Avatar
													src={user.image}
													fallback={user.name.at(0)?.toUpperCase() ?? '?'}
													size='sm'
												/>
												<span className='max-w-[150px] font-medium truncate'>
													{user.name}
												</span>
											</div>
										</td>
										<td className='px-4 py-3 text-muted-foreground text-sm'>
											<span className='block max-w-[200px] truncate'>
												{user.email}
											</span>
										</td>
										<td className='px-4 py-3'>
											<span className='bg-muted px-2 py-0.5 rounded font-medium text-xs capitalize'>
												{user.role}
											</span>
										</td>
										<td className='px-4 py-3'>
											{user.banned ? (
												<span
													className='inline-flex items-center gap-1 text-destructive text-sm'
													title={user.banReason ?? undefined}
												>
													<IconBan className='size-4' />
													Banned
												</span>
											) : (
												<span className='inline-flex items-center gap-1 text-green-600 dark:text-green-500 text-sm'>
													<IconUserCheck className='size-4' />
													Active
												</span>
											)}
										</td>
										<td className='px-4 py-3 text-muted-foreground text-sm whitespace-nowrap'>
											{DATE_FORMAT.format(user.createdAt)}
										</td>
										<td className='px-4 py-3 whitespace-nowrap'>
											<UserActions
												user={user}
												canSetRole={canSetRole}
												canBan={canBan}
												isSelf={user.id === viewer.id}
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
					noun='users'
					onPageChange={(next) => navigate({ search: toPageSearch(search, next) })}
				/>
			</div>
		</div>
	);
}

export const Route = createFileRoute('/_site/_staff/admin/users')({
	head: () => ({ meta: [{ title: 'Unbound | Users' }] }),
	validateSearch: pageSearchSchema,
	beforeLoad: ({ context }) => {
		if (!hasPermission(context.user.role, STAFF_SECTIONS.users.permissions)) {
			throw redirect({ to: '/' });
		}
	},
	loaderDeps: ({ search }) => search,
	loader: ({ deps }) => fetchUsers({ data: deps }),
	component: UsersPage,
});
