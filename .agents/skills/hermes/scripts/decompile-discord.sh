#!/usr/bin/env bash
# Decompile a Discord IPA's Hermes bundle into one file per source module.
# Usage: decompile-discord.sh <discord.ipa> <out dir>   e.g. ~/ipas/discord-349.0-114462.ipa ~/.cache/unbound/discord-349
set -euo pipefail

ipa=$1
out=$2
venv=${HERMES_DEC_VENV:-$HOME/.cache/unbound/hermes-dec}

if [[ ! -x $venv/bin/hbc-decompiler ]]; then
	uv venv "$venv"
	uv pip install --python "$venv/bin/python" hermes-dec
fi

mkdir -p "$out"
python3 -c "import zipfile,sys; open(sys.argv[2],'wb').write(zipfile.ZipFile(sys.argv[1]).read('Payload/Discord.app/main.jsbundle'))" "$ipa" "$out/main.jsbundle"
"$venv/bin/hbc-decompiler" "$out/main.jsbundle" "$out/main.js" 2>"$out/dec.log"
python3 "$(dirname "$0")/split-modules.py" "$out/main.js" "$out/mods"
