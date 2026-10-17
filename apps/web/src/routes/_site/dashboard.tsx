import { Link, createFileRoute, redirect } from '@tanstack/react-router';
import { IconCopy, IconPackage, IconUpload } from '@tabler/icons-react';
import { toast } from 'sonner';

import {
	Empty,
	EmptyContent,
	EmptyDescription,
	EmptyHeader,
	EmptyMedia,
	EmptyTitle,
} from '~/components/ui/empty';
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card';
import SubmissionItem from '~/components/dashboard/submission-item';
import AddonPanel from '~/components/dashboard/addon-panel';
import Separator from '~/components/ui/separator';
import { Button } from '~/components/ui/button';
import { getDashboard } from '~/lib/publishing';
import Input from '~/components/ui/input';
import Text from '~/components/ui/text';

type UserIdCardProps = {
	userId: string;
};

function UserIdCard({ userId }: UserIdCardProps) {
	async function copy() {
		try {
			await navigator.clipboard.writeText(userId);
			toast.success('Copied to clipboard');
		} catch (error) {
			toast.error(`Failed to copy the ID, copy it by hand: ${String(error)}`);
		}
	}

	return (
		<Card className='gap-4'>
			<CardHeader>
				<CardTitle className='text-xl'>Your User ID</CardTitle>
				<Text variant='text-sm' color='muted'>
					Share it with an addon’s owner so they can add you as a maintainer.
				</Text>
			</CardHeader>
			<CardContent className='flex gap-2'>
				<Input readOnly value={userId} aria-label='Your user ID' className='font-mono' />
				<Button variant='outline' onClick={copy}>
					<IconCopy />
					Copy
				</Button>
			</CardContent>
		</Card>
	);
}

function DashboardPage() {
	const { user } = Route.useRouteContext();
	const { addons, openListings, githubLinked } = Route.useLoaderData();

	return (
		<div className='flex flex-col gap-6 md:mx-auto mb-12 px-2 container'>
			<div className='flex flex-wrap justify-between items-end gap-4'>
				<div className='flex flex-col gap-2'>
					<Text variant='heading-lg'>Dashboard</Text>
					<Text variant='text-md' color='muted'>
						Your addons, their submissions in review and their maintainers.
					</Text>
				</div>
				<Button asChild>
					<Link to='/submit'>
						<IconUpload />
						Submit Addon
					</Link>
				</Button>
			</div>

			{addons.length === 0 && openListings.length === 0 ? (
				<Empty className='border'>
					<EmptyHeader>
						<EmptyMedia variant='icon'>
							<IconPackage />
						</EmptyMedia>
						<EmptyTitle>No Addons Yet</EmptyTitle>
						<EmptyDescription>
							Submit your first theme or plugin. It shows up here while it is
							reviewed.
						</EmptyDescription>
					</EmptyHeader>
					<EmptyContent>
						<Button asChild>
							<Link to='/submit'>
								<IconUpload />
								Submit Addon
							</Link>
						</Button>
					</EmptyContent>
				</Empty>
			) : null}

			{openListings.length > 0 ? (
				<Card className='gap-4'>
					<CardHeader>
						<CardTitle className='text-xl'>New Listings in Review</CardTitle>
						<Text variant='text-sm' color='muted'>
							Each one claims its addon ID until it is approved or rejected.
						</Text>
					</CardHeader>
					<CardContent className='flex flex-col gap-3'>
						{openListings.map((submission, index) => (
							<div key={submission.id} className='flex flex-col gap-3'>
								{index > 0 ? <Separator /> : null}
								<SubmissionItem
									submission={submission}
									githubLinked={githubLinked}
								/>
							</div>
						))}
					</CardContent>
				</Card>
			) : null}

			{addons.map((addon) => (
				<AddonPanel
					key={addon.id}
					addon={addon}
					userId={user.id}
					githubLinked={githubLinked}
				/>
			))}

			<UserIdCard userId={user.id} />
		</div>
	);
}

export const Route = createFileRoute('/_site/dashboard')({
	head: () => ({ meta: [{ title: 'Unbound | Dashboard' }] }),
	beforeLoad: ({ context }) => {
		if (!context.session) {
			throw redirect({ to: '/login' });
		}

		return { user: context.session.user };
	},
	loader: () => getDashboard(),
	component: DashboardPage,
});
