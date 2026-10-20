---
name: unbound-dev
description: Develop and verify the Unbound client against live Discord on the vphone. Use when proving a client change on device, evaluating code in the Discord runtime, opening an Unbound settings screen, or when the bundle server, debugger bridge or loader misbehaves.
---

# Unbound development

Everything runs from `/home/dev/unbound`. The device is **vphone**, an iOS 27 VM on `marios-macbook-pro`, driven per the `vphone` skill. Discord (`com.hammerandchisel.discord`) runs there with the Unbound loader and a logged-in account. A change counts as **proven** only when the device ran this checkout's build and a screenshot or eval result shows the end state.

## The loop

1. **Doctor.** Run `.agents/skills/unbound-dev/scripts/doctor.sh`. Done when it exits 0. Each `FAIL` line maps to a fix in [SETUP.md](SETUP.md#recovery).
2. **Load your build.** The dev server rebuilds on save, but the loader does not re-run Unbound after a JS reload (see Known faults). So after every rebuild, relaunch: vphone `terminate` then `launch` with `bundle_id: com.hammerandchisel.discord`, dismiss the "Missing Safari Extension" alert with `tap_text` `Okay` (repeat until `wait` with `gone: true` passes). Done when `/tmp/unbound-dev.log` shows a `GET /unbound.98.bundle` newer than your edit and `ubd eval 'typeof unbound'` returns `object`.
3. **Navigate** with `ubd open`, never by tapping through settings.
4. **Act** with `ubd eval` for state and the vphone gestures for input.
5. **Capture evidence**: a vphone screenshot (saved to a file per the `vphone` skill) after a `wait` for the expected text, plus eval output proving side effects (files written, store state), under `/tmp/<task>-evidence/`.

## ubd commands

`ubd` is shorthand, not a binary on PATH: run `bun packages/cli/src/index.ts <command> --port 9091` from the repo root, e.g. `bun packages/cli/src/index.ts open Plugins --port 9091`. Always pass `--port 9091`; the default 9090 belongs to an unrelated container.

| Command                                             | Does                                                                                                                                                                                                                                                                                                             |
| --------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ubd eval '<js>' --port 9091`                       | Evaluates in the Discord JS runtime. Last expression is the result; console output is captured. `unbound` is the client's global (`unbound.metro.findByProps(...)`, managers, storage).                                                                                                                          |
| `ubd open <Screen> [--params '<json>'] --port 9091` | Opens a settings screen from anywhere. `<Screen>` is a `Screens` key from `packages/client/src/lib/constants.ts` (`Marketplace`, `Plugins`, `Design`, `General`, ...) or any `SETTING_RENDERER_CONFIG` key. Uses `getRootNavigationRef().navigate('settings', ...)`; Discord 349 has no settings `transitionTo`. |
| `ubd route --port 9091`                             | Prints `{name, params, path}` of the current screen. `name` is the route key (`open Plugins` → `UNBOUND_PLUGINS`), so assert on that.                                                                                                                                                                            |
| `ubd reload --port 9091`                            | Reloads JS. Broken by a loader fault; relaunch instead.                                                                                                                                                                                                                                                          |

Each is also an MCP tool (`ubd mcp`), defined once in `packages/cli/src/commands/` and registered in `packages/cli/src/registry.ts`. New device shortcuts go there with `surfaces: { cli: true, mcp: true }`, sending device code through eval rather than shipping it in the client bundle.

## Discord's source

Before calling or patching a Discord API, read how Discord does it per the `hermes` skill, then confirm live with `ubd eval`. A new Discord IPA comes from the `dkrypt` skill.

## Known faults

- **`__c()` wipes Discord's modules.** When `modules.js` is not injected, the loader's readiness poll (`~/loader-ios/sources/Unbound.xm:233`) and the client's `ensureModules` (`packages/client/src/lib/loader.ts:102`) call Metro's `__c()`, which is `clear()`. Symptom: Discord renders but never goes live and `ubd eval` reports no device. Fix per [SETUP.md](SETUP.md#unboundresources).
- **JS reload loses Unbound.** The loader's `gLoaderPrepared` (`Unbound.xm:149`) and `gBundleExecutionScheduled` (`:289`) are never reset, so `ubd reload` and hot-reload bring Discord back without Unbound. Relaunch instead.
- **`Addons.delete`** reports success but leaves the addon folder on disk.
- Unbound toasts never appear on this device; check state through eval instead.

## Testing against the marketplace API

`scripts/catalog-stub.ts` serves the real `GET /api/v1/catalog` endpoint over a seeded SQLite database, plus a CDN for addon files, on `100.65.233.54:3200`. Run it in tmux `marketplace-api` (`bun .agents/skills/unbound-dev/scripts/catalog-stub.ts`) and start the dev server with `UNBOUND_API_URL=http://100.65.233.54:3200`. `scripts/catalog-hang.ts` holds connections open on the same port to show the loading state.

Rebuilding the device from nothing (Discord IPA, loader, login, settings): [SETUP.md](SETUP.md).
