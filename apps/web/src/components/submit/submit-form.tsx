import type {
	ListRepositoryAddonsResponse,
	PushableRepository,
	RepositoryAddon,
} from '@unbound-app/contracts/source';
import {
	listRepositoryAddonsResponseSchema,
	pushableRepositoriesResponseSchema,
	repositoryInputSchema,
} from '@unbound-app/contracts/source';
import type { CreateSubmissionRequest, Submission } from '@unbound-app/contracts/publish';
import type { SubmissionPreview as Preview } from '@unbound-app/contracts/review';
import { createSubmissionResponseSchema } from '@unbound-app/contracts/publish';
import { submissionPreviewResponseSchema } from '@unbound-app/contracts/review';
import { useEffect, useState, useTransition } from 'react';
import { IconBrandGithub, IconSend } from '@tabler/icons-react';
import { Link } from '@tanstack/react-router';

import type { DetailsDraft } from '~/components/submit/submission-preview';
import SubmissionPreview from '~/components/submit/submission-preview';
import RepositoryPicker from '~/components/submit/repository-picker';
import { createBrowserClient } from '~/lib/api/browser-client';
import AddonPicker from '~/components/submit/addon-picker';
import getApiErrorMessage from '~/lib/api/error-message';
import type { PendingSource } from '~/lib/dashboard';
import { FieldError } from '~/components/ui/field';
import { Button } from '~/components/ui/button';
import Text from '~/components/ui/text';

type SubmitFormProps = {
	githubLinked: boolean;
	/** Restricts the form to this addon, when republishing it. */
	addonId?: string;
	/** Where the addon was submitted from before; its repository is read straight away. */
	initial?: PendingSource;
	onSubmitted: (submission: Submission) => void;
};

type Previewed = {
	request: CreateSubmissionRequest;
	preview: Preview;
};

function toDraft(preview: Preview): DetailsDraft {
	return { homepage: preview.details.homepage ?? '', tags: preview.details.tags.join(', ') };
}

function toOverrides(draft: DetailsDraft): CreateSubmissionRequest['details'] {
	return {
		homepage: draft.homepage.trim() || null,
		tags: draft.tags
			.split(',')
			.map((tag) => tag.trim())
			.filter(Boolean),
	};
}

function SubmitForm({ githubLinked, addonId, initial, onSubmitted }: SubmitFormProps) {
	const [repository, setRepository] = useState(initial?.repository ?? '');
	const [pushable, setPushable] = useState<PushableRepository[]>([]);
	const [listing, setListing] = useState<ListRepositoryAddonsResponse | null>(null);
	const [previewed, setPreviewed] = useState<Previewed | null>(null);
	const [draft, setDraft] = useState<DetailsDraft>({ homepage: '', tags: '' });
	const [error, setError] = useState<string | null>(null);
	const [isPending, startTransition] = useTransition();

	function run(action: () => Promise<void>) {
		setError(null);
		startTransition(async () => {
			try {
				await action();
			} catch (cause) {
				setError(getApiErrorMessage(cause));
			}
		});
	}

	async function fetchListing(repository: string, ref?: string) {
		const found = await createBrowserClient()('GET /api/v1/github/addons', {
			query: { repository, ref },
			response: listRepositoryAddonsResponseSchema,
		});

		setListing(found);
		setPreviewed(null);

		return found;
	}

	async function fetchPreview(from: ListRepositoryAddonsResponse, addon: RepositoryAddon) {
		const request = {
			repository: from.repository,
			path: addon.path,
			ref: from.ref,
			commitSha: from.commitSha,
		};

		const { preview } = await createBrowserClient()('POST /api/v1/submissions/preview', {
			body: request,
			response: submissionPreviewResponseSchema,
		});

		setPreviewed({ request, preview });
		setDraft(toDraft(preview));
	}

	function readRepository(input: string, ref?: string) {
		const parsed = repositoryInputSchema.safeParse(input);

		if (!parsed.success) {
			setError(parsed.error.issues[0]?.message ?? 'Not a GitHub repository.');

			return;
		}

		run(async () => {
			await fetchListing(parsed.data, ref);
		});
	}

	function previewAddon(addon: RepositoryAddon) {
		if (!listing) return;

		run(() => fetchPreview(listing, addon));
	}

	// Republishing reads the same directory again and previews it if it can be submitted as it is.
	function reopen(source: PendingSource) {
		run(async () => {
			const found = await fetchListing(source.repository);
			const addon = found.addons.find((entry) => entry.path === source.path);

			if (addon && addon.issues.length === 0) {
				await fetchPreview(found, addon);
			}
		});
	}

	function submit() {
		if (!previewed) return;

		run(async () => {
			const { submission } = await createBrowserClient()('POST /api/v1/submissions', {
				body: { ...previewed.request, details: toOverrides(draft) },
				response: createSubmissionResponseSchema,
			});

			onSubmitted(submission);
		});
	}

	useEffect(() => {
		if (!githubLinked) return;

		createBrowserClient()('GET /api/v1/github/repositories', {
			response: pushableRepositoriesResponseSchema,
		})
			.then(({ repositories }) => setPushable(repositories.slice(0, 12)))
			.catch(() => setPushable([]));

		if (initial) {
			reopen(initial);
		}
	}, []);

	if (!githubLinked) {
		return (
			<div className='flex flex-col items-start gap-3'>
				<Text variant='text-sm' color='muted'>
					Addons are submitted from a public GitHub repository you can push to. Link your
					GitHub account first.
				</Text>
				<Button asChild variant='outline'>
					<Link to='/account'>
						<IconBrandGithub />
						Link GitHub
					</Link>
				</Button>
			</div>
		);
	}

	return (
		<div className='flex flex-col gap-6'>
			<RepositoryPicker
				value={repository}
				repositories={pushable}
				disabled={isPending}
				onChange={setRepository}
				onPick={(picked) => {
					setRepository(picked);
					readRepository(picked);
				}}
			/>

			{listing ? (
				<AddonPicker
					key={`${listing.repository}@${listing.commitSha}`}
					listing={listing}
					addonId={addonId}
					selected={previewed?.request.path ?? null}
					disabled={isPending}
					onRefChange={(ref) => readRepository(listing.repository, ref)}
					onPick={previewAddon}
				/>
			) : null}

			{previewed ? (
				<SubmissionPreview
					preview={previewed.preview}
					draft={draft}
					disabled={isPending}
					onDraftChange={setDraft}
				/>
			) : null}

			<FieldError className='whitespace-pre-wrap'>{error}</FieldError>

			{previewed ? (
				<Button
					type='button'
					disabled={isPending}
					onClick={submit}
					className='w-full md:w-auto md:self-start'
				>
					<IconSend />
					{isPending ? 'Submitting...' : 'Submit for Review'}
				</Button>
			) : null}
		</div>
	);
}

export default SubmitForm;
