# Rebrand Inventory

Audited: 2026-07-27

This is the source-of-truth checklist for replacing the current Unbound identity after a final name is chosen. The scan covered every direct project under `/Users/adrian/Developer`, Git remotes for every local repository, hidden tracked/configuration files, and filename/path matches. Dependency trees, virtual environments, build products, caches, and `.git` history are intentionally excluded from replacement work.

## Replacement tokens

| Current value | Planned replacement | Notes |
| --- | --- | --- |
| `Unbound` | `<NEW_NAME>` | Display name, documentation, UI copy, package titles, app names, and release names. |
| `unbound` | `<new-slug>` | Repository names, local directories, URL paths, filenames, commands, and JSON keys only after compatibility review. |
| `@unbound-app/*` | `@<new-scope>/*` | Published package migration; do not silently break addon imports. |
| `unbound-app` | `<new-github-org>` | GitHub organization and references to it. |
| `unbound.rip` | `<new-domain>` | Web, assets, repo, and 1Password URLs. |
| `app.unbound.*` | `<new-app-identifier>` | Package identifiers, logging subsystems, and URL names. Treat as a migration decision. |

## Rules for the implementation pass

- Update user-facing branding, project documentation, build metadata, domains, asset names, repository names, and package scope.
- Audit public API names, runtime globals, settings keys, CLI names, URL schemes, package identifiers, app-data directories, and log subsystems individually. They may need backwards-compatible aliases, data migration, or a deliberate breaking-change release.
- Regenerate lockfiles and build products after the source/configuration rename. Do not edit compiled `.deb`, `.dylib`, `.ipa`, `.theos`, `dist`, `build`, cache, `venv`, `.venv`, `node_modules`, or `.git` contents by hand.
- Preserve historical names where they identify prior releases, migration paths, changelog entries, or compatibility keys.

## Remote repository names

| Local project | Current remote | Current GitHub description | Required external action |
| --- | --- | --- | --- |
| `unbound` | `marioparaschiv/unbound` | “📱 Cross-platform mobile Discord client modification focused on control, stability, and customisation.” | Rename the repository slug and update the local directory, Git remote, docs, release links, package metadata, and description. |
| `unbound-plugins` | `castdrian/unbound-plugins` | Empty | Rename the repository slug and update the local directory, Git remote, scaffold templates, and addon docs. Add a description during the rename. |
| `loader-ios` | `unbound-app/loader-ios` | “🍎 Theos tweak that bridges Unbound into Discord's native layer to power addon management on iOS.” | Rename or transfer the GitHub organization, then update all workflow, documentation, package-source URLs, and description. |
| `vbound` | `unbound-app/vbound` | “📱 Virtual phone companion app that streamlines Unbound development.” | Rename or transfer the GitHub organization, then update release-updater URLs, documentation, and description. |
| `patcher-ios` | `unbound-app/patcher-ios` | “🩹 Patches the Discord IPA with icons, utilities and features to ease usability.” | Rename or transfer the GitHub organization, then update the loader workflow and module references. Review the description for product-context wording. |
| `dkrypt` | `unbound-app/dkrypt` | “ipa decryption service and api” | Rename or transfer the GitHub organization, then update watcher/repository references. Review the description for ecosystem context. |
| `autosupport` | `unbound-app/autosupport` | “💡 Discord bot providing automated support for Unbound using OpenAI and a vectorized knowledge base.” | Rename or transfer the GitHub organization, then update package metadata, deployment configuration, and description. |
| `autoinstall` | `unbound-app/autoinstall` | Not resolvable through the current GitHub authentication/session | Confirm the repository's current GitHub location before the organization rename, then update its description and historical handoff references as appropriate. |

The remaining repository remotes do not contain the current brand name. GitHub does not rewrite repository descriptions when a repository or organization is renamed, so each description needs an explicit edit after the final name is selected.

## Brand-bearing project inventory

