import { IconUpload } from '@tabler/icons-react';
import { Link } from '@tanstack/react-router';

import {
	Card,
	CardAction,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from '~/components/ui/card';
import MaintainersDialog from '~/components/dashboard/maintainers-dialog';
import SubmissionItem from '~/components/dashboard/submission-item';
import type { DashboardAddon } from '~/lib/publishing';
import RoleTag from '~/components/dashboard/role-tag';
import Separator from '~/components/ui/separator';
import { Button } from '~/components/ui/button';
import Text from '~/components/ui/text';
import Tag from '~/components/tag';

type AddonPanelProps = {
	addon: DashboardAddon;
	userId: string;
	githubLinked: boolean;
};

// Fixed to UTC so the server render and the hydrated page print the same day.
const DATE_FORMAT = new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeZone: 'UTC' });

function describeLatest(addon: DashboardAddon): string {
	const latest = addon.latestVersion;

	if (!latest) {
		return 'No published version yet';
	}

	return `Latest ${latest.version}, published ${DATE_FORMAT.format(new Date(latest.publishedAt))}`;
}

function AddonPanel({ addon, userId, githubLinked }: AddonPanelProps) {
	return (
		<Card className='gap-4'>
			<CardHeader>
				<div className='flex flex-wrap items-center gap-2'>
					<CardTitle className='text-xl'>
						{addon.latestVersion?.name ?? addon.id}
					</CardTitle>
					<RoleTag role={addon.role} />
					{addon.delistedAt ? <Tag variant='destructive'>Delisted</Tag> : null}
				</div>
				<CardDescription>
					<span className='font-mono'>{addon.id}</span> · {describeLatest(addon)}
				</CardDescription>
				<CardAction className='flex gap-2'>
					{addon.role === 'owner' ? (
						<MaintainersDialog addonId={addon.id} userId={userId} />
					) : null}
					<Button asChild size='sm'>
						<Link to='/submit'>
							<IconUpload />
							Submit Update
						</Link>
					</Button>
				</CardAction>
			</CardHeader>
			<CardContent className='flex flex-col gap-3'>
				{addon.openSubmissions.length === 0 ? (
					<Text variant='text-sm' color='muted'>
						No updates in review.
					</Text>
				) : (
					addon.openSubmissions.map((submission, index) => (
						<div key={submission.id} className='flex flex-col gap-3'>
							{index > 0 ? <Separator /> : null}
							<SubmissionItem submission={submission} githubLinked={githubLinked} />
						</div>
					))
				)}
			</CardContent>
		</Card>
	);
}

export default AddonPanel;
