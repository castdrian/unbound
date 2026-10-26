import { Discord } from '~/api/metro/components';
import { Theme } from '~/api/metro/common';

export default Discord.createStyles({
	container: {
		flexDirection: 'row',
		alignItems: 'flex-start',
		gap: 12,
	},
	iconContainer: {
		width: 40,
		height: 40,
		alignItems: 'center',
		justifyContent: 'center',
		borderRadius: 12,
		backgroundColor: Theme.colors.BACKGROUND_SURFACE_HIGH,
	},
	content: {
		flex: 1,
		gap: 3,
	},
	titleRow: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: 8,
	},
	title: {
		flexShrink: 1,
	},
	versionBadge: {
		paddingHorizontal: 6,
		paddingVertical: 2,
		borderRadius: 6,
		backgroundColor: Theme.colors.BACKGROUND_SURFACE_HIGH,
	},
	description: {
		marginTop: 5,
		lineHeight: 19,
	},
});
