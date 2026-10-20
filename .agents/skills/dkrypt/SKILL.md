---
name: dkrypt
description: Download decrypted iOS IPAs from the dkrypt API at ipa.dylib.dev. Use when you need a Discord (or other) IPA for the vphone or for decompiling, or need a build dkrypt has not decrypted yet.
---

# dkrypt (ipa.dylib.dev)

Base URL `https://ipa.dylib.dev`. Auth is `Authorization: Bearer $DKRYPT_API_KEY`, with the key in `/home/dev/unbound/.env` (`set -a; . /home/dev/unbound/.env; set +a`). Keep the key out of output and commits.

## Get an IPA

```bash
.agents/skills/dkrypt/scripts/fetch-ipa.sh --list com.hammerandchisel.discord     # cached builds, newest first
.agents/skills/dkrypt/scripts/fetch-ipa.sh com.hammerandchisel.discord appstore   # download the newest appstore build
```

Downloads go to `~/ipas/<bundleId>-<version>-<build>.ipa` and the script checks the SHA-256 against the listing. Done when it prints `ok <path>`. Prefer `appstore` builds for the vphone; `testflight` builds are newer but less tested.

## Endpoints

| Endpoint                                                         | Use                                                                                                                                    |
| ---------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| `GET /v1/artifacts`                                              | Every cached artifact: `id`, `bundleId`, `channel` (`appstore`/`testflight`), `versionLabel`, `buildNumber`, `sha256`, `sizeBytes`.    |
| `GET /v1/artifacts/{id}/file?projectId=default`                  | The IPA bytes.                                                                                                                         |
| `GET /v1/decrypt?bundleId=&version=`                             | Fetch-or-decrypt one build. Slow; it held a connection over 60 s without answering, so use the job flow below for anything not cached. |
| `POST /v1/decrypts` `{bundleId, version?}` + `GET /v1/jobs/{id}` | Start a decrypt job and poll it.                                                                                                       |

The full OpenAPI spec was given as an attachment and is not stored here; these are the endpoints in use.