| Project | Scope found | Replacement plan |
| --- | --- | --- |
| `unbound` | 156 files, 624 text matches; repository and directory name; `packages/client/src/ui/icons/unbound.tsx`; `packages/cli/templates/repository/unbound.config.json`. | Core rebrand. Replace display copy, documentation, domains, package scope, scaffold templates, and icon filenames. Review each lower-case runtime/API identifier before changing it. Regenerate `bun.lock` after package rename work. |
| `unbound-plugins` | 70 files, 184 text matches; repository and directory name; root `unbound.config.json`; all plugin manifests, package files, rollup configs, and source imports. | Rename workspace/repository/configuration file and migrate `@unbound-app/*` imports. Keep a compatibility path for existing addon workspaces or publish a migration tool. Regenerate `bun.lock`. |
| `loader-ios` | 50 source/configuration files, 276 text matches; filenames including `Unbound.plist`, `Unbound.h`, `Unbound.xm`, `UnboundNative.*`, `UnboundResources`, `UnboundIcon*`, and `depictions/unbound.json`. | Rename display metadata, Theos bundle/tweak names, package ID, URL scheme, domains, assets, native symbols, file paths, updater/build artifacts, APT depiction paths, and GitHub workflow references. Decide which native symbols and app-data paths retain a compatibility alias. |
| `vbound` | 15 files, 89 text matches; `Assets.xcassets/Unbound.symbolset/Unbound.svg`; settings names such as `unboundPath`; log-tab and log-subsystem handling. | Rebrand display/UI/assets and update GitHub release URLs. Keep or migrate persisted `@AppStorage` keys, build-path preferences, and log filtering around `app.unbound`. |
| `agent-skills` | 6 files, 57 text matches; `agent-skills/unbound/` directory and all project architecture references. | Rename the skill directory and skill name only after its consumers are migrated. Update all workspace paths, package names, domain links, CLI/global examples, and loader/vbound references. |
| `autosupport` | 7 files, 15 text matches; deployment URLs, secret names, package repository URL, support prompt, and `UnboundNative` support item. | Rebrand deployment and support data. Preserve the historical Enmity → Unbound → `<NEW_NAME>` lineage in `src/data.toml`; see the dedicated instruction below. |
| `autoinstall` | `README.md` and `HANDOFF.md`, 4 matches. | Update current organization/repository links. Keep dated historical rename notes unless the document is intentionally rewritten. |
| `dkrypt` | `.env.example` and `README.md`, 5 matches. | Update the loader repository watcher and organization/repository references. Coordinate the environment variable rename with deployment secrets. |
| `patcher-ios` | `go.mod`, `patcher.go`, and `scripts/compile-icon.sh`, 17 matches; `assets/icons/UnboundIcon*.png` filenames. | Rebrand Go module path, app display name, alternate-icon keys/files, URL scheme, domain, and icon archive references. The duplicate `loader-ios/patcher-ios` copy must stay synchronized or be removed in favor of one source. |
| `translation-api` | `docker-compose.yml`, `onePasswordSecrets.ts`, and its test, 5 matches. | Update 1Password host/vault naming and deployment secrets only after the corresponding external resources are renamed or aliased. |
| `RNiOSNewArchTweak` | Filename/path `BridgelessApp/ios/NativeUnboundModule`. | Manual review before rename. This is a path-only match and may be a generic/native-module experiment rather than the product brand. |

## Core monorepo detail: `unbound`

| Area | Matching files and replacement type |
| --- | --- |
| Root metadata | `.oxlintrc.json`, `.vscode/tasks.json`, `AGENTS.md`, `CLAUDE.md`, `DESIGN.md`, `README.md`, `package.json`, `bun.lock`, and `scripts/publish-package.ts`. Replace project copy, URLs, scope, scripts, and publishing references; regenerate the lockfile. |
| SDK generator | `apps/sdk-generator/package.json`, every file under `apps/sdk-generator/src/`, and `apps/sdk-generator/tests/`. Update generated package/import/path/output names and their tests together. |
| Documentation | `docs/docs.json` plus all matching pages under `docs/addons/`, `docs/icon-packs/`, `docs/loader/`, `docs/modules/`, `docs/plugins/`, `docs/themes/`, `docs/overview.mdx`, and `docs/roadmap.mdx`. Replace display copy, links, install commands, package scope, URLs, and path examples. |
| Localization | `i18n/en-US.json` contains 50 matches. Update visible product wording, leaving any migration-specific historical wording explicit. |
| CLI | `packages/cli/package.json`, `src/adapters/`, `src/commands/`, `src/lib/`, `src/registry.ts`, `tsdown.config.ts`, and every matching repository/plugin template. Update command output, generated config/import/package names, environment paths, and create-project templates in one release. |
| Client runtime | `packages/client/package.json`, scripts, `src/api/`, `src/builtins/`, `src/lib/`, `src/managers/`, `src/stores/`, `src/ui/`, `tsconfig*.json`, and `src/ui/icons/unbound.tsx`. Separate display-name changes from global/object/settings/cache/storage/URL names; migrate persisted values before removal. |
| Public packages | Matching `package.json`, declarations, and source in `packages/api`, `debugger`, `debugger-protocol`, `logger`, `plugin-test`, `types`, and `utils`. Package scope and generated API imports are externally consumed; publish aliases or document a breaking migration. |

## Loader and companion-app detail

