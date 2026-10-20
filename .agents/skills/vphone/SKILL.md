---
name: vphone
description: Drive the vphone iOS VM (an iOS 27 VM on marios-macbook-pro) through its tailnet MCP tool. Use when pressing, typing, screenshotting, reading logs, moving files, or installing an IPA or tweak on the vphone.
---

# vphone

The tool is `mcp__tailnet__marios_macbook_pro__vphone__vphone`; load it with tool search. If it is missing, `mcp__tailnet__list_machines` must list `vphone` under `marios-macbook-pro`; otherwise the connector on the Mac is down and the user must restart it. Screen space is 430x932 points.

## Input

- **Press React Native views** with `swipe` from a point to the same point, `ms: 150`–`200`. Inside tab pages use an exact zero-move press; elsewhere `x2 = x1 + 1` also works. A plain `tap` reaches only native UIKit views (alerts); `tap_text` works there too.
- **Wait, then look.** A `screenshot` straight after an action can be a stale frame. `wait` for the expected text (or `gone: true`) first.
- **Coordinates come from `ui`**, the accessibility tree with labels and frames. A labelled element can be the caption beside an input, so check its frame.
- **Type one character per call**, ~150 ms apart; fast `type` drops characters. Check the field with a screenshot. `rpc clipboard.set` works but pasting into RN inputs was unreliable.

## Screenshots to a file

The tool returns the image inline only. From codemode, hand it to `image()`, which prints the saved path; copy that file to `/tmp/<task>-evidence/NN-<what>.jpg`.

```js
const s = await tools.mcp__tailnet__marios_macbook_pro__vphone__vphone({
	action: 'screenshot',
	args: {},
});
const img = s.content.find((c) => c.type === 'image');
image(`data:${img.mimeType};base64,${img.data}`);
```

## Apps and logs

- `launch` / `terminate` with `bundle_id`; `app_info` gives `bundle_path` and `data_path`, which change on reinstall.
- `logs` with `process`, `include`/`exclude` regexes, `level: error`, up to 60 s. Regex flags like `(?i)` must lead the pattern. Start `logs` and `launch` together to catch startup.

## Files and shell

- `shell` runs in a bootstrap root; the real root is under `/rootfs`. Pass `root: true` to write outside the user's files. Present: `curl`, `sha256sum`, `dpkg`. Absent: `strings`, `shasum`, `zip`, tailnet DNS (use `100.65.233.54` for the VPS). `/etc/hosts` is read-only.
- Large files: serve them from the VPS (`python3 -m http.server 8799 --bind 100.65.233.54` in the file's directory), `curl` them from `shell`, stop the server. `ssh vphone` from the VPS is unreliable; prefer `shell`, `push`, `pull`.

## Installing

- **IPA**: place it under `/rootfs/private/var/mobile/Downloads/`, then `rpc apps.install` with `{"path": "/private/var/mobile/Downloads/<file>.ipa"}` (`/tmp` paths are rejected). Installing over an existing app keeps its data and login.
- **Tweak**: the VM is `iphoneos-arm64e` and ElleKit is installed as arm64e, so an `arm64` deb needs `dpkg --force-architecture --force-depends -i <deb>` from a root `shell`. Rootless debs land under `/var/jb`, but this ElleKit loads only `/Library/MobileSubstrate/DynamicLibraries/`; copy (not symlink) the `.dylib` and `.plist` there, owned `root:wheel`.
