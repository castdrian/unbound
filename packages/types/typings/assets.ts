/** An asset registered with Discord's packager (its metadata and dimensions). */
export type DiscordAsset = {
	__packager_asset?: boolean;
	name: string;
	httpServerLocation: string;
	width: number;
	height: number;
	scales: number[];
	hash: string;
	type: string;
};

/** A {@link DiscordAsset} extended with Unbound's icon-pack overrides. */
export type UnboundAsset = DiscordAsset & {
	iconPackPath?: string;
	iconPackScale?: number;
};

/** The native module used to register and resolve {@link DiscordAsset}s by id. */
export type AssetsModule = {
	registerAsset: (asset: DiscordAsset) => number;
	getAssetByID: (id: number) => DiscordAsset | null;
};
