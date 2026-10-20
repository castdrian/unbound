---
name: hermes
description: Read Discord's mobile JavaScript from its decompiled Hermes bytecode. Use when you need how Discord implements something (a store, component, navigation helper, motion preset, settings route) before calling or patching it, or when decompiling a new Discord build.
---

# Discord's Hermes source

Discord ships Hermes bytecode (version 98 in Discord 349). The decompiled copy of Discord 349, split one file per source module, is at `~/.cache/unbound/discord-349/mods/`, named by original source path (`stores/`, `design/`, `modules/user_profile/native/...`). `main.js` beside it is the whole decompile.

## Finding things

Search the source, then confirm live with `ubd eval` (see the `unbound-dev` skill). The source shows names and shapes; only the live runtime proves they still exist.

- **By name**: `grep -rln '<identifier>' ~/.cache/unbound/discord-349/mods`. Strings survive decompilation; local variable names are registers (`r7`).
- **Flux stores** live at `mods/stores/<Name>Store.tsx`. The name is assigned through a register before `displayName`, so search `= 'UserStore';`. Live: `unbound.metro.findStore('User')`, which appends `Store` unless you pass `{ short: false }`. `unbound.metro.stores` is Unbound's own small set, not Discord's stores.
- **Modules by props**: find a distinctive export name in the source, then `unbound.metro.findByProps('<name>')` live.

## A new Discord build

Get the IPA (see the `dkrypt` skill), then:

```bash
.agents/skills/hermes/scripts/decompile-discord.sh <discord.ipa> ~/.cache/unbound/discord-<version>
```

It installs `hermes-dec` into `~/.cache/unbound/hermes-dec` on first run, extracts `main.jsbundle`, decompiles it (warnings about bytecode 98 are expected, in `dec.log`), and splits it into `mods/` with `split-modules.py`. Done when `mods/stores/UserStore.tsx` exists.
