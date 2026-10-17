import { createFileRoute, redirect } from '@tanstack/react-router';

export const Route = createFileRoute('/_site/_staff/admin/')({
	beforeLoad: ({ context }) => {
		const [first] = context.sections.filter((section) => section.id !== 'review');

		throw redirect({ to: first?.to ?? '/' });
	},
});
