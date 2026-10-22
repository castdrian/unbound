---
name: vphone
description: Drive the vphone iOS VM (an iOS 27 VM on marios-macbook-pro) through its tailnet MCP tool. Use when pressing, typing, screenshotting, reading logs, moving files, or installing an IPA or tweak on the vphone.
---

# vphone

The tool is the tailnet MCP tool whose name ends in `__vphone__vphone`. Find it with tool search for `vphone`. If it is missing, `list_machines` on the tailnet MCP must list the machine that hosts `vphone`. Otherwise its connector is down and the user must restart it. The screen is 430x932 points.

## Input

- **Press React Native views** with `swipe` from a point to the same point, `ms: 150` to `200`. Inside tab pages use an exact zero-move press. Elsewhere `x2 = x1 + 1` also works. `tap` and `tap_text` reach only native UIKit views such as alerts.
- **Wait, then look.** A `screenshot` straight after an action can show a stale frame. `wait` for the expected text (or `gone: true`) first.
- **Take coordinates from `ui`**, the accessibility tree with labels and frames. A labelled element can be the caption beside an input, so check its frame.
- **Type one character per call**, about 150 ms apart. A fast `type` drops characters. Check the field with a screenshot.

## Screenshots to a file

The tool returns the image inline only. In codemode, pass it to `image()`, which prints the saved path, then copy that file to `/tmp/<task>-evidence/NN-<what>.jpg`.

```js
const tool = (await searchTools('vphone')).find((t) => t.name.endsWith('__vphone__vphone')).name;
const shot = await tools[tool]({ action: 'screenshot', args: {} });
const img = shot.content.find((c) => c.type === 'image');
image(`data:${img.mimeType};base64,${img.data}`);
```

## Apps and logs

- `launch` and `terminate` take `bundle_id`. `app_info` gives `bundle_path` and `data_path`, which change on reinstall.
- `logs` takes `process`, `include`/`exclude` regexes and `level: error`, for up to 60 s. Regex flags like `(?i)` must lead the pattern. Start `logs` and `launch` together to catch startup.

## Files and shell

- `shell` runs in a bootstrap root. The real root is under `/rootfs`. Pass `root: true` to write outside the user's files. `curl`, `sha256sum` and `dpkg` exist. `strings`, `shasum`, `zip` and tailnet DNS do not, so address other machines by IP. `/etc/hosts` is read-only.
- Prefer `shell`, `push` and `pull` over `ssh vphone`, which is unreliable. For large files, serve the file's directory over HTTP on an address the VM reaches (`python3 -m http.server <port> --bind <ip>`), `curl` it from `shell`, then stop the server.

## Installing

- **IPA.** Place it under `/rootfs/private/var/mobile/Downloads/`, then `rpc apps.install` with `{"path": "/private/var/mobile/Downloads/<file>.ipa"}`. `/tmp` paths are rejected. Installing over an existing app keeps its data and login.
- **Tweak.** The VM is `iphoneos-arm64e`, so an `arm64` deb needs `dpkg --force-architecture --force-depends -i <deb>` from a root `shell`. Rootless debs land under `/var/jb`, but this ElleKit loads only `/Library/MobileSubstrate/DynamicLibraries/`. Copy (not symlink) the `.dylib` and `.plist` there, owned `root:wheel`.
