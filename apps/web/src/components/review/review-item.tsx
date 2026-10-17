import { IconAlertTriangle, IconDownload, IconLock } from '@tabler/icons-react';

import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '~/components/ui/card';
import ReviewDecisionDialog from '~/components/review/review-decision-dialog';
import ManifestDiffTable from '~/components/review/manifest-diff-table';
import type { ReviewEntry } from '~/lib/review-entry';
import GitHubIcon from '~/components/icons/github';
import { Button } from '~/components/ui/button';
import Avatar from '~/components/ui/avatar';
import Text from '~/components/ui/text';

type ReviewItemProps = {
	entry: ReviewEntry;
};

// Fixed to UTC so the server render and the hydrated page print the same time.
const DATE_FORMAT = new Intl.DateTimeFormat('en-US', {
	dateStyle: 'medium',
	timeStyle: 'short',
	timeZone: 'UTC',
});

const BADGE_CLASS = 'px-1.5 py-0.5 rounded font-medium text-[10px] uppercase shrink-0';

function ReviewItem({ entry }: ReviewItemProps) {
	const { submission, submitter } = entry;

	return (
		<Card className='gap-4'>
			<CardHeader className='flex flex-row items-start gap-3'>
				<Avatar
					src={submitter.image}
					fallback={submitter.name.at(0)?.toUpperCase() ?? '?'}
					size='md'
				/>
				<div className='flex flex-col flex-1 gap-1 min-w-0'>
					<div className='flex flex-wrap items-center gap-2'>
						<CardTitle className='truncate'>{entry.name}</CardTitle>
						<Text as='span' variant='text-sm' color='muted'>
							{submission.addonId} {submission.version}
						</Text>
						<span className={`${BADGE_CLASS} bg-muted text-muted-foreground`}>
							{submission.kind === 'listing' ? 'New listing' : 'Update'}
						</span>
						{submission.unverifiedSource ? (
							<span
								className={`${BADGE_CLASS} inline-flex items-center gap-1 bg-amber-500/15 text-amber-600 dark:text-amber-400`}
							>
								<IconAlertTriangle size={12} />
								Unverified source
							</span>
						) : null}
					</div>
					<Text variant='text-xs' color='muted'>
						Submitted by {submitter.name} on{' '}
						{DATE_FORMAT.format(new Date(entry.submittedAt))} UTC
					</Text>
				</div>
			</CardHeader>

			<CardContent className='flex flex-col gap-4'>
				<ManifestDiffTable entry={entry} />

				{entry.changelog ? (
					<div className='flex flex-col gap-1'>
						<Text variant='text-xs' color='muted'>
							Changelog
						</Text>
						<Text variant='text-sm' className='whitespace-pre-wrap'>
							{entry.changelog}
						</Text>
					</div>
				) : null}

				<div className='flex flex-wrap gap-2'>
					<Button asChild variant='outline' size='sm'>
						<a href={entry.artifact.url} target='_blank' rel='noopener noreferrer'>
							<IconDownload />
							Download staged bundle
						</a>
					</Button>
					{submission.repository ? (
						<Button asChild variant='outline' size='sm'>
							<a
								href={`https://github.com/${submission.repository}`}
								target='_blank'
								rel='noopener noreferrer'
							>
								<GitHubIcon />
								{submission.repository}
							</a>
						</Button>
					) : null}
				</div>
			</CardContent>

			<CardFooter className='flex flex-wrap justify-end gap-2'>
				{entry.selfReview ? (
					<Text
						variant='text-sm'
						color='muted'
						className='inline-flex items-center gap-2 mr-auto'
					>
						<IconLock size={16} />
						You maintain this addon, so another reviewer has to decide.
					</Text>
				) : (
					<>
						<ReviewDecisionDialog entry={entry} decision='changes_requested' />
						<ReviewDecisionDialog entry={entry} decision='rejected' />
						<ReviewDecisionDialog entry={entry} decision='approved' />
					</>
				)}
			</CardFooter>
		</Card>
	);
}

export default ReviewItem;
