import { View } from 'react-native';

import type { PendingUpdate } from '~/lib/updates';
import { Discord } from '~/api/metro/components';
import { Messages, format } from '~/api/i18n';
import { Page } from '~/ui/components';
import { Icons } from '~/api/assets';

import { kindIcon, shortDate } from './format';
import UpdateButton from './update-button';

type ChangelogProps = {
	entry: PendingUpdate;
};

/** One pending update: the version jump, every skipped version's changelog, and an update button. */
function Changelog({ entry }: ChangelogProps) {
	const navigation = Discord.useNavigation();
	const { update } = entry;

	return (
		<Page>
			<Discord.TableRowGroup>
				<Discord.TableRow
					label={entry.name}
					subLabel={`${entry.from} → ${update.version}`}
					icon={<Discord.TableRowIcon source={kindIcon(entry.kind)} />}
				/>
			</Discord.TableRowGroup>

			<Discord.TableRowGroup title={Messages.UNBOUND_UPDATES_CHANGELOG}>
				{update.changelogs.map((version) => (
					<Discord.TableRow
						key={version.version}
						label={version.version}
						subLabel={version.changelog ?? Messages.UNBOUND_UPDATES_NO_CHANGELOG}
						icon={<Discord.TableRowIcon source={Icons.TagIcon} />}
						trailing={
							<Discord.TableRow.TrailingText text={shortDate(version.publishedAt)} />
						}
					/>
				))}
			</Discord.TableRowGroup>

			<View>
				<UpdateButton
					id={entry.id}
					size='lg'
					grow
					text={format('UNBOUND_UPDATES_UPDATE_TO', { version: update.version })}
					onUpdated={() => navigation.goBack()}
				/>
			</View>
		</Page>
	);
}

export default Changelog;