| Project | Files/areas requiring an explicit decision |
| --- | --- |
| `loader-ios` | `Makefile`, `control`, `app-repo.json`, `build-local.sh`, `.github/workflows/build.yml`, `.github/workflows/ci.yml`, `.gitmodules`, `README.md`, all matching `headers/` and `sources/`, `apt-repo/repo/assets/repo/repo.conf`, `apt-repo/repo/depictions/unbound.json`, `apt-repo/repo/depictions/web/app.unbound.ios/info.xml`, `apt-repo/repo/index.html`, `apt-repo/repo/repo.xml`, `apt-repo/repo/sileo-featured.json`, and the embedded `patcher-ios/` copy. |
| `vbound` | `AGENTS.md`, `CLAUDE.md`, `CHANGELOG.md`, `README.md`, all matching `vbound/*.swift` files, `vbound/releases.mock.json`, and the `Unbound.symbolset` asset folder/file. |
| `patcher-ios` | `go.mod`, `patcher.go`, `scripts/compile-icon.sh`, and the `assets/icons/UnboundIcon60x60@2x.png` and `assets/icons/UnboundIcon76x76@2x~ipad.png` files. |

## Addon workspace detail: `unbound-plugins`

| Area | Replacement plan |
| --- | --- |
| Workspace metadata | `.claude/settings.local.json`, `.mcp.json`, `HANDOFF.md`, `PLUGIN-CANDIDATES.md`, `README.md`, `package.json`, `bun.lock`, `unbound.config.json`, and `plugins/README.md`. Update names, local paths, source links, workspace configuration, and imports. |
| Every plugin | Matching `manifest.json`, `package.json`, `rollup.config.mjs`, and `src/**/*` files in `aussie-mode`, `clear-urls`, `expression-tools`, `force-owner-crown`, `more-user-tags`, `no-blocked-messages`, `no-reply-mention`, `preview-message`, `reviewdb`, `show-me-your-name`, `translate`, and `typing-avatars`. Update SDK imports/package names and generated plugin metadata consistently. |

## Autosupport historical-lineage requirement

`autosupport/src/data.toml` must not receive a flat global substitution. Its instructions currently describe the first rebrand from Enmity to Unbound. After the new name is selected, the background section must explicitly say:

> Enmity was rebranded as Unbound, and Unbound was subsequently rebranded as `<NEW_NAME>`.

Keep this history available to the support model so it can correctly answer questions about both prior names. Update the surrounding support scope from Unbound to `<NEW_NAME>`, while retaining the historical statement and any version-specific Enmity facts.

## Incidental matches that must not be rebranded

| Project | Match | Reason |
| --- | --- | --- |
| `CoreDex` | `hoopaunbound` in `CoreDex/GraphQL/schema.graphqls` | Pokémon form identifier, unrelated. |
| `kdapi` | “Unbound” in `data/idols.json` | Song title in externally sourced idol data, unrelated. |
| `mw-native` | `@typescript-eslint/unbound-method` in `tooling/eslint/react.js` | Third-party lint-rule name, unrelated. |
| `loader-ios` | “unbounded execution” in `headers/jsi/jsi.h` | Generic React Native/JSI documentation text, unrelated. |

## Generated, cached, and historical material excluded from direct replacement

- `loader-ios/.theos/**`, `loader-ios/packages/**`, and its duplicate built symbols are build outputs. Rebuild them after the source rename.
- Python virtual environments under `Chronos`, `YSRUDFFS`, `loader-ios`, and `python` contain third-party incidental matches only.
- `kdapi/cache/**` is cached external data. Refresh it rather than editing it.
- Git history and GitHub redirects are historical records, not source replacements.

## Projects with no brand-bearing source or filename matches

`AudibleHeaders`, `AudioYoink`, `Chronos`, `CovertInstrument`, `DiscordSocialKit`, `Feather`, `Gonerino`, `MGDeviceInfo`, `MuffinStore`, `NowPlayingKit`, `NowPlayingTest`, `ObjectivePGP`, `OpenInDiscord`, `Previews Screenshots`, `ShareToDiscord`, `TrackDuel`, `TubeTweaks`, `Vencord`, `YSRUDFFS`, `adp`, `apt-repo`, `codemon`, `dimctl`, `dipa-auto`, `discord-plugins`, `images`, `irpc`, `ishare`, `kdapi` source aside from the excluded data match, `mw-native` source aside from the excluded lint rule, `python`, `sbslaunch`, `showdown`, `showdown-discord`, `sv-sprites`, and `ytlite-noauth`.

## Per-file text match manifest

This appendix is the complete, file-level text-match list behind the grouped inventory. Counts are case-insensitive occurrences of `unbound`. It intentionally retains historical entries in this inventory and excludes generated/cache/dependency/Git material as described above.

