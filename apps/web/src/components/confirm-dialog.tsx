import type { ReactNode } from 'react';

import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
	AlertDialogTrigger,
} from '~/components/ui/alert-dialog';
import { buttonVariants } from '~/components/ui/button';

type ConfirmDialogProps = {
	/** The button that opens the dialog. */
	trigger: ReactNode;
	title: string;
	description: string;
	confirmLabel: string;
	onConfirm: () => void;
	/** Extra inputs shown between the description and the buttons. */
	children?: ReactNode;
};

function ConfirmDialog({
	trigger,
	title,
	description,
	confirmLabel,
	onConfirm,
	children,
}: ConfirmDialogProps) {
	return (
		<AlertDialog>
			<AlertDialogTrigger asChild>{trigger}</AlertDialogTrigger>
			<AlertDialogContent>
				<AlertDialogHeader>
					<AlertDialogTitle>{title}</AlertDialogTitle>
					<AlertDialogDescription>{description}</AlertDialogDescription>
				</AlertDialogHeader>
				{children}
				<AlertDialogFooter>
					<AlertDialogCancel>Cancel</AlertDialogCancel>
					<AlertDialogAction
						className={buttonVariants({ variant: 'destructive' })}
						onClick={onConfirm}
					>
						{confirmLabel}
					</AlertDialogAction>
				</AlertDialogFooter>
			</AlertDialogContent>
		</AlertDialog>
	);
}

export default ConfirmDialog;
