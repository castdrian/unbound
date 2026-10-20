---
name: unbound-dev
description: Develop and verify the Unbound client against live Discord on the vphone. Use when proving a client change on device, evaluating code in the Discord runtime, opening an Unbound settings screen, or when the bundle server, debugger bridge or loader misbehaves.
---

# Unbound development

Discord (`com.hammerandchisel.discord`) runs on the vphone (see the `vphone` skill) with the Unbound loader and a logged-in account. A change counts as **proven** only when the device ran this checkout's build and a screenshot or eval result shows the end state. `scripts/` paths are relative to this skill's directory (`.agents/skills/unbound-dev/`). The scripts run from any working directory.

## Configuration

The scripts read these from the environment, else from the repo's gitignored `.env`.

| Variable               | Default                | Meaning                                     |
| ---------------------- | ---------------------- | ------------------------------------------- |
| `DEV_HOST`             | the client's LAN guess | Address the device reaches this machine at. |
| `UNBOUND_DEV_PORT`     | `3000`                 | Bundle server.                              |
| `UNBOUND_BRIDGE_PORT`  | `9090`                 | Debugger bridge.                            |
| `UNBOUND_CATALOG_PORT` | `3200`                 | Marketplace catalog stub.                   |
| `UNBOUND_LOG_DIR`      | `$TMPDIR` or `/tmp`    | Server logs, `<tmux session>.log`.          |

Set `DEV_HOST` on a machine with several networks (Tailscale, Docker). The guess often picks the wrong one.

## The loop

1. **Start.** `scripts/up.sh` starts the bridge and the dev server in tmux sessions and leaves running ones alone. Add `--restart` after changing configuration.
2. **Doctor.** `scripts/doctor.sh`. Done when it exits 0. For a `FAIL` line, see [SETUP.md](SETUP.md#recovery).
3. **Load your build.** A JS reload loses Unbound (see Known faults), so relaunch after every rebuild: vphone `terminate` then `launch` with `bundle_id: com.hammerandchisel.discord`, then `tap_text` `Okay` on the "Missing Safari Extension" alert until `wait` with `gone: true` passes. Done when the doctor's `last device bundle fetch` is newer than your edit.
4. **Navigate** with `ubd open`, never by tapping through settings.
5. **Act** with `ubd eval` for state and vphone gestures for input.
6. **Capture evidence** under `/tmp/<task>-evidence/`: a vphone screenshot after a `wait` for the expected text, plus eval output proving side effects.

## ubd

`scripts/ubd <command>` runs the repo CLI (`packages/cli`) against `UNBOUND_BRIDGE_PORT`. Use it only for device commands.

| Command                                 | Does                                                                                                                                                                             |
| --------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ubd eval '<js>'`                       | Evaluates in Discord's JS runtime and returns the last expression. `unbound` is the client's global (`unbound.metro.findByProps(...)`, managers, storage).                       |
| `ubd open <Screen> [--params '<json>']` | Opens a settings screen. `<Screen>` is a `Screens` key from `packages/client/src/lib/constants.ts` (`Marketplace`, `Plugins`, `Design`, ...) or a `SETTING_RENDERER_CONFIG` key. |
| `ubd route`                             | Prints `{name, params, path}` of the current screen. Assert on `name` (`open Plugins` gives `UNBOUND_PLUGINS`).                                                                  |

Each command is also an MCP tool (`ubd mcp`), defined in `packages/cli/src/commands/` and registered in `packages/cli/src/registry.ts`. Add new device shortcuts there with `surfaces: { cli: true, mcp: true }`, sending device code through eval instead of shipping it in the client bundle.

## Discord's source

Before calling or patching a Discord API, read how Discord does it with the `hermes` skill, then confirm live with `ubd eval`.

## Known faults

- **JS reload loses Unbound.** The loader never resets `gLoaderPrepared` and `gBundleExecutionScheduled` (`loader-ios/sources/Unbound.xm`), so `ubd reload` and hot reload bring Discord back without Unbound. Relaunch instead.
- **`__c()` wipes Discord's modules** when `modules.js` was not injected: the loader's readiness poll and the client's `ensureModules` (`packages/client/src/lib/loader.ts`) call Metro's `__c()`, which is `clear()`. Symptom: Discord renders but never goes live and `ubd eval` finds no device. Fix: [UnboundResources](SETUP.md#unboundresources).
- **`Addons.delete`** reports success but leaves the addon folder on disk.
- **Toasts** never appear on the vphone. Check state through eval.

## Marketplace API

`scripts/up.sh --restart catalog` serves `scripts/catalog-stub.ts` (the real `GET /api/v1/catalog` endpoint over seeded SQLite, plus a CDN for the addon files) and rebuilds the client against it. `POST /__approve?id=&version=` publishes a version and `POST /__delist?id=` delists an addon. To hold the client in its loading state, run `PORT=<catalog port> bun scripts/catalog-hang.ts` in place of the stub. It accepts connections and never answers.

Rebuilding the device from nothing: [SETUP.md](SETUP.md).