| File | Matches |
| --- | --- |
+| `unbound/.oxlintrc.json` | 1 |
| `unbound/.vscode/tasks.json` | 1 |
| `unbound/AGENTS.md` | 5 |
| `unbound/CLAUDE.md` | 5 |
| `unbound/DESIGN.md` | 5 |
| `unbound/README.md` | 17 |
| `unbound/apps/sdk-generator/package.json` | 2 |
| `unbound/apps/sdk-generator/src/bundle.ts` | 7 |
| `unbound/apps/sdk-generator/src/emit.ts` | 7 |
| `unbound/apps/sdk-generator/src/index.ts` | 1 |
| `unbound/apps/sdk-generator/src/ownership.ts` | 3 |
| `unbound/apps/sdk-generator/src/paths.ts` | 5 |
| `unbound/apps/sdk-generator/src/transform.ts` | 1 |
| `unbound/apps/sdk-generator/tests/bundle.test.ts` | 4 |
| `unbound/apps/sdk-generator/tests/ownership.test.ts` | 4 |
| `unbound/bun.lock` | 41 |
| `unbound/docs/addons/creating.mdx` | 7 |
| `unbound/docs/addons/introduction.mdx` | 3 |
| `unbound/docs/addons/manifest.mdx` | 4 |
| `unbound/docs/docs.json` | 6 |
| `unbound/docs/icon-packs/introduction.mdx` | 2 |
| `unbound/docs/loader/configuration.mdx` | 5 |
| `unbound/docs/loader/introduction.mdx` | 2 |
| `unbound/docs/loader/ios.mdx` | 1 |
| `unbound/docs/loader/local-build.mdx` | 3 |
| `unbound/docs/modules/assets.mdx` | 2 |
| `unbound/docs/modules/fs.mdx` | 4 |
| `unbound/docs/modules/i18n.mdx` | 4 |
| `unbound/docs/modules/introduction.mdx` | 5 |
| `unbound/docs/modules/managers.mdx` | 3 |
| `unbound/docs/modules/metro.mdx` | 5 |
| `unbound/docs/modules/native.mdx` | 7 |
| `unbound/docs/modules/storage.mdx` | 5 |
| `unbound/docs/modules/toasts.mdx` | 2 |
| `unbound/docs/overview.mdx` | 5 |
| `unbound/docs/plugins/flux.mdx` | 2 |
| `unbound/docs/plugins/introduction.mdx` | 5 |
| `unbound/docs/plugins/patching.mdx` | 6 |
| `unbound/docs/plugins/react-patching.mdx` | 1 |
| `unbound/docs/roadmap.mdx` | 2 |
| `unbound/docs/themes/introduction.mdx` | 2 |
| `unbound/i18n/en-US.json` | 50 |
| `unbound/package.json` | 1 |
| `unbound/packages/api/package.json` | 4 |
| `unbound/packages/api/sdk.config.ts` | 3 |
| `unbound/packages/api/src/_internal.d.ts` | 4 |
| `unbound/packages/api/src/assets.d.ts` | 13 |
| `unbound/packages/api/src/global.d.ts` | 7 |
| `unbound/packages/api/src/i18n.d.ts` | 1 |
| `unbound/packages/api/src/native.d.ts` | 3 |
| `unbound/packages/cli/package.json` | 4 |
| `unbound/packages/cli/src/adapters/cleye.ts` | 1 |
| `unbound/packages/cli/src/adapters/mcp.ts` | 1 |
| `unbound/packages/cli/src/commands/build.ts` | 1 |
| `unbound/packages/cli/src/commands/create.ts` | 2 |
| `unbound/packages/cli/src/commands/dev.ts` | 1 |
| `unbound/packages/cli/src/commands/eval.ts` | 4 |
| `unbound/packages/cli/src/commands/mcp.ts` | 1 |
| `unbound/packages/cli/src/lib/config.ts` | 6 |
| `unbound/packages/cli/src/lib/context.ts` | 3 |
| `unbound/packages/cli/src/lib/create-prompts.ts` | 2 |
| `unbound/packages/cli/src/lib/format.ts` | 1 |
| `unbound/packages/cli/src/lib/menu.ts` | 1 |
| `unbound/packages/cli/src/lib/templates.ts` | 1 |
| `unbound/packages/cli/src/registry.ts` | 1 |
| `unbound/packages/cli/templates/plugin/index.tsx` | 1 |
| `unbound/packages/cli/templates/plugin/package.json` | 1 |
| `unbound/packages/cli/templates/plugin/rollup.config.mjs` | 4 |
| `unbound/packages/cli/templates/repository/README.md` | 4 |
| `unbound/packages/cli/templates/repository/package.json` | 1 |
| `unbound/packages/cli/templates/repository/unbound.config.json` | 1 |
| `unbound/packages/cli/tsdown.config.ts` | 1 |
| `unbound/packages/client/package.json` | 5 |
| `unbound/packages/client/scripts/dev/index.ts` | 3 |
| `unbound/packages/client/scripts/dev/package.json` | 2 |
| `unbound/packages/client/scripts/serve/constants.ts` | 1 |
| `unbound/packages/client/scripts/serve/hot-reload.ts` | 1 |
| `unbound/packages/client/scripts/serve/index.ts` | 1 |
| `unbound/packages/client/scripts/serve/package.json` | 2 |
| `unbound/packages/client/scripts/serve/start.ts` | 1 |
| `unbound/packages/client/scripts/serve/static.ts` | 2 |
| `unbound/packages/client/src/api/assets.ts` | 11 |
| `unbound/packages/client/src/api/i18n.ts` | 4 |
| `unbound/packages/client/src/api/metro/components.ts` | 1 |
| `unbound/packages/client/src/api/metro/filters.ts` | 1 |
| `unbound/packages/client/src/api/metro/index.ts` | 3 |
| `unbound/packages/client/src/api/metro/wrappers.ts` | 1 |
| `unbound/packages/client/src/api/native.ts` | 31 |
| `unbound/packages/client/src/api/patcher.ts` | 1 |
| `unbound/packages/client/src/api/settings.ts` | 2 |
| `unbound/packages/client/src/api/storage.ts` | 5 |
| `unbound/packages/client/src/api/toasts.ts` | 2 |
| `unbound/packages/client/src/builtins/debugger.ts` | 2 |
| `unbound/packages/client/src/builtins/error-boundary.tsx` | 2 |
| `unbound/packages/client/src/builtins/settings.tsx` | 13 |
| `unbound/packages/client/src/builtins/staff-mode.ts` | 4 |
| `unbound/packages/client/src/builtins/toasts.tsx` | 4 |
| `unbound/packages/client/src/builtins/tracking.ts` | 3 |
| `unbound/packages/client/src/index.ts` | 13 |
| `unbound/packages/client/src/lib/cache.ts` | 1 |
| `unbound/packages/client/src/lib/constants.ts` | 14 |
| `unbound/packages/client/src/lib/loader.ts` | 4 |
| `unbound/packages/client/src/managers/addons.ts` | 6 |
| `unbound/packages/client/src/managers/base.ts` | 1 |
| `unbound/packages/client/src/managers/builtins.ts` | 1 |
| `unbound/packages/client/src/managers/fonts.ts` | 8 |
| `unbound/packages/client/src/managers/icons.ts` | 4 |
| `unbound/packages/client/src/managers/plugins.ts` | 3 |
| `unbound/packages/client/src/managers/themes.ts` | 3 |
| `unbound/packages/client/src/stores/settings.ts` | 1 |
| `unbound/packages/client/src/stores/themes.ts` | 1 |
| `unbound/packages/client/src/stores/toasts.ts` | 1 |
| `unbound/packages/client/src/ui/addons/addon-card-header.tsx` | 1 |
| `unbound/packages/client/src/ui/addons/addon-card.tsx` | 2 |
| `unbound/packages/client/src/ui/addons/addon-list.tsx` | 1 |
| `unbound/packages/client/src/ui/addons/addon-overflow.tsx` | 2 |
| `unbound/packages/client/src/ui/addons/addon-radio.tsx` | 1 |
| `unbound/packages/client/src/ui/addons/addon-switch.tsx` | 1 |
| `unbound/packages/client/src/ui/addons/install-button.tsx` | 2 |
| `unbound/packages/client/src/ui/addons/install-url-modal.tsx` | 4 |
| `unbound/packages/client/src/ui/hooks/use-addons.ts` | 1 |
| `unbound/packages/client/src/ui/icons/unbound.tsx` | 4 |
| `unbound/packages/client/src/ui/settings/assets.tsx` | 4 |
| `unbound/packages/client/src/ui/settings/design/font-override-row.tsx` | 3 |
| `unbound/packages/client/src/ui/settings/design/font-picker-sheet.tsx` | 2 |
| `unbound/packages/client/src/ui/settings/design/fonts.tsx` | 2 |
| `unbound/packages/client/src/ui/settings/developer.tsx` | 9 |
| `unbound/packages/client/src/ui/settings/general.tsx` | 22 |
| `unbound/packages/client/src/ui/settings/marketplace.tsx` | 1 |
| `unbound/packages/client/src/ui/settings/toasts.tsx` | 6 |
| `unbound/packages/client/src/ui/toasts/toast-buttons.tsx` | 1 |
| `unbound/packages/client/src/ui/toasts/toast-container.tsx` | 1 |
| `unbound/packages/client/src/ui/toasts/toast.tsx` | 2 |
| `unbound/packages/client/src/ui/toasts/use-toast-state.ts` | 2 |
| `unbound/packages/client/tsconfig.json` | 1 |
| `unbound/packages/client/tsconfig.sdk.json` | 4 |
| `unbound/packages/client/tsconfig.tsbuildinfo` | 1 |
| `unbound/packages/debugger-protocol/package.json` | 2 |
| `unbound/packages/debugger/bun.lock` | 1 |
| `unbound/packages/debugger/package.json` | 4 |
| `unbound/packages/debugger/src/lib/banner.ts` | 1 |
| `unbound/packages/debugger/src/lib/session.ts` | 1 |
| `unbound/packages/debugger/src/lib/ws.ts` | 1 |
| `unbound/packages/debugger/tsdown.config.ts` | 1 |
| `unbound/packages/logger/package.json` | 1 |
| `unbound/packages/plugin-test/package.json` | 1 |
| `unbound/packages/plugin-test/src/index.ts` | 11 |
| `unbound/packages/types/global.d.ts` | 10 |
| `unbound/packages/types/index.d.ts` | 1 |
| `unbound/packages/types/package.json` | 1 |
| `unbound/packages/types/typings/addons.ts` | 1 |
| `unbound/packages/types/typings/assets.ts` | 2 |
| `unbound/packages/types/typings/settings.ts` | 1 |
| `unbound/packages/utils/package.json` | 2 |
| `unbound/packages/utils/src/debounce.ts` | 1 |
| `unbound/scripts/publish-package.ts` | 1 |
| `unbound-plugins/.claude/settings.local.json` | 1 |
| `unbound-plugins/.mcp.json` | 2 |
| `unbound-plugins/HANDOFF.md` | 20 |
| `unbound-plugins/PLUGIN-CANDIDATES.md` | 1 |
| `unbound-plugins/README.md` | 5 |
| `unbound-plugins/bun.lock` | 10 |
| `unbound-plugins/package.json` | 1 |
| `unbound-plugins/plugins/README.md` | 11 |
| `unbound-plugins/plugins/aussie-mode/package.json` | 1 |
| `unbound-plugins/plugins/aussie-mode/rollup.config.mjs` | 4 |
| `unbound-plugins/plugins/aussie-mode/src/index.tsx` | 1 |
| `unbound-plugins/plugins/aussie-mode/src/rotate.tsx` | 1 |
| `unbound-plugins/plugins/clear-urls/manifest.json` | 2 |
| `unbound-plugins/plugins/clear-urls/package.json` | 1 |
| `unbound-plugins/plugins/clear-urls/rollup.config.mjs` | 4 |
| `unbound-plugins/plugins/clear-urls/src/index.tsx` | 1 |
| `unbound-plugins/plugins/expression-tools/manifest.json` | 2 |
| `unbound-plugins/plugins/expression-tools/package.json` | 1 |
| `unbound-plugins/plugins/expression-tools/rollup.config.mjs` | 1 |
| `unbound-plugins/plugins/expression-tools/src/index.tsx` | 2 |
| `unbound-plugins/plugins/force-owner-crown/manifest.json` | 2 |
| `unbound-plugins/plugins/force-owner-crown/package.json` | 1 |
| `unbound-plugins/plugins/force-owner-crown/rollup.config.mjs` | 4 |
| `unbound-plugins/plugins/force-owner-crown/src/index.tsx` | 1 |
| `unbound-plugins/plugins/more-user-tags/manifest.json` | 2 |
| `unbound-plugins/plugins/more-user-tags/package.json` | 1 |
| `unbound-plugins/plugins/more-user-tags/rollup.config.mjs` | 4 |
| `unbound-plugins/plugins/more-user-tags/src/index.tsx` | 3 |
| `unbound-plugins/plugins/no-blocked-messages/manifest.json` | 2 |
| `unbound-plugins/plugins/no-blocked-messages/package.json` | 1 |
| `unbound-plugins/plugins/no-blocked-messages/rollup.config.mjs` | 4 |
| `unbound-plugins/plugins/no-blocked-messages/src/index.tsx` | 2 |
| `unbound-plugins/plugins/no-reply-mention/manifest.json` | 2 |
| `unbound-plugins/plugins/no-reply-mention/package.json` | 1 |
| `unbound-plugins/plugins/no-reply-mention/rollup.config.mjs` | 4 |
| `unbound-plugins/plugins/no-reply-mention/src/index.tsx` | 3 |
| `unbound-plugins/plugins/preview-message/manifest.json` | 2 |
| `unbound-plugins/plugins/preview-message/package.json` | 1 |
| `unbound-plugins/plugins/preview-message/rollup.config.mjs` | 4 |
| `unbound-plugins/plugins/preview-message/src/index.tsx` | 2 |
| `unbound-plugins/plugins/reviewdb/manifest.json` | 2 |
| `unbound-plugins/plugins/reviewdb/package.json` | 1 |
| `unbound-plugins/plugins/reviewdb/rollup.config.mjs` | 4 |
| `unbound-plugins/plugins/reviewdb/src/api.ts` | 1 |
| `unbound-plugins/plugins/reviewdb/src/auth.tsx` | 3 |
| `unbound-plugins/plugins/reviewdb/src/index.tsx` | 2 |
| `unbound-plugins/plugins/reviewdb/src/menu.tsx` | 2 |
| `unbound-plugins/plugins/reviewdb/src/settings.tsx` | 3 |
| `unbound-plugins/plugins/reviewdb/src/sheets/BlockedUsersSheet.tsx` | 2 |
| `unbound-plugins/plugins/reviewdb/src/sheets/ReviewItem.tsx` | 1 |
| `unbound-plugins/plugins/reviewdb/src/sheets/ReviewsSheet.tsx` | 3 |
| `unbound-plugins/plugins/reviewdb/src/utils.ts` | 1 |
| `unbound-plugins/plugins/show-me-your-name/manifest.json` | 2 |
| `unbound-plugins/plugins/show-me-your-name/package.json` | 1 |
| `unbound-plugins/plugins/show-me-your-name/rollup.config.mjs` | 4 |
| `unbound-plugins/plugins/show-me-your-name/src/index.tsx` | 3 |
| `unbound-plugins/plugins/translate/manifest.json` | 2 |
| `unbound-plugins/plugins/translate/package.json` | 1 |
| `unbound-plugins/plugins/translate/rollup.config.mjs` | 4 |
| `unbound-plugins/plugins/translate/src/api.ts` | 3 |
| `unbound-plugins/plugins/translate/src/index.tsx` | 1 |
| `unbound-plugins/plugins/translate/src/menu.ts` | 3 |
| `unbound-plugins/plugins/translate/src/oauth.tsx` | 2 |
| `unbound-plugins/plugins/translate/src/settings.tsx` | 5 |
| `unbound-plugins/plugins/translate/src/sheets/LanguagePickerSheet.tsx` | 1 |
| `unbound-plugins/plugins/typing-avatars/manifest.json` | 2 |
| `unbound-plugins/plugins/typing-avatars/package.json` | 1 |
| `unbound-plugins/plugins/typing-avatars/rollup.config.mjs` | 4 |
| `unbound-plugins/plugins/typing-avatars/src/index.tsx` | 1 |
| `unbound-plugins/unbound.config.json` | 1 |
| `vbound/AGENTS.md` | 6 |
| `vbound/CHANGELOG.md` | 2 |
| `vbound/CLAUDE.md` | 6 |
| `vbound/README.md` | 5 |
| `vbound/vbound/AppController+Build.swift` | 4 |
| `vbound/vbound/AppController+Diagnostics.swift` | 5 |
| `vbound/vbound/AppController+LogStream.swift` | 3 |
| `vbound/vbound/AppController+Process.swift` | 1 |
| `vbound/vbound/Assets.xcassets/Unbound.symbolset/Contents.json` | 1 |
| `vbound/vbound/CommandPaletteView.swift` | 4 |
| `vbound/vbound/ContentView.swift` | 33 |
| `vbound/vbound/Models.swift` | 3 |
| `vbound/vbound/SettingsView.swift` | 5 |
| `vbound/vbound/releases.mock.json` | 1 |
| `vbound/vbound/vboundApp.swift` | 10 |
| `agent-skills/README.md` | 7 |
| `agent-skills/tweak-development/SKILL.md` | 2 |
| `agent-skills/tweak-development/references/vphone.md` | 1 |
| `agent-skills/unbound/SKILL.md` | 33 |
| `agent-skills/unbound/references/debugger.md` | 5 |
| `agent-skills/unbound/references/vbound.md` | 9 |
| `autosupport/docker-compose.yml` | 2 |
| `autosupport/package.json` | 1 |
| `autosupport/src/commands/chat/info.ts` | 2 |
| `autosupport/src/data.toml` | 6 |
| `autosupport/src/utils/githubCommit.ts` | 1 |
| `autosupport/src/utils/onePasswordSecrets.test.ts` | 2 |
| `autosupport/src/utils/onePasswordSecrets.ts` | 1 |
| `autoinstall/HANDOFF.md` | 3 |
| `autoinstall/README.md` | 1 |
| `dkrypt/.env.example` | 1 |
| `dkrypt/README.md` | 4 |
| `patcher-ios/go.mod` | 1 |
| `patcher-ios/patcher.go` | 12 |
| `patcher-ios/scripts/compile-icon.sh` | 4 |
| `translation-api/docker-compose.yml` | 2 |
| `translation-api/src/utils/onePasswordSecrets.test.ts` | 2 |
| `translation-api/src/utils/onePasswordSecrets.ts` | 1 |
| `CoreDex/CoreDex/GraphQL/schema.graphqls` | 1 |
| `kdapi/data/idols.json` | 1 |
| `mw-native/tooling/eslint/react.js` | 1 |
| `unbound/.oxlintrc.json` | 1 |
| `loader-ios/.claude/mcp/vphone/server.mjs` | 8 |
| `loader-ios/.claude/skills/vphone/SKILL.md` | 18 |
| `loader-ios/.claude/skills/vphone/scripts/format-logs.jq` | 4 |
| `loader-ios/.claude/skills/vphone/scripts/vphone-logs.sh` | 8 |
| `loader-ios/.claude/skills/vphone/scripts/vphone.sh` | 16 |
| `loader-ios/.github/workflows/build.yml` | 9 |
| `loader-ios/.github/workflows/ci.yml` | 1 |
| `loader-ios/.gitmodules` | 1 |
| `loader-ios/Makefile` | 4 |
| `loader-ios/README.md` | 16 |
| `loader-ios/app-repo.json` | 9 |
| `loader-ios/apt-repo/repo/assets/repo/repo.conf` | 3 |
| `loader-ios/apt-repo/repo/depictions/unbound.json` | 5 |
| `loader-ios/apt-repo/repo/depictions/web/app.unbound.ios/info.xml` | 3 |
| `loader-ios/apt-repo/repo/index.html` | 10 |
| `loader-ios/apt-repo/repo/repo.xml` | 1 |
| `loader-ios/apt-repo/repo/sileo-featured.json` | 3 |
| `loader-ios/build-local.sh` | 7 |
| `loader-ios/control` | 5 |
| `loader-ios/headers/Analytics.h` | 1 |
| `loader-ios/headers/Debug.h` | 1 |
| `loader-ios/headers/FileSystem.h` | 1 |
| `loader-ios/headers/Fonts.h` | 1 |
| `loader-ios/headers/HotReload.h` | 1 |
| `loader-ios/headers/LoaderShared.h` | 1 |
| `loader-ios/headers/Plugins.h` | 1 |
| `loader-ios/headers/Settings.h` | 2 |
| `loader-ios/headers/Sideloading.h` | 1 |
| `loader-ios/headers/Themes.h` | 1 |
| `loader-ios/headers/Toolbox.h` | 2 |
| `loader-ios/headers/UnboundNative.h` | 1 |
| `loader-ios/headers/Updater.h` | 1 |
| `loader-ios/headers/Utilities.h` | 1 |
| `loader-ios/headers/jsi/jsi.h` | 1 |
| `loader-ios/patcher-ios/go.mod` | 1 |
| `loader-ios/patcher-ios/patcher.go` | 14 |
| `loader-ios/sources/DevOverlay.m` | 4 |
| `loader-ios/sources/FileSystem.m` | 2 |
| `loader-ios/sources/Fonts.x` | 1 |
| `loader-ios/sources/HotReload.m` | 5 |
| `loader-ios/sources/LoaderShared.m` | 6 |
| `loader-ios/sources/Logger.m` | 2 |
| `loader-ios/sources/NotificationDelegate.x` | 4 |
| `loader-ios/sources/Settings.m` | 3 |
| `loader-ios/sources/Themes.x` | 2 |
| `loader-ios/sources/Toolbox.x` | 34 |
| `loader-ios/sources/Unbound.xm` | 28 |
| `loader-ios/sources/UnboundNative.xm` | 5 |
| `loader-ios/sources/Updater.m` | 13 |
| `loader-ios/sources/Utilities.m` | 4 |

