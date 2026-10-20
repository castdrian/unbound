#!/usr/bin/env bash
# Usage: fetch-ipa.sh --list <bundleId> | fetch-ipa.sh <bundleId> [appstore|testflight]
set -euo pipefail

set -a
. /home/dev/unbound/.env
set +a

base=https://ipa.dylib.dev
auth="Authorization: Bearer $DKRYPT_API_KEY"
artifacts=$(curl -sSf -m 60 -H "$auth" "$base/v1/artifacts")

if [[ $1 == --list ]]; then
	python3 -c '
import json, sys
for a in json.loads(sys.argv[1])["artifacts"]:
    if a["bundleId"] == sys.argv[2]:
        print(a["id"], a["channel"], a["versionLabel"], a["buildNumber"], a["createdAt"])
' "$artifacts" "$2"
	exit 0
fi

bundle=$1
channel=${2:-appstore}
read -r id sha name < <(python3 -c '
import json, sys
hits = [a for a in json.loads(sys.argv[1])["artifacts"] if a["bundleId"] == sys.argv[2] and a["channel"] == sys.argv[3]]
if not hits:
    sys.exit("no cached " + sys.argv[3] + " artifact for " + sys.argv[2])
a = max(hits, key=lambda a: a["createdAt"])
print(a["id"], a["sha256"], "-".join([a["bundleId"], a["versionLabel"], a["buildNumber"]]) + ".ipa")
' "$artifacts" "$bundle" "$channel")

mkdir -p ~/ipas
out=~/ipas/$name

if [[ ! -f $out ]]; then
	curl -sSfL -m 900 -H "$auth" -o "$out.part" "$base/v1/artifacts/$id/file?projectId=default"
	mv "$out.part" "$out"
fi

echo "$sha  $out" | sha256sum -c --quiet || { echo "sha256 mismatch: $out" >&2; exit 1; }
echo "ok $out"
