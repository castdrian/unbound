import { IconAlertCircle, IconCircleCheck, IconCircleX, IconInfoCircle } from '@tabler/icons-react';
import { Toaster as Sonner } from 'sonner';
import type { ToasterProps } from 'sonner';

import type { CssVariables } from '~/lib/css-variables';
import Spinner from '~/components/ui/spinner';

const TOASTER_STYLE: CssVariables = {
	'--normal-bg': 'var(--popover)',
	'--normal-text': 'var(--popover-foreground)',
	'--normal-border': 'var(--border)',
	'--border-radius': 'var(--radius)',
};

const TOASTER_ICONS: ToasterProps['icons'] = {
	success: <IconCircleCheck className='size-4' />,
	info: <IconInfoCircle className='size-4' />,
	warning: <IconAlertCircle className='size-4' />,
	error: <IconCircleX className='size-4' />,
	loading: <Spinner className='size-4' />,
};

function Toaster(props: ToasterProps) {
	return (
		<Sonner
			theme='system'
			className='toaster group'
			icons={TOASTER_ICONS}
			style={TOASTER_STYLE}
			{...props}
		/>
	);
}

export default Toaster;
