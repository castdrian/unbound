import { IconChevronLeft, IconChevronRight } from '@tabler/icons-react';

import { Button } from '~/components/ui/button';
import Text from '~/components/ui/text';

type PagerProps = {
	page: number;
	pageSize: number;
	total: number;
	/** The plural noun the count is shown in, e.g. `users`. */
	noun: string;
	onPageChange: (page: number) => void;
};

function Pager({ page, pageSize, total, noun, onPageChange }: PagerProps) {
	const totalPages = Math.ceil(total / pageSize);

	if (totalPages <= 1) return null;

	return (
		<div className='flex justify-between items-center px-4 py-3 border-t border-border'>
			<Text variant='text-sm' color='muted'>
				Showing {(page - 1) * pageSize + 1} to {Math.min(page * pageSize, total)} of {total}{' '}
				{noun}
			</Text>
			<div className='flex items-center gap-2'>
				<Button
					variant='outline'
					size='sm'
					onClick={() => onPageChange(page - 1)}
					disabled={page <= 1}
				>
					<IconChevronLeft className='size-4' />
					Previous
				</Button>
				<span className='px-2 text-muted-foreground text-sm'>
					Page {page} of {totalPages}
				</span>
				<Button
					variant='outline'
					size='sm'
					onClick={() => onPageChange(page + 1)}
					disabled={page >= totalPages}
				>
					Next
					<IconChevronRight className='size-4' />
				</Button>
			</div>
		</div>
	);
}

export default Pager;
