# Device setup and recovery

Paths are relative to `.agents/skills/unbound-dev/`. Variables are from SKILL.md's Configuration table.

## Recovery

Match the doctor's `FAIL` line.

| FAIL                  | Fix                                                                                                                                                                                                                                        |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| bundle server, bridge | `scripts/up.sh`. If the session runs but the check fails, read its log in `UNBOUND_LOG_DIR`, then `scripts/up.sh --restart`. The dev server is ready when its log shows `Build completed successfully`.                                    |
| catalog               | `scripts/up.sh --restart catalog`.                                                                                                                                                                                                         |
| device eval           | Relaunch Discord (SKILL.md loop step 3). Still failing: the vphone tool is missing (see the `vphone` skill), Discord is frozen ([UnboundResources](#unboundresources)), or `settings.json` lost its debugger keys ([Settings](#settings)). |

## From nothing

Each step ends with its check.

1. **Discord IPA.** `python3 ../dkrypt/scripts/fetch-ipa.py com.hammerandchisel.discord appstore` (the `dkrypt` skill). Check: it prints `ok <path>`.
2. **Relax ATS.** iOS blocks the loader's plain-HTTP fetch (`kCFErrorDomainCFNetwork -1022`) until `Info.plist` allows arbitrary loads. `python3 scripts/patch-ats.py <in.ipa> <out.ipa>`. Check: it prints `patched <out.ipa>`.
3. **Install** the patched IPA per the `vphone` skill's Installing section. Check: `list_apps` shows Discord.
4. **Loader.** In a checkout of `github.com/unbound-app/loader-ios`, build the debug package so attestation is off: `make clean package DEBUG=1`. A release build shows "SECURITY WARNING" and skips hooking React Native. Install the deb per the `vphone` skill (tweak). Check: Discord shows the wrench toolbox button and a red "DEVELOPMENT BUILD" banner.
5. <a id="unboundresources"></a>**UnboundResources.** Copy `/var/jb/Library/Application Support/UnboundResources.bundle` into the installed `Discord.app` (`app_info`'s `bundle_path`, under `/rootfs`), owned `_installd:_installd`. Without it `modules.js` is never injected and Discord freezes. Redo after every IPA install. Check: Discord goes live (presence dots, badges).
6. <a id="settings"></a>**Settings.** In `<data_path>/Documents/Unbound/settings.json` (owner `mobile:mobile`), set these keys and keep the others, since the client rewrites this file:
    ```json
    {
    	"unbound": {
    		"loader": {
    			"update": {
    				"url": "http://<DEV_HOST>:<UNBOUND_DEV_PORT>/unbound.bundle",
    				"hmr": true
    			}
    		},
    		"debugger": { "enabled": true, "address": "<DEV_HOST>:<UNBOUND_BRIDGE_PORT>" }
    	}
    }
    ```
    Check: relaunch, then `scripts/ubd eval 'typeof unbound'` prints `object`.
7. **Log in** only if logged out. The account is the user's, so ask for credentials. Press "Log In", type each field one character per call, and confirm with the password eye toggle before submitting. Dismiss prompts with "Ask App Not to Track", "Maybe Later" and "Continue".
