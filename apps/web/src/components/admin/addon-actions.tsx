import { addonResponseSchema, maintainersResponseSchema } from '@unbound-app/contracts/addons';
import { IconArrowsExchange, IconEye, IconEyeOff } from '@tabler/icons-react';
import type { UserSummary } from '@unbound-app/contracts/account';
import { useRouter } from '@tanstack/react-router';
import { useState, useTransition } from 'react';
import type { FormEvent } from 'react';
import { toast } from 'sonner';

import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from '~/components/ui/dialog';
import { createBrowserClient } from '~/lib/api/browser-client';
import getAuthErrorMessage from '~/lib/auth/error-message';
import getApiErrorMessage from '~/lib/api/error-message';
import ConfirmDialog from '~/components/confirm-dialog';
import type { AdminAddon } from '~/lib/admin-addons';
import UserAvatar from '~/components/user-avatar';
import { Button } from '~/components/ui/button';
import authClient from '~/lib/auth/client';
import Input from '~/components/ui/input';
import Text from '~/components/ui/text';
import cn from '~/lib/cn';

type AddonActionsProps = {
	addon: AdminAddon;
	canDelist: boolean;
	canTransfer: boolean;
};

type AddonActionProps = {
	addon: AdminAddon;
	disabled: boolean;
	run: (action: () => Promise<void>, success: string) => void;
};

const USER_SEARCH_LIMIT = 5;

function DelistDialog({ addon, disabled, run }: AddonActionProps) {
	function delist() {
		run(async () => {
			await createBrowserClient()('POST /api/v1/addons/$id/delist', {
				params: { id: addon.id },
				response: addonResponseSchema,
			});
		}, `Delisted ${addon.id}`);
	}

	return (
		<ConfirmDialog
			trigger={
				<Button variant='destructive' size='sm' disabled={disabled}>
					<IconEyeOff />
					Delist
				</Button>
			}
			title={`Delist ${addon.id}?`}
			description='It disappears from listings and update checks. Its published files stay up, so existing installs keep working. You can relist it later.'
			confirmLabel='Delist Addon'
			onConfirm={delist}
		/>
	);
}

function TransferDialog({ addon, disabled, run }: AddonActionProps) {
	const [open, setOpen] = useState(false);
	const [query, setQuery] = useState('');
	const [results, setResults] = useState<UserSummary[]>([]);
	const [selected, setSelected] = useState<UserSummary | null>(null);
	const [isSearching, startSearch] = useTransition();
	const owners = new Set(addon.owners.map((owner) => owner.id));

	function search(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();

		startSearch(async () => {
			const { data, error } = await authClient.admin.listUsers({
				query: {
					searchValue: query.trim(),
					searchField: 'name',
					searchOperator: 'contains',
					limit: USER_SEARCH_LIMIT,
				},
			});

			if (error) {
				toast.error(getAuthErrorMessage(error));

				return;
			}

			setResults(
				data.users.map((user) => ({
					id: user.id,
					name: user.name,
					image: user.image ?? null,
				})),
			);
		});
	}

	function transfer() {
		if (!selected) return;

		setOpen(false);
		run(async () => {
			await createBrowserClient()('POST /api/v1/addons/$id/transfer', {
				params: { id: addon.id },
				body: { userId: selected.id },
				response: maintainersResponseSchema,
			});
		}, `${selected.name} now owns ${addon.id}`);
	}

	return (
		<Dialog open={open} onOpenChange={setOpen}>
			<DialogTrigger asChild>
				<Button variant='outline' size='sm' disabled={disabled}>
					<IconArrowsExchange />
					Transfer
				</Button>
			</DialogTrigger>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>Transfer {addon.id}</DialogTitle>
					<DialogDescription>
						Pick the new owner. The current owners stay on as maintainers.
					</DialogDescription>
				</DialogHeader>
				<form onSubmit={search} className='flex gap-2'>
					<Input
						value={query}
						onChange={(event) => setQuery(event.target.value)}
						placeholder='Search users by name...'
						aria-label='Search users'
						required
					/>
					<Button type='submit' variant='secondary' disabled={isSearching}>
						Search
					</Button>
				</form>
				<div className='flex flex-col gap-1'>
					{results.map((user) => (
						<button
							key={user.id}
							type='button'
							onClick={() => setSelected(user)}
							disabled={owners.has(user.id)}
							className={cn(
								'flex items-center gap-3 hover:bg-accent/50 disabled:opacity-50 px-3 py-2 rounded-lg text-left transition-colors disabled:pointer-events-none',
								selected?.id === user.id && 'bg-accent',
							)}
						>
							<UserAvatar src={user.image} name={user.name} size='xs' />
							<Text as='span' variant='text-sm' className='flex-1 truncate'>
								{user.name}
							</Text>
							{owners.has(user.id) ? (
								<Text as='span' variant='text-xs' color='muted'>
									Owner
								</Text>
							) : null}
						</button>
					))}
				</div>
				<DialogFooter>
					<Button variant='outline' onClick={() => setOpen(false)} disabled={disabled}>
						Cancel
					</Button>
					<Button onClick={transfer} disabled={disabled || !selected}>
						<IconArrowsExchange />
						Transfer
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}

function AddonActions({ addon, canDelist, canTransfer }: AddonActionsProps) {
	const router = useRouter();
	const [isPending, startTransition] = useTransition();

	function run(action: () => Promise<void>, success: string) {
		startTransition(async () => {
			try {
				await action();
			} catch (error) {
				toast.error(getApiErrorMessage(error));

				return;
			}

			await router.invalidate();
			toast.success(success);
		});
	}

	function relist() {
		run(async () => {
			await createBrowserClient()('POST /api/v1/addons/$id/relist', {
				params: { id: addon.id },
				response: addonResponseSchema,
			});
		}, `Relisted ${addon.id}`);
	}

	return (
		<div className='flex justify-end items-center gap-2'>
			{canTransfer ? <TransferDialog addon={addon} disabled={isPending} run={run} /> : null}
			{canDelist && addon.delistedAt ? (
				<Button variant='secondary' size='sm' onClick={relist} disabled={isPending}>
					<IconEye />
					Relist
				</Button>
			) : null}
			{canDelist && !addon.delistedAt ? (
				<DelistDialog addon={addon} disabled={isPending} run={run} />
			) : null}
		</div>
	);
}

export default AddonActions;
