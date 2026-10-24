import registerAppSurface from '@unbound-plugins/shared/native/app-surface';
import { View, type LayoutChangeEvent } from 'react-native';

import { EmbeddedMediaContext } from '~/components/embedded-media';
import type { Message, Renderers, RowGenerator } from '~/modules';
import { Surface } from '~/constants';

export type SurfaceContent = {
	record: Message;
	generator: RowGenerator;
	width: number;
};

export type SurfaceSource = {
	renderers: Pick<Renderers, 'ChatItem'>;
	surface(surfaceId: string): SurfaceContent | undefined;
	reportLayout(surfaceId: string, height: number): void;
};

type MessageSurfaceProps = {
	surfaceId: string;
	renderRevision: number;
};

/**
 * @description Registers the root component that Fabric surfaces mount to render embeds.
 * @param source Looks up each surface's content and receives the height it lays out at.
 * @returns The registered module name to mount, or `undefined` when React Native refused it.
 */
export function registerMessageSurface(source: SurfaceSource): string | undefined {
	function MessageSurface({ renderRevision, surfaceId }: MessageSurfaceProps) {
		const surface = source.surface(surfaceId);
		const { ChatItem } = source.renderers;

		if (!surface) return <View style={{ height: 1 }} />;

		function onLayout(event: LayoutChangeEvent) {
			source.reportLayout(surfaceId, event.nativeEvent.layout.height);
		}

		return (
			<EmbeddedMediaContext.Provider value>
				<View
					onLayout={onLayout}
					style={{
						backgroundColor: Surface.background,
						borderRadius: 8,
						overflow: 'hidden',
						minHeight: Surface.minHeight,
						paddingBottom: 0,
						paddingTop: 6,
						width: surface.width,
					}}
				>
					<ChatItem
						key={surfaceId}
						message={surface.record}
						renderRevision={renderRevision}
						rowGenerator={surface.generator}
					/>
				</View>
			</EmbeddedMediaContext.Provider>
		);
	}

	return registerAppSurface('MessageLinkEmbedSurface', MessageSurface);
}
