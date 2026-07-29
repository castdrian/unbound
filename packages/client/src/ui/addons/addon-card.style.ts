import { Discord } from '~/api/metro/components';

export default Discord.createStyles({
	card: {
		gap: 14,
		padding: 16,
	},
	row: {
		flexDirection: 'row',
	},
	body: {
		flex: 1,
	},
	footer: {
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'space-between',
		minHeight: 32,
	},
	actions: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: 4,
	},
	failed: {
		opacity: 0.5,
	},
	error: {
		marginTop: 4,
	},
});