## Filename and path match manifest

| Path | Action |
| --- | --- |
| `RNiOSNewArchTweak/BridgelessApp/ios/NativeUnboundModule` | Manual review; likely unrelated experimental module. |
| `agent-skills/unbound` | Rename with the rebrand only after every skill consumer is updated. |
| `loader-ios/Unbound.plist` | Rename with the tweak/bundle migration. |
| `loader-ios/apt-repo/repo/depictions/unbound.json` | Rename alongside its depiction URL and package metadata. |
| `loader-ios/apt-repo/repo/depictions/web/app.unbound.ios` | Rename only with a deliberate package-ID/depiction migration. |
| `loader-ios/headers/Unbound.h` | Rename with native public headers and imports. |
| `loader-ios/headers/UnboundNative.h` | Rename with native public headers and imports. |
| `loader-ios/sources/Unbound.xm` | Rename with the tweak entry point and build target. |
| `loader-ios/sources/UnboundNative.xm` | Rename with the native bridge and imports. |
| `patcher-ios/assets/icons/UnboundIcon60x60@2x.png` | Replace/rename with the final icon asset and alternate-icon key. |
| `patcher-ios/assets/icons/UnboundIcon76x76@2x~ipad.png` | Replace/rename with the final icon asset and alternate-icon key. |
| `unbound` | Rename the local monorepo directory with its GitHub repository migration. |
| `unbound-plugins` | Rename the local addon-workspace directory with its GitHub repository migration. |
| `unbound-plugins/unbound.config.json` | Rename after CLI/config compatibility policy is set. |
| `vbound/vbound/Assets.xcassets/Unbound.symbolset` | Rename the asset set and every Swift asset lookup. |
| `vbound/vbound/Assets.xcassets/Unbound.symbolset/Unbound.svg` | Replace/rename with the final vector mark. |
