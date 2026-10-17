import type { Submission, SubmissionStatus } from '@unbound-app/contracts/publish';
import { IconMessage, IconRefresh } from '@tabler/icons-react';
import { useRouter } from '@tanstack/react-router';
import type { ComponentProps } from 'react';
import { useState } from 'react';
import { toast } from 'sonner';

import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from '~/components/ui/dialog';
import SubmitForm from '~/components/submit/submit-form';
import { Button } from '~/components/ui/button';
import Text from '~/components/ui/text';
import Tag from '~/components/tag';

type SubmissionItemProps = {
	submission: Submission;
	githubLinked: boolean;
};

type StatusTag = {
	label: string;
	variant: ComponentProps<typeof Tag>['variant'];
};

const STATUS_TAGS: Record<SubmissionStatus, StatusTag> = {
	awaiting_upload: { label: 'Upload incomplete', variant: 'default' },
	pending_review: { label: 'Pending review', variant: 'primary' },
	changes_requested: { label: 'Changes requested', variant: 'destructive' },
	approved: { label: 'Approved', variant: 'primary' },
	rejected: { label: 'Rejected', variant: 'destructive' },
	superseded: { label: 'Superseded', variant: 'default' },
	expired: { label: 'Expired', variant: 'default' },
	cancelled: { label: 'Cancelled', variant: 'default' },
};

function RepublishDialog({ submission, githubLinked }: SubmissionItemProps) {
	const router = useRouter();
	const [open, setOpen] = useState(false);

	async function handleSubmitted(republished: Submission) {
		setOpen(false);
		toast.success(`Resubmitted ${republished.addonId} ${republished.version} for review`);
		await router.invalidate();
	}

	return (
		<Dialog open={open} onOpenChange={setOpen}>
			<DialogTrigger asChild>
				<Button variant='outline' size='sm'>
					<IconRefresh />
					Republish
				</Button>
			</DialogTrigger>
			<DialogContent className='max-w-xl'>
				<DialogHeader>
					<DialogTitle>Republish {submission.addonId}</DialogTitle>
					<DialogDescription>
						Pick the rebuilt manifest and bundle. The new submission replaces this one
						and goes back into the review queue.
					</DialogDescription>
				</DialogHeader>
				<SubmitForm
					githubLinked={githubLinked}
					addonId={submission.addonId}
					onSubmitted={handleSubmitted}
				/>
			</DialogContent>
		</Dialog>
	);
}

function SubmissionItem({ submission, githubLinked }: SubmissionItemProps) {
	const status = STATUS_TAGS[submission.status];
	const note = submission.review?.note;

	return (
		<div className='flex flex-col gap-2'>
			<div className='flex justify-between items-center gap-4'>
				<div className='flex flex-col gap-1 min-w-0'>
					<div className='flex flex-wrap items-center gap-2'>
						<Text variant='text-sm' className='font-medium truncate'>
							{submission.addonId}
						</Text>
						<Text as='span' variant='text-xs' color='muted' className='font-mono'>
							{submission.version}
						</Text>
						<Tag variant={status.variant}>{status.label}</Tag>
						{submission.unverifiedSource ? <Tag>Unverified source</Tag> : null}
					</div>
					<Text variant='text-xs' color='muted'>
						{submission.kind === 'listing' ? 'New listing' : 'Update'}
						{submission.repository ? ` from ${submission.repository}` : null}
					</Text>
				</div>

				{submission.status === 'changes_requested' ? (
					<RepublishDialog submission={submission} githubLinked={githubLinked} />
				) : null}
			</div>

			{note ? (
				<div className='flex gap-2 bg-muted/50 px-3 py-2 rounded-md'>
					<IconMessage size={16} className='mt-0.5 text-muted-foreground shrink-0' />
					<div className='flex flex-col gap-0.5 min-w-0'>
						<Text variant='text-xs' color='muted' className='font-medium'>
							Reviewer note
						</Text>
						<Text variant='text-sm' className='break-words whitespace-pre-wrap'>
							{note}
						</Text>
					</div>
				</div>
			) : null}
		</div>
	);
}

export default SubmissionItem;
